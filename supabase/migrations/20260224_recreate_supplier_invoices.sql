-- Migration: Consolidated recovery script for Supplier Invoices and Ledger Integration
-- This script ensures all tables, columns, and triggers are present to fix PGRST205.

-- 1. Create Supplier Invoices table
CREATE TABLE IF NOT EXISTS public.supplier_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL,
    requisition_id UUID REFERENCES public.requisicoes(id) ON DELETE SET NULL,
    invoice_number TEXT NOT NULL,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    base_amount NUMERIC NOT NULL DEFAULT 0,
    iva_rate NUMERIC NOT NULL DEFAULT 23,
    iva_value NUMERIC NOT NULL DEFAULT 0,
    discount JSONB NOT NULL DEFAULT '{"type":"amount","value":0,"applied_value":0}'::jsonb,
    extra_expenses JSONB NOT NULL DEFAULT '[]'::jsonb,
    total NUMERIC NOT NULL DEFAULT 0,
    total_liquido NUMERIC NOT NULL DEFAULT 0,
    total_iva NUMERIC NOT NULL DEFAULT 0,
    total_final NUMERIC NOT NULL DEFAULT 0,
    net_value NUMERIC NOT NULL DEFAULT 0,
    vat_value NUMERIC NOT NULL DEFAULT 0,
    total_value NUMERIC NOT NULL DEFAULT 0,
    expense_type TEXT DEFAULT 'Fatura Fornecedor',
    cost_center_id UUID REFERENCES public.centros_custos(id) ON DELETE SET NULL,
    vehicle_id UUID REFERENCES public.viaturas(id) ON DELETE SET NULL,
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'scheduled', 'paid', 'overdue')),
    payment_method TEXT,
    notes TEXT,
    pdf_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Create Supplier Invoice Lines table
CREATE TABLE IF NOT EXISTS public.supplier_invoice_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_invoice_id UUID NOT NULL REFERENCES public.supplier_invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    discount_percentage NUMERIC NOT NULL DEFAULT 0,
    net_value NUMERIC NOT NULL DEFAULT 0,
    iva_rate NUMERIC NOT NULL DEFAULT 23 CHECK (iva_rate IN (0, 6, 13, 23)),
    iva_value NUMERIC NOT NULL DEFAULT 0,
    total_value NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Upgrade Requisitions table
ALTER TABLE public.requisicoes 
    ADD COLUMN IF NOT EXISTS erp_status TEXT NOT NULL DEFAULT 'pending' CHECK (erp_status IN ('pending', 'awaiting_invoice', 'invoiced', 'closed')),
    ADD COLUMN IF NOT EXISTS financial_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (financial_status IN ('PENDING', 'PARTIAL', 'INVOICED')),
    ADD COLUMN IF NOT EXISTS approved_value NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_invoiced_amount NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS faturas_dados JSONB DEFAULT '[]'::jsonb;

-- 4. Enable RLS and Realtime
ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invoice_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Access" ON public.supplier_invoices;
CREATE POLICY "Public Access" ON public.supplier_invoices FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Access" ON public.supplier_invoice_lines;
CREATE POLICY "Public Access" ON public.supplier_invoice_lines FOR ALL USING (true) WITH CHECK (true);

-- Ensure Realtime is enabled (safe to run multiple times)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'supplier_invoices') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.supplier_invoices;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'supplier_invoice_lines') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.supplier_invoice_lines;
    END IF;
END $$;

-- 5. Trigger Functions and Triggers
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

    -- Reversal for updates
    PERFORM public.reverse_document_movements('invoice', NEW.id, 'Supplier invoice changed');

    -- Calculate total (prioritize total_final)
    v_total := COALESCE(NEW.total_final, NEW.total, NEW.total_value, 0);
    v_issue_date := COALESCE(NEW.issue_date::timestamptz, now());
    v_description := CONCAT('Supplier Invoice ', COALESCE(NEW.invoice_number, NEW.id::text));

    IF NEW.requisition_id IS NOT NULL THEN
        v_description := CONCAT(v_description, ' (REQ ', NEW.requisition_id::text, ')');
    END IF;

    -- GUARD: Skip ledger if total is zero or negative (Fixes PGRST205 side effects on constraints)
    IF v_total <= 0 THEN
        PERFORM public.sync_requisition_erp_status(NEW.requisition_id);
        RETURN NEW;
    END IF;

    -- Invoice recognition: Debit expense (62) / Credit supplier liability (21)
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

    -- Payment logic
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

-- Update function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_supplier_invoices_updated_at ON public.supplier_invoices;
CREATE TRIGGER trigger_update_supplier_invoices_updated_at
    BEFORE UPDATE ON public.supplier_invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_supplier_invoice_lines_updated_at ON public.supplier_invoice_lines;
CREATE TRIGGER trigger_update_supplier_invoice_lines_updated_at
    BEFORE UPDATE ON public.supplier_invoice_lines
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
