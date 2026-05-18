-- ERP Accounting-First Ledger (immutable, double-entry)
-- Evolves existing financial_movements table to be the single source of truth.

CREATE TABLE IF NOT EXISTS public.financial_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date TIMESTAMPTZ NOT NULL DEFAULT now(),
    document_type TEXT NOT NULL,
    document_id UUID NOT NULL DEFAULT gen_random_uuid(),
    description TEXT NOT NULL DEFAULT '',
    amount NUMERIC NOT NULL DEFAULT 0,
    type TEXT NOT NULL DEFAULT 'expense',
    cost_center_id UUID NULL,
    vehicle_id UUID NULL,
    account_code TEXT NOT NULL DEFAULT '60',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supplier_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NULL,
    requisition_id UUID NULL,
    invoice_number TEXT,
    issue_date DATE,
    total NUMERIC DEFAULT 0,
    total_final NUMERIC DEFAULT 0,
    total_value NUMERIC DEFAULT 0,
    payment_status TEXT DEFAULT 'pending',
    cost_center_id UUID NULL,
    vehicle_id UUID NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.financial_movements
    ADD COLUMN IF NOT EXISTS debit NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS credit NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS account_name TEXT,
    ADD COLUMN IF NOT EXISTS supplier_id UUID NULL,
    ADD COLUMN IF NOT EXISTS source_requisition_id UUID NULL,
    ADD COLUMN IF NOT EXISTS is_reversal BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS reversal_of UUID NULL;

ALTER TABLE public.financial_movements
    DROP CONSTRAINT IF EXISTS financial_movements_reversal_of_fkey;

ALTER TABLE public.financial_movements
    ADD CONSTRAINT financial_movements_reversal_of_fkey
        FOREIGN KEY (reversal_of)
        REFERENCES public.financial_movements(id)
        ON DELETE RESTRICT;

-- Normalize datatypes to ERP model
ALTER TABLE public.financial_movements
    ALTER COLUMN date TYPE TIMESTAMPTZ USING (date::timestamptz),
    ALTER COLUMN document_id TYPE UUID USING (
        CASE
            WHEN document_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN document_id::uuid
            ELSE gen_random_uuid()
        END
    ),
    ALTER COLUMN cost_center_id TYPE UUID USING (
        CASE
            WHEN cost_center_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN cost_center_id::uuid
            ELSE NULL
        END
    ),
    ALTER COLUMN vehicle_id TYPE UUID USING (
        CASE
            WHEN vehicle_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN vehicle_id::uuid
            ELSE NULL
        END
    );

-- Move legacy amount values to debit/credit if needed
UPDATE public.financial_movements
SET
    debit = CASE
        WHEN debit = 0 AND credit = 0 AND COALESCE(type, 'expense') = 'expense' THEN COALESCE(amount, 0)
        ELSE debit
    END,
    credit = CASE
        WHEN credit = 0 AND debit = 0 AND COALESCE(type, 'expense') = 'revenue' THEN COALESCE(amount, 0)
        ELSE credit
    END
WHERE debit = 0 AND credit = 0 AND COALESCE(amount, 0) <> 0;

ALTER TABLE public.financial_movements
    DROP COLUMN IF EXISTS amount;

ALTER TABLE public.financial_movements
    ADD COLUMN amount NUMERIC GENERATED ALWAYS AS (debit - credit) STORED;

ALTER TABLE public.financial_movements
    DROP COLUMN IF EXISTS type,
    DROP COLUMN IF EXISTS updated_at;

ALTER TABLE public.financial_movements
    DROP CONSTRAINT IF EXISTS financial_movements_document_type_check;

ALTER TABLE public.financial_movements
    ADD CONSTRAINT financial_movements_document_type_check
        CHECK (document_type IN ('invoice', 'requisition', 'fuel', 'expense', 'adjustment'));

-- Accounting model accounts
ALTER TABLE public.financial_movements
    DROP CONSTRAINT IF EXISTS financial_movements_account_code_check;

