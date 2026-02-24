-- Migration: Fix ledger_post_supplier_invoice trigger
-- Objective: Skip ledger posting for zero-total invoices and handle potential NULLs safely.

CREATE OR REPLACE FUNCTION public.ledger_post_supplier_invoice()
RETURNS TRIGGER AS $$
DECLARE
    v_total NUMERIC := 0;
    v_issue_date TIMESTAMPTZ;
    v_description TEXT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM public.reverse_document_movements('invoice', OLD.id, 'Supplier invoice deleted');
        PERFORM public.sync_requisition_erp_status(OLD.requisition_id);
        RETURN OLD;
    END IF;

    -- For inserts/updates, first clear old movements
    PERFORM public.reverse_document_movements('invoice', NEW.id, 'Supplier invoice changed');

    -- Calculate total from available fields, prioritizing total_final
    v_total := COALESCE(NEW.total_final, NEW.total, NEW.total_value, NEW.total_liquido + NEW.total_iva, 0);
    v_issue_date := COALESCE(NEW.issue_date::timestamptz, now());
    v_description := CONCAT('Supplier Invoice ', COALESCE(NEW.invoice_number, NEW.id::text));

    IF NEW.requisition_id IS NOT NULL THEN
        v_description := CONCAT(v_description, ' (REQ ', NEW.requisition_id::text, ')');
    END IF;

    -- CRITICAL FIX: Skip ledger posting if total is 0 or NULL to avoid financial_movements_single_side constraint violation
    IF v_total IS NOT NULL AND v_total > 0 THEN
        -- Invoice recognition: Debit expense / Credit supplier liability
        PERFORM public.post_financial_movement(
            v_issue_date, 'invoice', NEW.id, v_description,
            '62', NEW.cost_center_id, NEW.vehicle_id,
            v_total, 0,
            NEW.supplier_id, NEW.requisition_id
        );

        PERFORM public.post_financial_movement(
            v_issue_date, 'invoice', NEW.id, v_description,
            '21', NEW.cost_center_id, NEW.vehicle_id,
            0, v_total,
            NEW.supplier_id, NEW.requisition_id
        );

        IF COALESCE(NEW.payment_status, 'pending') = 'paid' THEN
            -- Payment: Debit supplier liability / Credit bank
            PERFORM public.post_financial_movement(
                now(), 'invoice', NEW.id, CONCAT('Payment - ', v_description),
                '21', NEW.cost_center_id, NEW.vehicle_id,
                v_total, 0,
                NEW.supplier_id, NEW.requisition_id
            );

            PERFORM public.post_financial_movement(
                now(), 'invoice', NEW.id, CONCAT('Payment - ', v_description),
                '12', NEW.cost_center_id, NEW.vehicle_id,
                0, v_total,
                NEW.supplier_id, NEW.requisition_id
            );
        END IF;
    END IF;

    PERFORM public.sync_requisition_erp_status(NEW.requisition_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
