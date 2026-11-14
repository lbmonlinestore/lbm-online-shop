-- Extend the permitted plan states for the initial-deposit activation stage.
ALTER TABLE public.lay_bay_plans
    DROP CONSTRAINT IF EXISTS lay_bay_plans_plan_status_check;

ALTER TABLE public.lay_bay_plans
    ADD CONSTRAINT lay_bay_plans_plan_status_check
    CHECK (plan_status = ANY (ARRAY[
        'pending_initial_deposit'::text,
        'active'::text,
        'completed'::text,
        'fulfilled'::text,
        'cancellation_requested'::text,
        'cancelled'::text,
        'expired'::text,
        'unavailable'::text
    ]));

-- LBM Lay-Bay manual pricing and 50% initial deposit policy.
-- Apply after the integration branch has been reviewed and approved.
-- Keep the Lay-Bay price synchronized with the normal shop price.
-- Existing product prices are recalculated at 22% above the normal price.
CREATE OR REPLACE FUNCTION public.set_lay_bay_price_22_percent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
    IF NEW.price IS NULL THEN
        NEW.lay_bay_price := NULL;
    ELSE
        NEW.lay_bay_price := pg_catalog.round(NEW.price * 1.22, 2);
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_products_lay_bay_price_22_percent
ON public.products;

CREATE TRIGGER trg_products_lay_bay_price_22_percent
BEFORE INSERT OR UPDATE OF price
ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.set_lay_bay_price_22_percent();

UPDATE public.products
SET lay_bay_price = pg_catalog.round(price * 1.22, 2)
WHERE price IS NOT NULL;

-- New plans remain pending_initial_deposit until a qualifying first payment
-- is approved by an administrator. The 45-day countdown begins at approval.

CREATE OR REPLACE FUNCTION public.create_lay_bay_plan(p_product_id bigint)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_user_id uuid;
    v_product_name text;
    v_normal_price numeric;
    v_lay_bay_price numeric;
    v_stock integer;
    v_enabled boolean;
    v_plan_id uuid;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION
            'You must sign in before creating a Lay-Bay plan.';
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(
            v_user_id::text || ':' || p_product_id::text,
            0
        )
    );

    -- Reuse an existing plan awaiting its first deposit or already active.
    SELECT lp.id
    INTO v_plan_id
    FROM public.lay_bay_plans AS lp
    WHERE lp.user_id = v_user_id
      AND lp.product_id = p_product_id
      AND lower(lp.plan_status) IN ('active', 'pending_initial_deposit')
    ORDER BY
        EXISTS (
            SELECT 1
            FROM public.lay_bay_deposits AS d
            WHERE d.plan_id = lp.id
              AND lower(d.verification_status) = 'approved'
        ) DESC,
        lp.created_at ASC
    LIMIT 1;

    IF FOUND THEN
        RETURN v_plan_id;
    END IF;

    -- Read and lock the current main-store product.
    SELECT
        p.name,
        p.price,
        p.lay_bay_price,
        p.stock,
        p.lay_bay_enabled
    INTO
        v_product_name,
        v_normal_price,
        v_lay_bay_price,
        v_stock,
        v_enabled
    FROM public.products AS p
    WHERE p.id = p_product_id
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'The selected product does not exist.';
    END IF;

    IF NOT COALESCE(v_enabled, false) THEN
        RAISE EXCEPTION
            'This product is not enabled for Lay-Bay.';
    END IF;

    IF v_stock IS NULL OR v_stock <= 0 THEN
        RAISE EXCEPTION
            'This product is currently out of stock.';
    END IF;

    IF v_normal_price IS NULL OR v_normal_price <= 0 THEN
        RAISE EXCEPTION
            'The normal product price is invalid.';
    END IF;

    -- Use the Lay-Bay price explicitly configured by an administrator.
    IF v_lay_bay_price IS NULL OR v_lay_bay_price <= v_normal_price THEN
        RAISE EXCEPTION
            'This product does not have a valid Lay-Bay price configured.';
    END IF;

    INSERT INTO public.lay_bay_plans (
        user_id,
        product_id,
        product_name_snapshot,
        normal_price_snapshot,
        lay_bay_price_snapshot,
        currency,
        plan_status
    )
    VALUES (
        v_user_id,
        p_product_id,
        v_product_name,
        v_normal_price,
        v_lay_bay_price,
        'ZMW',
        'pending_initial_deposit'
    )
    RETURNING id INTO v_plan_id;

    RETURN v_plan_id;