ALTER TABLE public.financial_movements
    ADD CONSTRAINT financial_movements_account_code_check
        CHECK (account_code IN ('12', '21', '60', '61', '62', '63', '64', '70', '71', '72'));

ALTER TABLE public.financial_movements
    ADD CONSTRAINT financial_movements_debit_credit_non_negative
        CHECK (debit >= 0 AND credit >= 0) NOT VALID,
    ADD CONSTRAINT financial_movements_single_side
        CHECK ((debit = 0 AND credit > 0) OR (credit = 0 AND debit > 0)) NOT VALID;

DROP INDEX IF EXISTS idx_financial_movements_document;
CREATE INDEX IF NOT EXISTS idx_financial_movements_document
    ON public.financial_movements(document_type, document_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_financial_movements_account_code
    ON public.financial_movements(account_code);

CREATE INDEX IF NOT EXISTS idx_financial_movements_source_req
    ON public.financial_movements(source_requisition_id);

CREATE INDEX IF NOT EXISTS idx_financial_movements_reversal_of
    ON public.financial_movements(reversal_of);

-- Optional FK relationships (safe if related rows removed)
ALTER TABLE public.financial_movements
    DROP CONSTRAINT IF EXISTS financial_movements_supplier_id_fkey,
    DROP CONSTRAINT IF EXISTS financial_movements_cost_center_id_fkey,
    DROP CONSTRAINT IF EXISTS financial_movements_vehicle_id_fkey,
    DROP CONSTRAINT IF EXISTS financial_movements_source_requisition_id_fkey;

ALTER TABLE public.financial_movements
    ADD CONSTRAINT financial_movements_supplier_id_fkey
        FOREIGN KEY (supplier_id) REFERENCES public.fornecedores(id) ON DELETE SET NULL,
    ADD CONSTRAINT financial_movements_cost_center_id_fkey
        FOREIGN KEY (cost_center_id) REFERENCES public.centros_custos(id) ON DELETE SET NULL,
    ADD CONSTRAINT financial_movements_vehicle_id_fkey
        FOREIGN KEY (vehicle_id) REFERENCES public.viaturas(id) ON DELETE SET NULL,
    ADD CONSTRAINT financial_movements_source_requisition_id_fkey
        FOREIGN KEY (source_requisition_id) REFERENCES public.requisicoes(id) ON DELETE SET NULL;

-- Immutability: no updates/deletes, only insert + reversal entries
CREATE OR REPLACE FUNCTION public.financial_movements_immutable_guard()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'financial_movements is immutable; use reversal/adjustment entries';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_financial_movements_no_update ON public.financial_movements;
CREATE TRIGGER trg_financial_movements_no_update
    BEFORE UPDATE ON public.financial_movements
    FOR EACH ROW
    EXECUTE FUNCTION public.financial_movements_immutable_guard();

DROP TRIGGER IF EXISTS trg_financial_movements_no_delete ON public.financial_movements;
CREATE TRIGGER trg_financial_movements_no_delete
    BEFORE DELETE ON public.financial_movements
    FOR EACH ROW
    EXECUTE FUNCTION public.financial_movements_immutable_guard();

CREATE OR REPLACE FUNCTION public.erp_account_name(p_account_code TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN CASE p_account_code
        WHEN '12' THEN 'Bank'
        WHEN '21' THEN 'Suppliers'
        WHEN '60' THEN 'Costs'
        WHEN '61' THEN 'Fuel'
        WHEN '62' THEN 'Maintenance'
        WHEN '63' THEN 'Tolls'
        WHEN '64' THEN 'External Services'
        WHEN '70' THEN 'Revenue'
        WHEN '71' THEN 'Rentals'
        WHEN '72' THEN 'Services'
        ELSE p_account_code
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.post_financial_movement(
    p_date TIMESTAMPTZ,
    p_document_type TEXT,
    p_document_id UUID,
    p_description TEXT,
    p_account_code TEXT,
    p_cost_center_id UUID,
    p_vehicle_id UUID,
    p_debit NUMERIC,
    p_credit NUMERIC,
    p_supplier_id UUID,
    p_source_requisition_id UUID,
    p_is_reversal BOOLEAN DEFAULT false,
    p_reversal_of UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.financial_movements (
        date,
        document_type,
        document_id,
        description,
        account_code,
        account_name,
        cost_center_id,
        vehicle_id,
        debit,
        credit,
        supplier_id,
        source_requisition_id,
        is_reversal,
        reversal_of
    ) VALUES (
        p_date,
        p_document_type,
        p_document_id,
        p_description,
        p_account_code,
        public.erp_account_name(p_account_code),
        p_cost_center_id,
        p_vehicle_id,
        p_debit,
        p_credit,
        p_supplier_id,
        p_source_requisition_id,
        p_is_reversal,
        p_reversal_of
    ) RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.reverse_document_movements(
    p_document_type TEXT,
    p_document_id UUID,
    p_reason TEXT
)
RETURNS VOID AS $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN
        SELECT fm.*
        FROM public.financial_movements fm
        WHERE fm.document_type = p_document_type
          AND fm.document_id = p_document_id
          AND fm.is_reversal = false
          AND NOT EXISTS (
              SELECT 1
              FROM public.financial_movements rv
              WHERE rv.reversal_of = fm.id
          )
    LOOP
        PERFORM public.post_financial_movement(
            now(),
            'adjustment',
            p_document_id,
            CONCAT('Reversal: ', p_reason, ' | ', rec.description),
            rec.account_code,
            rec.cost_center_id,
            rec.vehicle_id,
            rec.credit,
            rec.debit,
            rec.supplier_id,
            rec.source_requisition_id,
            true,
            rec.id
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Requisition ERP statuses
ALTER TABLE public.requisicoes
    ADD COLUMN IF NOT EXISTS erp_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (erp_status IN ('pending', 'awaiting_invoice', 'invoiced', 'closed')),
    ADD COLUMN IF NOT EXISTS approved_value NUMERIC,
    ADD COLUMN IF NOT EXISTS financial_status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (financial_status IN ('PENDING', 'PARTIAL', 'INVOICED')),
    ADD COLUMN IF NOT EXISTS total_invoiced_amount NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS itens JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_requisicoes_erp_status
    ON public.requisicoes(erp_status);

CREATE OR REPLACE FUNCTION public.requisition_estimated_value(p_requisition_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_estimated NUMERIC;
BEGIN
    SELECT COALESCE(SUM(
        COALESCE((item->>'valor_total')::numeric,
                 COALESCE((item->>'quantidade')::numeric, 0) * COALESCE((item->>'valor_unitario')::numeric, 0))
    ), 0)
    INTO v_estimated
    FROM public.requisicoes r,
         LATERAL jsonb_array_elements(COALESCE(r.itens, '[]'::jsonb)) item
    WHERE r.id = p_requisition_id;

    RETURN COALESCE(v_estimated, 0);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.sync_requisition_erp_status(p_requisition_id UUID)
RETURNS VOID AS $$
DECLARE
    v_total_invoiced NUMERIC := 0;
    v_target_value NUMERIC := 0;
    v_status TEXT := 'pending';
BEGIN
    IF p_requisition_id IS NULL THEN
        RETURN;
    END IF;

    SELECT COALESCE(SUM(COALESCE(si.total_final, si.total, si.total_value, 0)), 0)
    INTO v_total_invoiced
    FROM public.supplier_invoices si
    WHERE si.requisition_id = p_requisition_id;

    SELECT COALESCE(r.approved_value, public.requisition_estimated_value(r.id), 0)
    INTO v_target_value
    FROM public.requisicoes r
    WHERE r.id = p_requisition_id;

    IF v_total_invoiced <= 0 THEN
        v_status := 'awaiting_invoice';
    ELSIF v_target_value > 0 AND v_total_invoiced < v_target_value THEN
        v_status := 'invoiced';
    ELSE
        v_status := 'closed';
    END IF;

    UPDATE public.requisicoes
    SET
        erp_status = v_status,
        financial_status = CASE
            WHEN v_total_invoiced <= 0 THEN 'PENDING'
            WHEN v_target_value > 0 AND v_total_invoiced < v_target_value THEN 'PARTIAL'
            ELSE 'INVOICED'
        END,
        total_invoiced_amount = v_total_invoiced
    WHERE id = p_requisition_id;
END;
$$ LANGUAGE plpgsql;

-- Supplier invoice postings (insert/update/delete)
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

    PERFORM public.reverse_document_movements('invoice', NEW.id, 'Supplier invoice changed');

    v_total := COALESCE(NEW.total_final, NEW.total, NEW.total_value, 0);
    v_issue_date := COALESCE(NEW.issue_date::timestamptz, now());
    v_description := CONCAT('Supplier Invoice ', COALESCE(NEW.invoice_number, NEW.id::text));

    IF NEW.requisition_id IS NOT NULL THEN
        v_description := CONCAT(v_description, ' (REQ ', NEW.requisition_id::text, ')');
    END IF;

    IF v_total > 0 THEN
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

DO $$
BEGIN
    IF to_regclass('public.supplier_invoices') IS NOT NULL THEN
        EXECUTE 'DROP TRIGGER IF EXISTS trg_sync_financial_movement_supplier_invoice ON public.supplier_invoices';
        EXECUTE 'DROP TRIGGER IF EXISTS trg_ledger_post_supplier_invoice ON public.supplier_invoices';
        EXECUTE 'CREATE TRIGGER trg_ledger_post_supplier_invoice AFTER INSERT OR UPDATE OR DELETE ON public.supplier_invoices FOR EACH ROW EXECUTE FUNCTION public.ledger_post_supplier_invoice()';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.ledger_post_fuel_transaction()
RETURNS TRIGGER AS $$
DECLARE
    v_total NUMERIC;
    v_when TIMESTAMPTZ;
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM public.reverse_document_movements('fuel', OLD.id, 'Fuel transaction deleted');
        RETURN OLD;
    END IF;

    PERFORM public.reverse_document_movements('fuel', NEW.id, 'Fuel transaction changed');

    IF COALESCE(NEW.status, 'pending') <> 'confirmed' THEN
        RETURN NEW;
    END IF;

    v_total := COALESCE(NEW.total_cost, COALESCE(NEW.liters, 0) * COALESCE(NEW.price_per_liter, 0), 0);
    v_when := COALESCE(NEW.timestamp, now());

    IF v_total <= 0 THEN
        RETURN NEW;
    END IF;

    -- Fuel consumption: Debit fuel / Credit bank
    PERFORM public.post_financial_movement(
        v_when,
        'fuel',
        NEW.id,
        CONCAT('Fuel - ', COALESCE(NEW.vehicle_id::text, 'Vehicle')),
        '61',
        NEW.centro_custo_id,
        NEW.vehicle_id,
        v_total,
        0,
        NULL,
        NULL
    );

    PERFORM public.post_financial_movement(
        v_when,
        'fuel',
        NEW.id,
        CONCAT('Fuel - ', COALESCE(NEW.vehicle_id::text, 'Vehicle')),
        '12',
        NEW.centro_custo_id,
        NEW.vehicle_id,
        0,
        v_total,
        NULL,
        NULL
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF to_regclass('public.fuel_transactions') IS NOT NULL THEN
        EXECUTE 'DROP TRIGGER IF EXISTS trg_sync_financial_movement_fuel_transaction ON public.fuel_transactions';
        EXECUTE 'DROP TRIGGER IF EXISTS trg_ledger_post_fuel_transaction ON public.fuel_transactions';
        EXECUTE 'CREATE TRIGGER trg_ledger_post_fuel_transaction AFTER INSERT OR UPDATE OR DELETE ON public.fuel_transactions FOR EACH ROW EXECUTE FUNCTION public.ledger_post_fuel_transaction()';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.ledger_post_toll_record()
RETURNS TRIGGER AS $$
DECLARE
    v_total NUMERIC;
    v_desc TEXT;
    v_when TIMESTAMPTZ;
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM public.reverse_document_movements('expense', OLD.id, 'Toll/parking deleted');
        RETURN OLD;
    END IF;

    PERFORM public.reverse_document_movements('expense', NEW.id, 'Toll/parking changed');

    v_total := COALESCE(NEW.amount, 0);
    IF v_total <= 0 THEN
        RETURN NEW;
    END IF;

    v_when := COALESCE(NEW.entry_time, now());
    v_desc := CASE WHEN COALESCE(NEW.type, 'toll') = 'parking'
        THEN CONCAT('Parking - ', COALESCE(NEW.entry_point, 'N/A'))
        ELSE CONCAT('Toll - ', COALESCE(NEW.entry_point, 'N/A'), ' -> ', COALESCE(NEW.exit_point, 'N/A'))
    END;

    -- Toll/Parking expense: Debit tolls / Credit bank
    PERFORM public.post_financial_movement(v_when, 'expense', NEW.id, v_desc, '63', NEW.cost_center_id, NEW.vehicle_id, v_total, 0, NULL, NULL);
    PERFORM public.post_financial_movement(v_when, 'expense', NEW.id, v_desc, '12', NEW.cost_center_id, NEW.vehicle_id, 0, v_total, NULL, NULL);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF to_regclass('public.via_verde_toll_records') IS NOT NULL THEN
        EXECUTE 'DROP TRIGGER IF EXISTS trg_sync_financial_movement_toll ON public.via_verde_toll_records';
        EXECUTE 'DROP TRIGGER IF EXISTS trg_ledger_post_toll_record ON public.via_verde_toll_records';
        EXECUTE 'CREATE TRIGGER trg_ledger_post_toll_record AFTER INSERT OR UPDATE OR DELETE ON public.via_verde_toll_records FOR EACH ROW EXECUTE FUNCTION public.ledger_post_toll_record()';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.ledger_post_fixed_expense()
RETURNS TRIGGER AS $$
DECLARE
    v_total NUMERIC;
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM public.reverse_document_movements('expense', OLD.id, 'Manual expense deleted');
        RETURN OLD;
    END IF;

    PERFORM public.reverse_document_movements('expense', NEW.id, 'Manual expense changed');

    v_total := COALESCE(NEW.amount, 0);
    IF v_total <= 0 THEN
        RETURN NEW;
    END IF;

    PERFORM public.post_financial_movement(
        COALESCE(NEW.date::timestamptz, now()),
        'expense',
        NEW.id,
        CONCAT('Expense - ', COALESCE(NEW.description, NEW.id::text)),
        '64',
        NEW.cost_center_id,
        NULL,
        v_total,
        0,
        NULL,
        NULL
    );

    PERFORM public.post_financial_movement(
        COALESCE(NEW.date::timestamptz, now()),
        'expense',
        NEW.id,
        CONCAT('Expense - ', COALESCE(NEW.description, NEW.id::text)),
        '12',
        NEW.cost_center_id,
        NULL,
        0,
        v_total,
        NULL,
        NULL
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF to_regclass('public.expenses') IS NOT NULL THEN
        EXECUTE 'DROP TRIGGER IF EXISTS trg_sync_financial_movement_fixed_expense ON public.expenses';
        EXECUTE 'DROP TRIGGER IF EXISTS trg_ledger_post_fixed_expense ON public.expenses';
        EXECUTE 'CREATE TRIGGER trg_ledger_post_fixed_expense AFTER INSERT OR UPDATE OR DELETE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.ledger_post_fixed_expense()';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.ledger_post_revenue_invoice()
RETURNS TRIGGER AS $$
DECLARE
    v_total NUMERIC;
    v_desc TEXT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM public.reverse_document_movements('invoice', OLD.id, 'Revenue invoice deleted');
        RETURN OLD;
    END IF;

    PERFORM public.reverse_document_movements('invoice', NEW.id, 'Revenue invoice changed');

    v_total := COALESCE(NEW.total, 0);
    IF v_total <= 0 OR COALESCE(NEW.status, 'rascunho') = 'anulada' THEN
        RETURN NEW;
    END IF;

    v_desc := CONCAT('Revenue Invoice ', COALESCE(NEW.numero, NEW.id::text));

    -- Revenue recognition (simplified): Debit bank / Credit revenue
    PERFORM public.post_financial_movement(COALESCE(NEW.data::timestamptz, now()), 'invoice', NEW.id, v_desc, '12', NULL, NULL, v_total, 0, NULL, NULL);
    PERFORM public.post_financial_movement(COALESCE(NEW.data::timestamptz, now()), 'invoice', NEW.id, v_desc, '70', NULL, NULL, 0, v_total, NULL, NULL);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF to_regclass('public.faturas') IS NOT NULL THEN
        EXECUTE 'DROP TRIGGER IF EXISTS trg_sync_financial_movement_revenue_invoice ON public.faturas';
        EXECUTE 'DROP TRIGGER IF EXISTS trg_ledger_post_revenue_invoice ON public.faturas';
        EXECUTE 'CREATE TRIGGER trg_ledger_post_revenue_invoice AFTER INSERT OR UPDATE OR DELETE ON public.faturas FOR EACH ROW EXECUTE FUNCTION public.ledger_post_revenue_invoice()';
    END IF;
END;
$$;

-- Keep requisition status in sync whenever supplier invoices change
CREATE OR REPLACE FUNCTION public.requisition_status_from_invoice_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM public.sync_requisition_erp_status(OLD.requisition_id);
        RETURN OLD;
    END IF;

    PERFORM public.sync_requisition_erp_status(NEW.requisition_id);
    IF TG_OP = 'UPDATE' AND NEW.requisition_id IS DISTINCT FROM OLD.requisition_id THEN
        PERFORM public.sync_requisition_erp_status(OLD.requisition_id);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF to_regclass('public.supplier_invoices') IS NOT NULL THEN
        EXECUTE 'DROP TRIGGER IF EXISTS trg_requisition_status_from_invoice ON public.supplier_invoices';
        EXECUTE 'CREATE TRIGGER trg_requisition_status_from_invoice AFTER INSERT OR UPDATE OR DELETE ON public.supplier_invoices FOR EACH ROW EXECUTE FUNCTION public.requisition_status_from_invoice_trigger()';
    END IF;
END;
$$;

-- Backfill requisition ERP status
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.requisicoes LOOP
        PERFORM public.sync_requisition_erp_status(r.id);
    END LOOP;
END;
$$;

-- Backfill ledger by replaying posting functions through no-op updates
DO $$
BEGIN
    IF to_regclass('public.supplier_invoices') IS NOT NULL THEN
        EXECUTE 'UPDATE public.supplier_invoices SET updated_at = now()';
    END IF;

    IF to_regclass('public.fuel_transactions') IS NOT NULL THEN
        EXECUTE 'UPDATE public.fuel_transactions SET timestamp = timestamp';
    END IF;

    IF to_regclass('public.via_verde_toll_records') IS NOT NULL THEN
        EXECUTE 'UPDATE public.via_verde_toll_records SET entry_time = entry_time';
    END IF;

    IF to_regclass('public.expenses') IS NOT NULL THEN
        EXECUTE 'UPDATE public.expenses SET date = date';
    END IF;

    IF to_regclass('public.faturas') IS NOT NULL THEN
        EXECUTE 'UPDATE public.faturas SET data = data';
    END IF;
END;
$$;
