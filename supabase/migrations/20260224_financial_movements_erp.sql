-- ERP-style financial ledger
-- Central table for all financial impacts

CREATE TABLE IF NOT EXISTS public.financial_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    document_type TEXT NOT NULL,
    document_id TEXT NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    type TEXT NOT NULL CHECK (type IN ('expense', 'revenue')),
    cost_center_id TEXT NULL,
    vehicle_id TEXT NULL,
    account_code TEXT NOT NULL CHECK (account_code IN ('61', '62', '63', '64', '71')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_movements_document
    ON public.financial_movements(document_type, document_id);

CREATE INDEX IF NOT EXISTS idx_financial_movements_date
    ON public.financial_movements(date DESC);

CREATE INDEX IF NOT EXISTS idx_financial_movements_cost_center
    ON public.financial_movements(cost_center_id);

CREATE INDEX IF NOT EXISTS idx_financial_movements_vehicle
    ON public.financial_movements(vehicle_id);

ALTER TABLE public.financial_movements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'financial_movements'
          AND policyname = 'Public Access'
    ) THEN
        CREATE POLICY "Public Access" ON public.financial_movements FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'financial_movements'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.financial_movements;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.touch_financial_movements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_financial_movements_updated_at ON public.financial_movements;
CREATE TRIGGER trg_touch_financial_movements_updated_at
    BEFORE UPDATE ON public.financial_movements
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_financial_movements_updated_at();