END;
$function$;


CREATE OR REPLACE FUNCTION public.create_lay_bay_plan(p_product_id bigint, p_selected_size text, p_selected_colour text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_user_id uuid;
    v_product_name text;
    v_normal_price numeric;
    v_lay_bay_price numeric;
    v_stock integer;
    v_enabled boolean;
    v_available_sizes jsonb;
    v_available_colours jsonb;
    v_raw_sizes text[];
    v_allowed_sizes text[] := ARRAY[]::text[];
    v_allowed_colours text[] := ARRAY[]::text[];
    v_selected_size text;
    v_selected_colour text;
    v_plan_id uuid;
    v_i integer := 1;
    v_item text;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION
            'You must sign in before creating a Lay-Bay plan.';
    END IF;

    IF p_product_id IS NULL THEN
        RAISE EXCEPTION 'A product must be selected.';
    END IF;

    v_selected_size := NULLIF(pg_catalog.btrim(p_selected_size), '');
    v_selected_colour := NULLIF(pg_catalog.btrim(p_selected_colour), '');

    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(
            v_user_id::text || ':' || p_product_id::text,
            0
        )
    );

    -- Read and lock the current main-store product.
    SELECT
        p.name,
        p.price,
        p.lay_bay_price,
        p.stock,
        p.lay_bay_enabled,
        p.available_sizes,
        p.available_colours
    INTO
        v_product_name,
        v_normal_price,
        v_lay_bay_price,
        v_stock,
        v_enabled,
        v_available_sizes,
        v_available_colours
    FROM public.products AS p
    WHERE p.id = p_product_id
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'The selected product does not exist.';
    END IF;

    IF NOT COALESCE(v_enabled, false) THEN
        RAISE EXCEPTION
            'This product is not enabled for Lay-Bay.';
    END IF;

    IF v_stock IS NULL OR v_stock <= 0 THEN
        RAISE EXCEPTION
            'This product is currently out of stock.';
    END IF;

    IF v_normal_price IS NULL OR v_normal_price <= 0 THEN
        RAISE EXCEPTION
            'The normal product price is invalid.';
    END IF;

    -- Read the size options.
    IF pg_catalog.jsonb_typeof(v_available_sizes) = 'array' THEN
        SELECT COALESCE(
            pg_catalog.array_agg(pg_catalog.upper(pg_catalog.btrim(x))),
            ARRAY[]::text[]
        )
        INTO v_raw_sizes
        FROM pg_catalog.jsonb_array_elements_text(
            v_available_sizes
        ) AS t(x);
    ELSE
        v_raw_sizes := ARRAY[]::text[];
    END IF;

    -- Expand recognised ranges and retain genuine individual sizes.
    WHILE v_i <= pg_catalog.cardinality(v_raw_sizes) LOOP
        IF v_i + 2 <= pg_catalog.cardinality(v_raw_sizes)
           AND v_raw_sizes[v_i] = 'MEDIUM'
           AND v_raw_sizes[v_i + 1] = 'TO'
           AND v_raw_sizes[v_i + 2] = '3XL' THEN

            v_allowed_sizes := v_allowed_sizes ||
                ARRAY['MEDIUM','LARGE','XL','2XL','3XL'];
            v_i := v_i + 3;

        ELSIF v_i + 2 <= pg_catalog.cardinality(v_raw_sizes)
           AND v_raw_sizes[v_i] = 'SMALL'
           AND v_raw_sizes[v_i + 1] = '_'
           AND v_raw_sizes[v_i + 2] = '4XL' THEN

            v_allowed_sizes := v_allowed_sizes ||
                ARRAY['SMALL','MEDIUM','LARGE','XL','2XL','3XL','4XL'];
            v_i := v_i + 3;

        ELSIF v_i + 2 <= pg_catalog.cardinality(v_raw_sizes)
           AND v_raw_sizes[v_i] = 'M'
           AND v_raw_sizes[v_i + 1] = 'TO'
           AND v_raw_sizes[v_i + 2] = '3XL' THEN

            v_allowed_sizes := v_allowed_sizes ||
                ARRAY['M','L','XL','2XL','3XL'];
            v_i := v_i + 3;

        ELSE
            v_item := v_raw_sizes[v_i];

            IF v_item NOT IN (
                '', '_', 'TO', 'FOR', 'THE',
                'CHILDREN', 'AGES', 'FIVE',
                'THIRTEEN', 'YEARS'
            ) THEN
                v_allowed_sizes := pg_catalog.array_append(
                    v_allowed_sizes,
                    v_item
                );
            END IF;

            v_i := v_i + 1;
        END IF;
    END LOOP;

    -- Read genuine colour options.
    IF pg_catalog.jsonb_typeof(v_available_colours) = 'array' THEN
        SELECT COALESCE(
            pg_catalog.array_agg(pg_catalog.btrim(x)),
            ARRAY[]::text[]
        )
        INTO v_allowed_colours
        FROM pg_catalog.jsonb_array_elements_text(
            v_available_colours
        ) AS t(x)
        WHERE pg_catalog.btrim(x) <> ''
          AND pg_catalog.lower(pg_catalog.btrim(x))
              <> 'as seen in pictures';
    END IF;

    -- Validate required size.
    IF pg_catalog.cardinality(v_allowed_sizes) > 0 THEN
        IF v_selected_size IS NULL THEN
            RAISE EXCEPTION 'Please select a product size.';
        END IF;

        IF NOT (
            pg_catalog.upper(v_selected_size)
            = ANY(v_allowed_sizes)
        ) THEN
            RAISE EXCEPTION
                'The selected size is not available for this product.';
        END IF;
    ELSIF v_selected_size IS NOT NULL THEN
        RAISE EXCEPTION
            'This product does not have selectable sizes.';
    END IF;

    -- Validate required colour.
    IF pg_catalog.cardinality(v_allowed_colours) > 0 THEN
        IF v_selected_colour IS NULL THEN
            RAISE EXCEPTION 'Please select a product colour.';
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_catalog.unnest(v_allowed_colours) AS c(value)
            WHERE pg_catalog.lower(c.value)
                = pg_catalog.lower(v_selected_colour)
        ) THEN
            RAISE EXCEPTION
                'The selected colour is not available for this product.';
        END IF;
    ELSIF v_selected_colour IS NOT NULL THEN
        RAISE EXCEPTION
            'This product does not have selectable colours.';
    END IF;

    -- Reuse a pending-initial-deposit or active plan with matching variants.
    SELECT lp.id
    INTO v_plan_id
    FROM public.lay_bay_plans AS lp
    WHERE lp.user_id = v_user_id
      AND lp.product_id = p_product_id
      AND lp.selected_size IS NOT DISTINCT FROM v_selected_size
      AND lp.selected_colour IS NOT DISTINCT FROM v_selected_colour
      AND pg_catalog.lower(lp.plan_status) IN ('active', 'pending_initial_deposit')
    ORDER BY
        EXISTS (
            SELECT 1
            FROM public.lay_bay_deposits AS d
            WHERE d.plan_id = lp.id
              AND pg_catalog.lower(d.verification_status) = 'approved'
        ) DESC,
        lp.created_at ASC
    LIMIT 1;

    IF FOUND THEN
        RETURN v_plan_id;
    END IF;

    -- Use the Lay-Bay price explicitly configured by an administrator.
    IF v_lay_bay_price IS NULL OR v_lay_bay_price <= v_normal_price THEN
        RAISE EXCEPTION
            'This product does not have a valid Lay-Bay price configured.';
    END IF;

    INSERT INTO public.lay_bay_plans (
        user_id,
        product_id,
        product_name_snapshot,
        normal_price_snapshot,
        lay_bay_price_snapshot,
        currency,
        selected_size,
        selected_colour,
        plan_status
    )
    VALUES (
        v_user_id,
        p_product_id,
        v_product_name,
        v_normal_price,
        v_lay_bay_price,
        'ZMW',
        v_selected_size,
        v_selected_colour,
        'pending_initial_deposit'
    )
    RETURNING id INTO v_plan_id;

    RETURN v_plan_id;
