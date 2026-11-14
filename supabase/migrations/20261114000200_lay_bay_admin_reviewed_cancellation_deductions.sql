-- LBM Lay-Bay: administrator-reviewed cancellation deductions.
-- No automatic percentage penalty. Each deduction must be individually justified.
DROP FUNCTION IF EXISTS public.review_lay_bay_refund(uuid, text, text);

CREATE OR REPLACE FUNCTION public.review_lay_bay_refund(
    p_refund_id uuid,
    p_decision text,
    p_deduction_amount numeric DEFAULT 0,
    p_deduction_reason text DEFAULT NULL,
    p_rejection_reason text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_admin_id uuid;
    v_refund public.lay_bay_refunds%ROWTYPE;
    v_refund_amount numeric;
BEGIN
    v_admin_id := auth.uid();

    IF v_admin_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.admin_users WHERE user_id = v_admin_id
    ) THEN
        RAISE EXCEPTION 'Administrator access required.';
    END IF;

    IF p_decision NOT IN ('approve', 'reject') THEN
        RAISE EXCEPTION 'Decision must be approve or reject.';
    END IF;

    SELECT * INTO v_refund
    FROM public.lay_bay_refunds
    WHERE id = p_refund_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cancellation/refund request not found.';
    END IF;

    IF v_refund.request_status NOT IN ('pending', 'under_review') THEN
        RAISE EXCEPTION 'This request has already been reviewed.';
    END IF;

    IF p_decision = 'reject' THEN
        IF p_rejection_reason IS NULL OR length(btrim(p_rejection_reason)) < 5 THEN
            RAISE EXCEPTION 'A clear rejection reason is required.';
        END IF;

        UPDATE public.lay_bay_refunds
        SET request_status = 'rejected',
            reviewed_by = v_admin_id,
            reviewed_at = now(),
            rejection_reason = btrim(p_rejection_reason),
            updated_at = now()
        WHERE id = p_refund_id;

        -- A rejected cancellation request returns the plan to active.
        UPDATE public.lay_bay_plans
        SET plan_status = CASE
                WHEN plan_status = 'cancellation_requested' THEN 'active'
                ELSE plan_status
            END,
            cancellation_requested_at = CASE
                WHEN plan_status = 'cancellation_requested' THEN NULL
                ELSE cancellation_requested_at
            END,
            updated_at = now()
        WHERE id = v_refund.plan_id;
    ELSE
        IF p_deduction_amount IS NULL OR p_deduction_amount < 0
           OR p_deduction_amount >= v_refund.total_deposited THEN
            RAISE EXCEPTION 'Deduction must be zero or less than the verified balance so a positive refund remains payable.';
        END IF;

        IF p_deduction_amount > 0
           AND (p_deduction_reason IS NULL OR length(btrim(p_deduction_reason)) < 10) THEN
            RAISE EXCEPTION 'A specific explanation is required for any deduction.';
        END IF;

        v_refund_amount := v_refund.total_deposited - p_deduction_amount;

        UPDATE public.lay_bay_refunds
        SET request_status = 'approved',
            proposed_deduction = p_deduction_amount,
            deduction_reason = CASE WHEN p_deduction_amount > 0
                                    THEN btrim(p_deduction_reason) ELSE NULL END,
            refund_amount = v_refund_amount,
            reviewed_by = v_admin_id,
            reviewed_at = now(),
            rejection_reason = NULL,
            updated_at = now()
        WHERE id = p_refund_id;

        UPDATE public.lay_bay_plans
        SET plan_status = CASE
                WHEN plan_status = 'cancellation_requested' THEN 'cancelled'
                ELSE plan_status
            END,
            cancelled_at = CASE
                WHEN plan_status = 'cancellation_requested' THEN now()
                ELSE cancelled_at
            END,
            updated_at = now()
        WHERE id = v_refund.plan_id;
    END IF;

    INSERT INTO public.lay_bay_audit_logs (
        actor_user_id, actor_role, action, entity_type, entity_id,
        description, old_values, new_values
    )
    VALUES (
        v_admin_id, 'admin',
        CASE WHEN p_decision = 'approve'
             THEN 'cancellation_refund_approved' ELSE 'cancellation_refund_rejected' END,
        'lay_bay_refund', p_refund_id,
        'Administrator individually reviewed a Lay-Bay cancellation/refund request.',
        jsonb_build_object(
            'request_status', v_refund.request_status,
            'verified_balance', v_refund.total_deposited
        ),
        jsonb_build_object(
            'request_status', CASE WHEN p_decision = 'approve' THEN 'approved' ELSE 'rejected' END,
            'deduction_amount', CASE WHEN p_decision = 'approve' THEN p_deduction_amount ELSE 0 END,
            'deduction_reason', CASE WHEN p_decision = 'approve' THEN p_deduction_reason ELSE NULL END,
            'refund_amount', CASE WHEN p_decision = 'approve' THEN v_refund_amount ELSE 0 END,
            'rejection_reason', p_rejection_reason
        )
    );

    RETURN CASE WHEN p_decision = 'approve'
        THEN 'Administrator decision recorded. The approved refund amount is ready for payment processing.'
        ELSE 'Cancellation/refund request rejected with the administrator reason recorded.'
    END;
END;
$function$;

REVOKE ALL ON FUNCTION public.review_lay_bay_refund(uuid, text, numeric, text, text)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_lay_bay_refund(uuid, text, numeric, text, text)
    TO authenticated;
