-- Migration: SUPER ROBUST RECOVERY SCRIPT (Consolidated Infrastructure v2)
-- This script ensures ALL tables, columns, and functions for Invoices and Ledger are present.
-- It uses ALTER TABLE ... ADD COLUMN IF NOT EXISTS to handle existing-but-outdated tables.

---------------------------------------------------------
-- 1. BASE LEDGER INFRASTRUCTURE (financial_movements)
---------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.financial_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date TIMESTAMPTZ NOT NULL DEFAULT now(),
    document_type TEXT NOT NULL,
    document_id UUID NOT NULL DEFAULT gen_random_uuid(),
    description TEXT NOT NULL DEFAULT '',
    debit NUMERIC NOT NULL DEFAULT 0,
    credit NUMERIC NOT NULL DEFAULT 0,
    account_code TEXT NOT NULL,
    account_name TEXT,
    cost_center_id UUID,
    vehicle_id UUID,
    supplier_id UUID,
    source_requisition_id UUID,
    is_reversal BOOLEAN NOT NULL DEFAULT false,
    reversal_of UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure all columns exist in financial_movements
ALTER TABLE public.financial_movements 
    ADD COLUMN IF NOT EXISTS debit NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS credit NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS account_name TEXT,
    ADD COLUMN IF NOT EXISTS supplier_id UUID NULL,
    ADD COLUMN IF NOT EXISTS source_requisition_id UUID NULL,
    ADD COLUMN IF NOT EXISTS is_reversal BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS reversal_of UUID NULL;

-- Handle calculated column 'amount' (cannot use ADD COLUMN IF NOT EXISTS for generated columns easily)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'financial_movements' AND column_name = 'amount') THEN
        ALTER TABLE public.financial_movements ADD COLUMN amount NUMERIC GENERATED ALWAYS AS (debit - credit) STORED;
    END IF;
END $$;

-- Constraints
ALTER TABLE public.financial_movements 
    DROP CONSTRAINT IF EXISTS financial_movements_document_type_check;
ALTER TABLE public.financial_movements
    ADD CONSTRAINT financial_movements_document_type_check
        CHECK (document_type IN ('invoice', 'requisition', 'fuel', 'expense', 'adjustment'));

ALTER TABLE public.financial_movements 
    DROP CONSTRAINT IF EXISTS financial_movements_account_code_check;
ALTER TABLE public.financial_movements
    ADD CONSTRAINT financial_movements_account_code_check
        CHECK (account_code IN ('12', '21', '60', '61', '62', '63', '64', '70', '71', '72'));