CREATE OR REPLACE FUNCTION public.upsert_financial_movement_core(
    p_document_type TEXT,
    p_document_id TEXT,
    p_date DATE,
    p_description TEXT,
    p_amount NUMERIC,
    p_type TEXT,
    p_cost_center_id TEXT,
    p_vehicle_id TEXT,
    p_account_code TEXT
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.financial_movements (
        date,
        document_type,
        document_id,
        description,
        amount,
        type,
        cost_center_id,
        vehicle_id,
        account_code
    ) VALUES (
        p_date,
        p_document_type,
        p_document_id,
        p_description,
        p_amount,
        p_type,
        p_cost_center_id,
        p_vehicle_id,
        p_account_code
    )
    ON CONFLICT (document_type, document_id)
    DO UPDATE SET
        date = EXCLUDED.date,
        description = EXCLUDED.description,
        amount = EXCLUDED.amount,
        type = EXCLUDED.type,
        cost_center_id = EXCLUDED.cost_center_id,
        vehicle_id = EXCLUDED.vehicle_id,
        account_code = EXCLUDED.account_code,
        updated_at = now();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.delete_financial_movement_core(
    p_document_type TEXT,
    p_document_id TEXT
)
RETURNS VOID AS $$
BEGIN
    DELETE FROM public.financial_movements
    WHERE document_type = p_document_type
      AND document_id = p_document_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.sync_financial_movement_supplier_invoice()
RETURNS TRIGGER AS $$
DECLARE
    v_total NUMERIC;
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM public.delete_financial_movement_core('supplier_invoice', OLD.id::text);
        RETURN OLD;
    END IF;

    v_total := COALESCE(NEW.total_final, NEW.total, NEW.total_value, 0);

    IF v_total <= 0 THEN
        PERFORM public.delete_financial_movement_core('supplier_invoice', NEW.id::text);
        RETURN NEW;
    END IF;

    PERFORM public.upsert_financial_movement_core(
        'supplier_invoice',
        NEW.id::text,
        COALESCE(NEW.issue_date, now()::date),
        CONCAT('Supplier Invoice ', COALESCE(NEW.invoice_number, NEW.id::text)),
        v_total,
        'expense',
        NEW.cost_center_id::text,
        NEW.vehicle_id::text,
        '62'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_financial_movement_supplier_invoice ON public.supplier_invoices;
CREATE TRIGGER trg_sync_financial_movement_supplier_invoice
    AFTER INSERT OR UPDATE OR DELETE ON public.supplier_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_financial_movement_supplier_invoice();

CREATE OR REPLACE FUNCTION public.sync_financial_movement_fuel_transaction()
RETURNS TRIGGER AS $$
DECLARE
    v_total NUMERIC;
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM public.delete_financial_movement_core('fuel_record', OLD.id::text);
        RETURN OLD;
    END IF;

    IF COALESCE(NEW.status, 'pending') <> 'confirmed' THEN
        PERFORM public.delete_financial_movement_core('fuel_record', NEW.id::text);
        RETURN NEW;
    END IF;

    v_total := COALESCE(NEW.total_cost, COALESCE(NEW.liters, 0) * COALESCE(NEW.price_per_liter, 0), 0);

    IF v_total <= 0 THEN
        PERFORM public.delete_financial_movement_core('fuel_record', NEW.id::text);
        RETURN NEW;
    END IF;

    PERFORM public.upsert_financial_movement_core(
        'fuel_record',
        NEW.id::text,
        COALESCE(NEW.timestamp::date, now()::date),
        CONCAT('Fuel - ', COALESCE(NEW.vehicle_id::text, 'Vehicle')),
        v_total,
        'expense',
        NEW.centro_custo_id::text,
        NEW.vehicle_id::text,
        '61'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_financial_movement_fuel_transaction ON public.fuel_transactions;
CREATE TRIGGER trg_sync_financial_movement_fuel_transaction
    AFTER INSERT OR UPDATE OR DELETE ON public.fuel_transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_financial_movement_fuel_transaction();

CREATE OR REPLACE FUNCTION public.sync_financial_movement_toll()
RETURNS TRIGGER AS $$
DECLARE
    v_total NUMERIC;
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM public.delete_financial_movement_core('toll_expense', OLD.id::text);
        RETURN OLD;
    END IF;

    v_total := COALESCE(NEW.amount, 0);

    IF v_total <= 0 THEN
        PERFORM public.delete_financial_movement_core('toll_expense', NEW.id::text);
        RETURN NEW;
    END IF;

    PERFORM public.upsert_financial_movement_core(
        'toll_expense',
        NEW.id::text,
        COALESCE(NEW.entry_time::date, now()::date),
        CASE WHEN COALESCE(NEW.type, 'toll') = 'parking'
            THEN CONCAT('Parking - ', COALESCE(NEW.entry_point, 'N/A'))
            ELSE CONCAT('Toll - ', COALESCE(NEW.entry_point, 'N/A'), ' -> ', COALESCE(NEW.exit_point, 'N/A'))
        END,
        v_total,
        'expense',
        NEW.cost_center_id::text,
        NEW.vehicle_id::text,
        '63'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_financial_movement_toll ON public.via_verde_toll_records;
CREATE TRIGGER trg_sync_financial_movement_toll
    AFTER INSERT OR UPDATE OR DELETE ON public.via_verde_toll_records
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_financial_movement_toll();

CREATE OR REPLACE FUNCTION public.sync_financial_movement_requisition()
RETURNS TRIGGER AS $$
DECLARE
    v_total NUMERIC;
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM public.delete_financial_movement_core('requisition', OLD.id::text);
        RETURN OLD;
    END IF;

    v_total := COALESCE(NEW.custo, 0);

    IF COALESCE(NEW.status, 'pendente') <> 'concluida' OR v_total <= 0 THEN
        PERFORM public.delete_financial_movement_core('requisition', NEW.id::text);
        RETURN NEW;
    END IF;

    PERFORM public.upsert_financial_movement_core(
        'requisition',
        NEW.id::text,
        COALESCE(NEW.data, now()::date),
        CONCAT('Requisition R:', COALESCE(NEW.numero::text, NEW.id::text)),
        v_total,
        'expense',
        NEW.centro_custo_id::text,
        NEW.viatura_id::text,
        '62'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_financial_movement_requisition ON public.requisicoes;
CREATE TRIGGER trg_sync_financial_movement_requisition
    AFTER INSERT OR UPDATE OR DELETE ON public.requisicoes
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_financial_movement_requisition();

CREATE OR REPLACE FUNCTION public.sync_financial_movement_fixed_expense()
RETURNS TRIGGER AS $$
DECLARE
    v_total NUMERIC;
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM public.delete_financial_movement_core('fixed_expense', OLD.id::text);
        RETURN OLD;
    END IF;

    v_total := COALESCE(NEW.amount, 0);

    IF v_total <= 0 THEN
        PERFORM public.delete_financial_movement_core('fixed_expense', NEW.id::text);
        RETURN NEW;
    END IF;

    PERFORM public.upsert_financial_movement_core(
        'fixed_expense',
        NEW.id::text,
        COALESCE(NEW.date, now()::date),
        CONCAT('Expense - ', COALESCE(NEW.description, NEW.id::text)),
        v_total,
        'expense',
        NEW.cost_center_id::text,
        NULL,
        '64'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_financial_movement_fixed_expense ON public.expenses;
CREATE TRIGGER trg_sync_financial_movement_fixed_expense
    AFTER INSERT OR UPDATE OR DELETE ON public.expenses
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_financial_movement_fixed_expense();

CREATE OR REPLACE FUNCTION public.sync_financial_movement_revenue_invoice()
RETURNS TRIGGER AS $$
DECLARE
    v_total NUMERIC;
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM public.delete_financial_movement_core('revenue_invoice', OLD.id::text);
        RETURN OLD;
    END IF;

    v_total := COALESCE(NEW.total, 0);

    IF v_total <= 0 OR COALESCE(NEW.status, 'rascunho') = 'anulada' THEN
        PERFORM public.delete_financial_movement_core('revenue_invoice', NEW.id::text);
        RETURN NEW;
    END IF;

    PERFORM public.upsert_financial_movement_core(
        'revenue_invoice',
        NEW.id::text,
        COALESCE(NEW.data, now()::date),
        CONCAT('Revenue Invoice ', COALESCE(NEW.numero, NEW.id::text)),
        v_total,
        'revenue',
        NULL,
        NULL,
        '71'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_financial_movement_revenue_invoice ON public.faturas;
CREATE TRIGGER trg_sync_financial_movement_revenue_invoice
    AFTER INSERT OR UPDATE OR DELETE ON public.faturas
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_financial_movement_revenue_invoice();

-- Backfill current data
INSERT INTO public.financial_movements (
    date, document_type, document_id, description, amount, type, cost_center_id, vehicle_id, account_code
)
SELECT
    COALESCE(issue_date, now()::date),
    'supplier_invoice',
    id::text,
    CONCAT('Supplier Invoice ', COALESCE(invoice_number, id::text)),
    COALESCE(total_final, total, total_value, 0),
    'expense',
    cost_center_id::text,
    vehicle_id::text,
    '62'
FROM public.supplier_invoices
WHERE COALESCE(total_final, total, total_value, 0) > 0
ON CONFLICT (document_type, document_id)
DO UPDATE SET
    date = EXCLUDED.date,
    description = EXCLUDED.description,
    amount = EXCLUDED.amount,
    type = EXCLUDED.type,
    cost_center_id = EXCLUDED.cost_center_id,
    vehicle_id = EXCLUDED.vehicle_id,
    account_code = EXCLUDED.account_code,
    updated_at = now();

INSERT INTO public.financial_movements (
    date, document_type, document_id, description, amount, type, cost_center_id, vehicle_id, account_code
)
SELECT
    COALESCE(timestamp::date, now()::date),
    'fuel_record',
    id::text,
    CONCAT('Fuel - ', COALESCE(vehicle_id::text, 'Vehicle')),
    COALESCE(total_cost, COALESCE(liters, 0) * COALESCE(price_per_liter, 0), 0),
    'expense',
    centro_custo_id::text,
    vehicle_id::text,
    '61'
FROM public.fuel_transactions
WHERE COALESCE(status, 'pending') = 'confirmed'
  AND COALESCE(total_cost, COALESCE(liters, 0) * COALESCE(price_per_liter, 0), 0) > 0
ON CONFLICT (document_type, document_id)
DO UPDATE SET
    date = EXCLUDED.date,
    description = EXCLUDED.description,
    amount = EXCLUDED.amount,
    type = EXCLUDED.type,
    cost_center_id = EXCLUDED.cost_center_id,
    vehicle_id = EXCLUDED.vehicle_id,
    account_code = EXCLUDED.account_code,
    updated_at = now();

INSERT INTO public.financial_movements (
    date, document_type, document_id, description, amount, type, cost_center_id, vehicle_id, account_code
)
SELECT
    COALESCE(entry_time::date, now()::date),
    'toll_expense',
    id::text,
    CASE WHEN COALESCE(type, 'toll') = 'parking'
        THEN CONCAT('Parking - ', COALESCE(entry_point, 'N/A'))
        ELSE CONCAT('Toll - ', COALESCE(entry_point, 'N/A'), ' -> ', COALESCE(exit_point, 'N/A'))
    END,
    COALESCE(amount, 0),
    'expense',
    cost_center_id::text,
    vehicle_id::text,
    '63'
FROM public.via_verde_toll_records
WHERE COALESCE(amount, 0) > 0
ON CONFLICT (document_type, document_id)
DO UPDATE SET
    date = EXCLUDED.date,
    description = EXCLUDED.description,
    amount = EXCLUDED.amount,
    type = EXCLUDED.type,
    cost_center_id = EXCLUDED.cost_center_id,
    vehicle_id = EXCLUDED.vehicle_id,
    account_code = EXCLUDED.account_code,
    updated_at = now();

INSERT INTO public.financial_movements (
    date, document_type, document_id, description, amount, type, cost_center_id, vehicle_id, account_code
)
SELECT
    COALESCE(data, now()::date),
    'requisition',
    id::text,
    CONCAT('Requisition R:', COALESCE(numero::text, id::text)),
    COALESCE(custo, 0),
    'expense',
    centro_custo_id::text,
    viatura_id::text,
    '62'
FROM public.requisicoes
WHERE COALESCE(status, 'pendente') = 'concluida'
  AND COALESCE(custo, 0) > 0
ON CONFLICT (document_type, document_id)
DO UPDATE SET
    date = EXCLUDED.date,
    description = EXCLUDED.description,
    amount = EXCLUDED.amount,
    type = EXCLUDED.type,
    cost_center_id = EXCLUDED.cost_center_id,
    vehicle_id = EXCLUDED.vehicle_id,
    account_code = EXCLUDED.account_code,
    updated_at = now();

INSERT INTO public.financial_movements (
    date, document_type, document_id, description, amount, type, cost_center_id, vehicle_id, account_code
)
SELECT
    COALESCE(date, now()::date),
    'fixed_expense',
    id::text,
    CONCAT('Expense - ', COALESCE(description, id::text)),
    COALESCE(amount, 0),
    'expense',
    cost_center_id::text,
    NULL,
    '64'
FROM public.expenses
WHERE COALESCE(amount, 0) > 0
ON CONFLICT (document_type, document_id)
DO UPDATE SET
    date = EXCLUDED.date,
    description = EXCLUDED.description,
    amount = EXCLUDED.amount,
    type = EXCLUDED.type,
    cost_center_id = EXCLUDED.cost_center_id,
    vehicle_id = EXCLUDED.vehicle_id,
    account_code = EXCLUDED.account_code,
    updated_at = now();

INSERT INTO public.financial_movements (
    date, document_type, document_id, description, amount, type, cost_center_id, vehicle_id, account_code
)
SELECT
    COALESCE(data, now()::date),
    'revenue_invoice',
    id::text,
    CONCAT('Revenue Invoice ', COALESCE(numero, id::text)),
    COALESCE(total, 0),
    'revenue',
    NULL,
    NULL,
    '71'
FROM public.faturas
WHERE COALESCE(total, 0) > 0
  AND COALESCE(status, 'rascunho') <> 'anulada'
ON CONFLICT (document_type, document_id)
DO UPDATE SET
    date = EXCLUDED.date,
    description = EXCLUDED.description,
    amount = EXCLUDED.amount,
    type = EXCLUDED.type,
    cost_center_id = EXCLUDED.cost_center_id,
    vehicle_id = EXCLUDED.vehicle_id,
    account_code = EXCLUDED.account_code,
    updated_at = now();
