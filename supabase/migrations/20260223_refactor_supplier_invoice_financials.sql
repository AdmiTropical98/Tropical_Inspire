-- Refactor supplier invoice accounting structure
-- Adds automatic-calculation fields required by finance workflow

ALTER TABLE public.supplier_invoices
    ADD COLUMN IF NOT EXISTS base_amount NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS iva_rate NUMERIC NOT NULL DEFAULT 23,
    ADD COLUMN IF NOT EXISTS iva_value NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS discount JSONB NOT NULL DEFAULT '{"type":"amount","value":0,"applied_value":0}'::jsonb,
    ADD COLUMN IF NOT EXISTS extra_expenses JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS total NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_liquido NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_iva NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_final NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE public.supplier_invoices
    DROP CONSTRAINT IF EXISTS supplier_invoices_iva_rate_check;

ALTER TABLE public.supplier_invoices
    ADD CONSTRAINT supplier_invoices_iva_rate_check CHECK (iva_rate IN (0, 6, 13, 23));

UPDATE public.supplier_invoices
SET
    base_amount = COALESCE(base_amount, net_value, 0),
    iva_value = COALESCE(iva_value, vat_value, 0),
    total = COALESCE(total, total_value, 0),
    total_liquido = COALESCE(total_liquido, net_value, base_amount, 0),
    total_iva = COALESCE(total_iva, vat_value, iva_value, 0),
    total_final = COALESCE(total_final, total_value, total, 0),
    discount = COALESCE(discount, '{"type":"amount","value":0,"applied_value":0}'::jsonb),
    extra_expenses = COALESCE(extra_expenses, '[]'::jsonb);

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

ALTER TABLE public.supplier_invoice_lines ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'supplier_invoice_lines'
          AND policyname = 'Public Access'
    ) THEN
        CREATE POLICY "Public Access" ON public.supplier_invoice_lines FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

ALTER TABLE public.supplier_invoice_lines
    ADD COLUMN IF NOT EXISTS unit_price NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC NOT NULL DEFAULT 0;

UPDATE public.supplier_invoice_lines
SET
    unit_price = CASE
        WHEN COALESCE(quantity, 0) = 0 THEN COALESCE(unit_price, net_value, 0)
        ELSE COALESCE(unit_price, net_value / NULLIF(quantity, 0), 0)
    END,
    discount_percentage = COALESCE(discount_percentage, 0);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'supplier_invoice_lines'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.supplier_invoice_lines;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_supplier_invoice_lines_invoice_id ON public.supplier_invoice_lines(supplier_invoice_id);

CREATE OR REPLACE FUNCTION update_supplier_invoice_lines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_supplier_invoice_lines_updated_at ON public.supplier_invoice_lines;
CREATE TRIGGER trigger_update_supplier_invoice_lines_updated_at
    BEFORE UPDATE ON public.supplier_invoice_lines
    FOR EACH ROW
    EXECUTE FUNCTION update_supplier_invoice_lines_updated_at();