---------------------------------------------------------
-- 2. CORE FUNCTIONS
---------------------------------------------------------

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
        date, document_type, document_id, description,
        account_code, account_name, cost_center_id, vehicle_id,
        debit, credit, supplier_id, source_requisition_id,
        is_reversal, reversal_of
    ) VALUES (
        p_date, p_document_type, p_document_id, p_description,
        p_account_code, public.erp_account_name(p_account_code), p_cost_center_id, p_vehicle_id,
        p_debit, p_credit, p_supplier_id, p_source_requisition_id,
        p_is_reversal, p_reversal_of
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
            now(), 'adjustment', p_document_id,
            CONCAT('Reversal: ', p_reason, ' | ', rec.description),
            rec.account_code, rec.cost_center_id, rec.vehicle_id,
            rec.credit, rec.debit, rec.supplier_id, rec.source_requisition_id,
            true, rec.id
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

---------------------------------------------------------
-- 3. REQUISITION ENHANCEMENTS
---------------------------------------------------------

ALTER TABLE public.requisicoes 
    ADD COLUMN IF NOT EXISTS erp_status TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS financial_status TEXT NOT NULL DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS approved_value NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_invoiced_amount NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS faturas_dados JSONB DEFAULT '[]'::jsonb;

-- Cleanup constraints if they exist but are wrong
ALTER TABLE public.requisicoes DROP CONSTRAINT IF EXISTS requisicoes_erp_status_check;
ALTER TABLE public.requisicoes ADD CONSTRAINT requisicoes_erp_status_check CHECK (erp_status IN ('pending', 'awaiting_invoice', 'invoiced', 'closed'));

ALTER TABLE public.requisicoes DROP CONSTRAINT IF EXISTS requisicoes_financial_status_check;
ALTER TABLE public.requisicoes ADD CONSTRAINT requisicoes_financial_status_check CHECK (financial_status IN ('PENDING', 'PARTIAL', 'INVOICED'));

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
    IF p_requisition_id IS NULL THEN RETURN; END IF;

    SELECT COALESCE(SUM(COALESCE(si.total_final, si.total, si.total_value, 0)), 0)
    INTO v_total_invoiced
    FROM public.supplier_invoices si
    WHERE si.requisition_id = p_requisition_id;

    SELECT COALESCE(r.approved_value, r.custo, public.requisition_estimated_value(r.id), 0)
    INTO v_target_value
    FROM public.requisicoes r
    WHERE r.id = p_requisition_id;

    IF v_total_invoiced <= 0 THEN v_status := 'awaiting_invoice';
    ELSIF v_target_value > 0 AND v_total_invoiced < v_target_value THEN v_status := 'invoiced';
    ELSE v_status := 'closed'; END IF;

    UPDATE public.requisicoes
    SET erp_status = v_status,
        financial_status = CASE
            WHEN v_total_invoiced <= 0 THEN 'PENDING'
            WHEN v_target_value > 0 AND v_total_invoiced < v_target_value THEN 'PARTIAL'
            ELSE 'INVOICED'
        END,
        total_invoiced_amount = v_total_invoiced
    WHERE id = p_requisition_id;
END;
$$ LANGUAGE plpgsql;

---------------------------------------------------------
-- 4. INVOICE MODULE
---------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.supplier_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.supplier_invoices 
    ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS requisition_id UUID REFERENCES public.requisicoes(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS invoice_number TEXT,
    ADD COLUMN IF NOT EXISTS issue_date DATE,
    ADD COLUMN IF NOT EXISTS due_date DATE,
    ADD COLUMN IF NOT EXISTS base_amount NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS iva_rate NUMERIC NOT NULL DEFAULT 23,
    ADD COLUMN IF NOT EXISTS iva_value NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS discount JSONB NOT NULL DEFAULT '{"type":"amount","value":0,"applied_value":0}'::jsonb,
    ADD COLUMN IF NOT EXISTS extra_expenses JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS total NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_liquido NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_iva NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_final NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS net_value NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS vat_value NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_value NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS expense_type TEXT DEFAULT 'Fatura Fornecedor',
    ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.centros_custos(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES public.viaturas(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS payment_method TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS pdf_url TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

ALTER TABLE public.supplier_invoices DROP CONSTRAINT IF EXISTS supplier_invoices_payment_status_check;
ALTER TABLE public.supplier_invoices ADD CONSTRAINT supplier_invoices_payment_status_check CHECK (payment_status IN ('pending', 'scheduled', 'paid', 'overdue'));

CREATE TABLE IF NOT EXISTS public.supplier_invoice_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

ALTER TABLE public.supplier_invoice_lines 
    ADD COLUMN IF NOT EXISTS supplier_invoice_id UUID NOT NULL REFERENCES public.supplier_invoices(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS quantity NUMERIC NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS unit_price NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS net_value NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS iva_rate NUMERIC NOT NULL DEFAULT 23,
    ADD COLUMN IF NOT EXISTS iva_value NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_value NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Trigger Function
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

    -- GUARD: Skip ledger if total is zero or negative
    IF v_total <= 0 THEN
        PERFORM public.sync_requisition_erp_status(NEW.requisition_id);
        RETURN NEW;
    END IF;

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

    PERFORM public.sync_requisition_erp_status(NEW.requisition_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bind Trigger
DROP TRIGGER IF EXISTS trg_ledger_post_supplier_invoice ON public.supplier_invoices;
CREATE TRIGGER trg_ledger_post_supplier_invoice 
    AFTER INSERT OR UPDATE OR DELETE ON public.supplier_invoices 
    FOR EACH ROW 
    EXECUTE FUNCTION public.ledger_post_supplier_invoice();

-- Cleanup Policies
ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invoice_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access" ON public.supplier_invoices;
CREATE POLICY "Public Access" ON public.supplier_invoices FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Public Access" ON public.supplier_invoice_lines;
CREATE POLICY "Public Access" ON public.supplier_invoice_lines FOR ALL USING (true) WITH CHECK (true);

-- RELOAD SCHEMA CACHE (Internal PostgREST hint)
NOTIFY pgrst, 'reload schema';