END;
$function$;


CREATE OR REPLACE FUNCTION public.submit_lay_bay_deposit(p_plan_id uuid, p_amount numeric, p_payment_method text, p_payment_reference text, p_proof_url text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_user_id uuid;
    v_plan RECORD;
    v_balance numeric;
    v_pending numeric;
    v_available numeric;
    v_deposit_id uuid;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'You must sign in first.';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Deposit amount must be greater than zero.';
    END IF;

    IF p_payment_method IS NULL
       OR BTRIM(p_payment_method) = '' THEN
        RAISE EXCEPTION 'Payment method is required.';
    END IF;

    IF p_payment_reference IS NULL
       OR BTRIM(p_payment_reference) = '' THEN
        RAISE EXCEPTION 'Payment reference is required.';
    END IF;

    IF LENGTH(BTRIM(p_payment_method)) > 50
       OR LENGTH(BTRIM(p_payment_reference)) > 150 THEN
        RAISE EXCEPTION 'Payment details are too long.';
    END IF;

    -- Lock the customer's plan to prevent simultaneous
    -- submissions from exceeding the outstanding balance.
    SELECT *
    INTO v_plan
    FROM public.lay_bay_plans
    WHERE id = p_plan_id
      AND user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lay-Bay plan not found.';
    END IF;

    IF v_plan.plan_status NOT IN ('active', 'pending_initial_deposit') THEN
        RAISE EXCEPTION 'Deposits can only be submitted for eligible Lay-Bay plans.';
    END IF;

    IF v_plan.expires_at IS NOT NULL
       AND v_plan.expires_at <= NOW() THEN
        RAISE EXCEPTION 'This Lay-Bay plan has expired.';
    END IF;

    -- Calculate approved ledger balance.
    SELECT COALESCE(
        SUM(
            CASE
                WHEN entry_type = 'credit' THEN amount
                WHEN entry_type = 'debit' THEN -amount
                ELSE 0
            END
        ),
        0
    )
    INTO v_balance
    FROM public.lay_bay_ledger
    WHERE plan_id = p_plan_id;

    -- Reserve amounts already awaiting administrator verification.
    SELECT COALESCE(SUM(amount), 0)
    INTO v_pending
    FROM public.lay_bay_deposits
    WHERE plan_id = p_plan_id
      AND verification_status = 'pending';

    v_available :=
        v_plan.lay_bay_price_snapshot
        - v_balance
        - v_pending;

    IF v_available <= 0 THEN
        RAISE EXCEPTION
            'There is no remaining amount available for another deposit.';
    END IF;

    IF v_plan.first_deposit_at IS NULL AND v_pending > 0 THEN
        RAISE EXCEPTION
            'Your first deposit is awaiting verification. Please wait before submitting another deposit.';
    END IF;

    IF v_plan.first_deposit_at IS NULL
       AND p_amount < pg_catalog.round(v_plan.lay_bay_price_snapshot * 0.50, 2) THEN
        RAISE EXCEPTION
            'The first deposit must be at least 50%% of the Lay-Bay price (ZMW %).',
            pg_catalog.round(v_plan.lay_bay_price_snapshot * 0.50, 2);
    END IF;

    IF p_amount > v_available THEN
        RAISE EXCEPTION
            'Deposit exceeds the available remaining amount of % ZMW.',
            ROUND(v_available, 2);
    END IF;

    INSERT INTO public.lay_bay_deposits (
        plan_id,
        user_id,
        amount,
        currency,
        payment_method,
        payment_reference,
        proof_url,
        verification_status
    )
    VALUES (
        p_plan_id,
        v_user_id,
        p_amount,
        'ZMW',
        BTRIM(p_payment_method),
        BTRIM(p_payment_reference),
        NULLIF(BTRIM(p_proof_url), ''),
        'pending'
    )
    RETURNING id INTO v_deposit_id;

    RETURN v_deposit_id;
END;
$function$;


CREATE OR REPLACE FUNCTION public.review_lay_bay_deposit(p_deposit_id uuid, p_decision text, p_rejection_reason text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_admin_id UUID;
    v_deposit RECORD;
    v_plan RECORD;
    v_balance NUMERIC;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    v_admin_id := auth.uid();

    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.admin_users
        WHERE user_id = v_admin_id
    ) THEN
        RAISE EXCEPTION 'Administrator access required.';
    END IF;

    IF p_decision NOT IN ('approve', 'reject') THEN
        RAISE EXCEPTION 'Decision must be approve or reject.';
    END IF;

    IF p_decision = 'reject'
       AND NULLIF(BTRIM(p_rejection_reason), '') IS NULL THEN
        RAISE EXCEPTION 'A rejection reason is required.';
    END IF;

    SELECT *
    INTO v_deposit
    FROM public.lay_bay_deposits
    WHERE id = p_deposit_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Deposit not found.';
    END IF;

    IF v_deposit.verification_status <> 'pending' THEN
        RAISE EXCEPTION 'This deposit has already been reviewed.';
    END IF;

    SELECT *
    INTO v_plan
    FROM public.lay_bay_plans
    WHERE id = v_deposit.plan_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Associated plan not found.';
    END IF;

    IF v_plan.user_id <> v_deposit.user_id THEN
        RAISE EXCEPTION 'Deposit and plan ownership mismatch.';
    END IF;

    IF p_decision = 'reject' THEN

        UPDATE public.lay_bay_deposits
        SET
            verification_status = 'rejected',
            verified_by = v_admin_id,
            verified_at = v_now,
            rejection_reason = BTRIM(p_rejection_reason)
        WHERE id = p_deposit_id;

        INSERT INTO public.lay_bay_audit_logs (
            actor_user_id,
            actor_role,
            action,
            entity_type,
            entity_id,
            description,
            new_values
        )
        VALUES (
            v_admin_id,
            'admin',
            'deposit_rejected',
            'lay_bay_deposit',
            p_deposit_id,
            'Lay-Bay deposit rejected.',
            jsonb_build_object(
                'status', 'rejected',
                'reason', BTRIM(p_rejection_reason)
            )
        );

        RETURN 'Deposit rejected successfully.';
    END IF;

    IF v_plan.plan_status NOT IN ('active', 'pending_initial_deposit') THEN
        RAISE EXCEPTION 'This plan is not eligible for deposit approval.';
    END IF;

    SELECT COALESCE(
        SUM(
            CASE
                WHEN entry_type = 'credit' THEN amount
                ELSE -amount
            END
        ),
        0
    )
    INTO v_balance
    FROM public.lay_bay_ledger
    WHERE plan_id = v_plan.id;

    IF v_plan.first_deposit_at IS NULL
       AND v_deposit.amount < pg_catalog.round(v_plan.lay_bay_price_snapshot * 0.50, 2) THEN
        RAISE EXCEPTION
            'The first approved deposit must be at least 50%% of the Lay-Bay price (ZMW %).',
            pg_catalog.round(v_plan.lay_bay_price_snapshot * 0.50, 2);
    END IF;

    IF v_deposit.amount > (v_plan.lay_bay_price_snapshot - v_balance) THEN
        RAISE EXCEPTION 'Deposit exceeds the outstanding plan balance.';
    END IF;

    UPDATE public.lay_bay_deposits
    SET
        verification_status = 'approved',
        verified_by = v_admin_id,
        verified_at = v_now,
        rejection_reason = NULL
    WHERE id = p_deposit_id;

    INSERT INTO public.lay_bay_ledger (
        plan_id,
        user_id,
        entry_type,
        amount,
        currency,
        source_type,
        source_id,
        description,
        recorded_by
    )
    VALUES (
        v_plan.id,
        v_deposit.user_id,
        'credit',
        v_deposit.amount,
        v_deposit.currency,
        'deposit',
        v_deposit.id,
        'Verified Lay-Bay deposit.',
        v_admin_id
    );

    v_balance := v_balance + v_deposit.amount;

    UPDATE public.lay_bay_plans
    SET
        first_deposit_at = COALESCE(first_deposit_at, v_now),
        expires_at = COALESCE(
            expires_at,
            v_now + INTERVAL '45 days'
        ),
        plan_status = CASE
            WHEN v_balance >= lay_bay_price_snapshot
                THEN 'completed'
            WHEN first_deposit_at IS NULL
                THEN 'active'
            ELSE plan_status
        END,
        completed_at = CASE
            WHEN v_balance >= lay_bay_price_snapshot
                THEN v_now
            ELSE completed_at
        END,
        updated_at = v_now
    WHERE id = v_plan.id;

    INSERT INTO public.lay_bay_audit_logs (
        actor_user_id,
        actor_role,
        action,
        entity_type,
        entity_id,
        description,
        new_values
    )
    VALUES (
        v_admin_id,
        'admin',
        'deposit_approved',
        'lay_bay_deposit',
        p_deposit_id,
        'Lay-Bay deposit approved and credited to the ledger.',
        jsonb_build_object(
            'status', 'approved',
            'amount', v_deposit.amount,
            'plan_id', v_plan.id,
            'new_balance', v_balance
        )
    );

    RETURN 'Deposit approved and ledger credited successfully.';
END;
$function$;