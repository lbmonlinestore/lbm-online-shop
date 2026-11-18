-- LBM Bank Transfer inventory reservation migration
-- Draft for review. NOT applied to Supabase.
-- Designed against the current public.orders/products/bank-transfer schema inspected 2026-11-18.
-- Apply only after staging verification and explicit production approval.

begin;

alter table public.orders
  add column if not exists payment_deadline_at timestamptz;

create table if not exists public.lbm_inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id bigint references public.orders(id) on delete restrict,
  lay_bay_plan_id uuid,
  product_id bigint not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  status text not null default 'active'
    check (status in ('active','consumed','released')),
  reserved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  released_at timestamptz,
  constraint lbm_inventory_reservation_one_source
    check (num_nonnulls(order_id, lay_bay_plan_id) = 1)
);

create unique index if not exists lbm_inventory_reservation_order_product_uq
  on public.lbm_inventory_reservations(order_id, product_id)
  where order_id is not null;

create unique index if not exists lbm_inventory_reservation_laybay_product_uq
  on public.lbm_inventory_reservations(lay_bay_plan_id, product_id)
  where lay_bay_plan_id is not null;

create index if not exists lbm_inventory_reservation_active_product_idx
  on public.lbm_inventory_reservations(product_id, expires_at)
  where status = 'active';

alter table public.lbm_inventory_reservations enable row level security;

revoke all on public.lbm_inventory_reservations from anon, authenticated;
grant select on public.lbm_inventory_reservations to authenticated;

drop policy if exists lbm_inventory_reservations_admin_read
  on public.lbm_inventory_reservations;
create policy lbm_inventory_reservations_admin_read
  on public.lbm_inventory_reservations
  for select to authenticated
  using (exists (
    select 1 from public.admin_users a where a.user_id = auth.uid()
  ));

-- An AFTER INSERT trigger makes reservation creation atomic with the existing
-- create_lbm_bank_transfer_order RPC without changing its customer-facing API.
create or replace function public.lbm_reserve_bank_transfer_order_inventory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_line record;
  v_stock integer;
  v_reserved bigint;
begin
  if lower(coalesce(new.payment_method, '')) <> 'bank transfer' then
    return new;
  end if;

  -- Aggregate duplicate cart lines. Lock product rows in stable order.
  for v_line in
    select (x.value->>'product_id')::bigint as product_id,
           sum((x.value->>'quantity')::bigint)::integer as quantity
    from jsonb_array_elements(new.items) x(value)
    group by (x.value->>'product_id')::bigint
    order by (x.value->>'product_id')::bigint
  loop
    select p.stock into v_stock
    from public.products p
    where p.id = v_line.product_id
    for update;

    if not found then
      raise exception 'A product is no longer available.';
    end if;

    select coalesce(sum(r.quantity), 0) into v_reserved
    from public.lbm_inventory_reservations r
    where r.product_id = v_line.product_id
      and r.status = 'active'
      and r.expires_at > now();

    if v_line.quantity > v_stock - v_reserved then
      raise exception 'Insufficient available stock for product ID %.', v_line.product_id;
    end if;
  end loop;

  new.payment_deadline_at := coalesce(new.payment_deadline_at, now() + interval '24 hours');

  for v_line in
    select (x.value->>'product_id')::bigint as product_id,
           sum((x.value->>'quantity')::bigint)::integer as quantity
    from jsonb_array_elements(new.items) x(value)
    group by (x.value->>'product_id')::bigint
    order by (x.value->>'product_id')::bigint
  loop
    insert into public.lbm_inventory_reservations
      (order_id, product_id, quantity, expires_at)
    values
      (new.id, v_line.product_id, v_line.quantity, new.payment_deadline_at)
    on conflict (order_id, product_id) where order_id is not null
    do nothing;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_lbm_reserve_bank_transfer_inventory on public.orders;
create trigger trg_lbm_reserve_bank_transfer_inventory
before insert on public.orders
for each row
execute function public.lbm_reserve_bank_transfer_order_inventory();

-- Consume a reservation and decrement physical stock exactly once.
create or replace function public.lbm_consume_order_inventory(p_order_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_res record;
begin
  for v_res in
    select r.id, r.product_id, r.quantity
    from public.lbm_inventory_reservations r
    where r.order_id = p_order_id and r.status = 'active'
    order by r.product_id
    for update
  loop
    update public.products p
    set stock = p.stock - v_res.quantity,
        updated_at = now()
    where p.id = v_res.product_id
      and p.stock >= v_res.quantity;

    if not found then
      raise exception 'Reserved stock is no longer available; payment approval was not completed.';
    end if;

    update public.lbm_inventory_reservations
    set status = 'consumed', consumed_at = now()
    where id = v_res.id and status = 'active';
  end loop;

  if not exists (
    select 1 from public.lbm_inventory_reservations r
    where r.order_id = p_order_id and r.status = 'consumed'
  ) then
    raise exception 'No active inventory reservation exists for this order.';
  end if;
end;
$$;

-- Replaces the existing review RPC, retaining its current validation and
-- adding deadline/reservation consumption inside the same transaction.
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
    if v_order.payment_deadline_at is null or v_order.payment_deadline_at <= now() then
      raise exception 'The 24-hour reservation has expired. Check stock and resolve this payment manually.';
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

-- Expire unpaid Bank Transfer orders and release reservations. Safe to rerun.
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

revoke all on function public.lbm_reserve_bank_transfer_order_inventory() from public, anon, authenticated;
revoke all on function public.lbm_consume_order_inventory(bigint) from public, anon, authenticated;
revoke all on function public.expire_lbm_bank_transfer_orders() from public, anon, authenticated;
grant execute on function public.lbm_consume_order_inventory(bigint) to service_role;
grant execute on function public.expire_lbm_bank_transfer_orders() to service_role;

commit;

-- IMPORTANT REVIEW NOTES:
-- 1. This migration is a draft, not applied.
-- 2. Existing create_lbm_bank_transfer_order already inserts Bank Transfer orders;
--    the BEFORE INSERT trigger reserves stock in the same transaction.
-- 3. Existing submit_lbm_bank_transfer must also be replaced to reject submissions
--    when payment_deadline_at <= now(). That exact replacement is intentionally
--    not included until the RPC's token lifecycle is reviewed with the frontend.
-- 4. Schedule expire_lbm_bank_transfer_orders() only after deciding whether to
--    reuse the existing pg_cron schedule and verifying the project's cron setup.
-- 5. A failed approval rolls back the stock decrement and payment/order updates.
