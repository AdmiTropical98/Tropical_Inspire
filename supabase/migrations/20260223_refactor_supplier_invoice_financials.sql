-- Refactor supplier invoice accounting structure
-- Adds automatic-calculation fields required by finance workflow

ALTER TABLE public.supplier_invoices
    ADD COLUMN IF NOT EXISTS base_amount NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS iva_rate NUMERIC NOT NULL DEFAULT 23,
    ADD COLUMN IF NOT EXISTS iva_value NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS discount JSONB NOT NULL DEFAULT '{"type":"amount","value":0,"applied_value":0}'::jsonb,
    ADD COLUMN IF NOT EXISTS extra_expenses JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS total NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE public.supplier_invoices
    DROP CONSTRAINT IF EXISTS supplier_invoices_iva_rate_check;

ALTER TABLE public.supplier_invoices
    ADD CONSTRAINT supplier_invoices_iva_rate_check CHECK (iva_rate IN (6, 13, 23));

UPDATE public.supplier_invoices
SET
    base_amount = COALESCE(base_amount, net_value, 0),
    iva_value = COALESCE(iva_value, vat_value, 0),
    total = COALESCE(total, total_value, 0),
    discount = COALESCE(discount, '{"type":"amount","value":0,"applied_value":0}'::jsonb),
    extra_expenses = COALESCE(extra_expenses, '[]'::jsonb);
