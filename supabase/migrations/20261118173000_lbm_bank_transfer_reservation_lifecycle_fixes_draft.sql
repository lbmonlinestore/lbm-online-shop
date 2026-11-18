-- LBM Bank Transfer reservation lifecycle corrections
-- Draft only: do not apply to production until reviewed and explicitly approved.
-- Fixes: pending receipt grace, late admin verification, cancellation release, expiry schedule.

begin;

-- A receipt submitted before the 24-hour deadline keeps the reservation while
-- LBM verifies it, even if an administrator reviews it after the deadline.
create or replace function public.review_lbm_bank_transfer(
  p_payment_id uuid,
  p_decision text,
  p_admin_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.lbm_bank_transfer_payments%rowtype;
  v_order public.orders%rowtype;
  v_decision text := trim(coalesce(p_decision, ''));
begin
  if auth.uid() is null or not exists (
    select 1 from public.admin_users a where a.user_id = auth.uid()
  ) then
    raise exception 'Administrator access required.';
  end if;

  if v_decision not in ('Approved', 'Rejected') then
    raise exception 'Decision must be Approved or Rejected.';
  end if;

  select * into v_payment
  from public.lbm_bank_transfer_payments
  where id = p_payment_id
  for update;

  if not found then raise exception 'Payment submission not found.'; end if;
  if v_payment.status <> 'Pending Verification' then
    raise exception 'This payment has already been reviewed.';
  end if;

  select * into v_order
  from public.orders
  where id = v_payment.order_id
  for update;

  if not found then raise exception 'The linked order could not be found.'; end if;
  if lower(coalesce(v_order.payment_method, '')) <> 'bank transfer' then
    raise exception 'The linked order is not a Bank Transfer order.';
  end if;
  if coalesce(v_order.payment_status, '') = 'Paid' then
    raise exception 'This order is already marked as paid.';
  end if;

  if v_decision = 'Approved' then
    if lower(coalesce(v_order.status, '')) = 'cancelled' then
      raise exception 'A cancelled order cannot be approved as paid.';
    end if;
    if v_order.payment_deadline_at is null
       or v_payment.submitted_at > v_order.payment_deadline_at then
      raise exception 'This receipt was not submitted within the 24-hour payment window. Check stock and resolve manually.';
    end if;
    if v_payment.amount <> v_order.total then
      raise exception 'The submitted amount no longer matches the order total.';
    end if;
    if not exists (
      select 1 from storage.objects s
      where s.bucket_id = 'lbm-bank-transfer-receipts'
        and s.name = v_payment.receipt_path
    ) then
      raise exception 'The receipt file is missing. Do not approve this submission.';
    end if;
    perform public.lbm_consume_order_inventory(v_order.id);
  else
    -- Rejected receipt may be corrected only while the original reservation
    -- remains valid. Once the deadline has passed, release it immediately.
    if v_order.payment_deadline_at is null
       or v_order.payment_deadline_at <= now() then
      update public.lbm_inventory_reservations
      set status = 'released', released_at = now()
      where order_id = v_order.id and status = 'active';
    end if;
  end if;

  update public.lbm_bank_transfer_payments
  set status = v_decision,
      admin_note = left(nullif(trim(coalesce(p_admin_note, '')), ''), 1000),
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = p_payment_id;

  update public.orders
  set payment_status = case when v_decision = 'Approved' then 'Paid' else 'Payment Rejected' end,
      payment_verified_at = case when v_decision = 'Approved' then now() else null end,
      payment_verified_by = case when v_decision = 'Approved' then auth.uid() else null end,
      updated_at = now()
  where id = v_payment.order_id;

  return jsonb_build_object(
    'success', true,
    'status', v_decision,
    'order_id', v_payment.order_id,
    'payment_status', case when v_decision = 'Approved' then 'Paid' else 'Payment Rejected' end
  );
end;
$$;

-- Do not expire an order if a receipt was submitted within its payment window
-- and is still awaiting admin verification.
create or replace function public.expire_lbm_bank_transfer_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_count integer := 0;
begin
  for v_order in
    select o.id
    from public.orders o
    where lower(coalesce(o.payment_method, '')) = 'bank transfer'
      and coalesce(o.payment_status, '') <> 'Paid'
      and lower(coalesce(o.status, '')) <> 'cancelled'
      and o.payment_deadline_at is not null
      and o.payment_deadline_at <= now()
      and not exists (
        select 1
        from public.lbm_bank_transfer_payments p
        where p.order_id = o.id
          and p.status = 'Pending Verification'
          and p.submitted_at <= o.payment_deadline_at
      )
    order by o.payment_deadline_at
    for update skip locked
  loop
    update public.orders
    set status = 'Cancelled',
        payment_status = 'Expired',
        updated_at = now()
    where id = v_order.id
      and coalesce(payment_status, '') <> 'Paid';

    update public.lbm_inventory_reservations
    set status = 'released', released_at = now()
    where order_id = v_order.id and status = 'active';

    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Any unpaid Bank Transfer cancellation releases its remaining reservation.
create or replace function public.lbm_release_cancelled_bank_transfer_reservation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(coalesce(new.payment_method, '')) = 'bank transfer'
     and lower(coalesce(new.status, '')) = 'cancelled'
     and coalesce(new.payment_status, '') <> 'Paid' then
    update public.lbm_inventory_reservations
    set status = 'released', released_at = now()
    where order_id = new.id and status = 'active';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lbm_release_cancelled_bank_transfer_reservation
  on public.orders;
create trigger trg_lbm_release_cancelled_bank_transfer_reservation
after update of status, payment_status on public.orders
for each row
when (lower(coalesce(new.status, '')) = 'cancelled')
execute function public.lbm_release_cancelled_bank_transfer_reservation();

revoke all on function public.lbm_release_cancelled_bank_transfer_reservation() from public, anon, authenticated;

-- Run expiry every five minutes; keep the existing Lay-Bay hourly job intact.
do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'lbm-bank-transfer-expiry-every-five-minutes'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'lbm-bank-transfer-expiry-every-five-minutes',
    '*/5 * * * *',
    'select public.expire_lbm_bank_transfer_orders();'
  );
end;
$$;

commit;
