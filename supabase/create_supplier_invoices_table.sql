-- Migration: Create supplier_invoices table for operational accounting
-- Created: 2026-02-23

CREATE TABLE IF NOT EXISTS public.supplier_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL,
    invoice_number TEXT NOT NULL,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    base_amount NUMERIC NOT NULL DEFAULT 0,
    iva_rate NUMERIC NOT NULL DEFAULT 23 CHECK (iva_rate IN (6, 13, 23)),
    iva_value NUMERIC NOT NULL DEFAULT 0,
    discount JSONB NOT NULL DEFAULT '{"type":"amount","value":0,"applied_value":0}'::jsonb,
    extra_expenses JSONB NOT NULL DEFAULT '[]'::jsonb,
    total NUMERIC NOT NULL DEFAULT 0,
    net_value NUMERIC NOT NULL DEFAULT 0,
    vat_value NUMERIC NOT NULL DEFAULT 0,
    total_value NUMERIC NOT NULL DEFAULT 0,
    expense_type TEXT NOT NULL,
    cost_center_id UUID REFERENCES public.centros_custos(id) ON DELETE SET NULL,
    vehicle_id UUID REFERENCES public.viaturas(id) ON DELETE SET NULL,
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'scheduled', 'paid', 'overdue')),
    payment_method TEXT,
    notes TEXT,
    pdf_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;

-- Create policy for public access (adjust as needed for security)
CREATE POLICY "Public Access" ON public.supplier_invoices FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.supplier_invoices;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_supplier_id ON public.supplier_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_cost_center_id ON public.supplier_invoices(cost_center_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_vehicle_id ON public.supplier_invoices(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_payment_status ON public.supplier_invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_due_date ON public.supplier_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_issue_date ON public.supplier_invoices(issue_date);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_supplier_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_supplier_invoices_updated_at
    BEFORE UPDATE ON public.supplier_invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_supplier_invoices_updated_at();