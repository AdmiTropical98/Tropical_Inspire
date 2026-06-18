-- Vehicle Cost Management
-- Adds complete per-vehicle cost tracking (insurance, inspections, IUC, toll receipts, fuel metadata, other costs)
-- and creates financial summary/history/alerts views.

CREATE OR REPLACE FUNCTION public.normalize_plate_ref(input_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT UPPER(REGEXP_REPLACE(COALESCE(input_text, ''), '[^a-zA-Z0-9]', '', 'g'));
$$;

CREATE TABLE IF NOT EXISTS public.vehicle_insurance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.viaturas(id) ON DELETE CASCADE,
  insurer TEXT NOT NULL,
  policy_number TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  premium_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_frequency TEXT NOT NULL DEFAULT 'annual'
    CHECK (payment_frequency IN ('monthly', 'quarterly', 'annual')),
  document_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vehicle_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.viaturas(id) ON DELETE CASCADE,
  inspection_date DATE NOT NULL,
  result TEXT NOT NULL DEFAULT 'approved',
  valid_until DATE,
  cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  document_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vehicle_iuc_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.viaturas(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_date DATE,
  payment_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('paid', 'pending')),
  document_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(vehicle_id, fiscal_year)
);

CREATE TABLE IF NOT EXISTS public.vehicle_other_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.viaturas(id) ON DELETE CASCADE,
  cost_category TEXT NOT NULL
    CHECK (cost_category IN ('lavagem', 'pneus', 'estacionamento', 'multa', 'pecas', 'reparacao_extraordinaria', 'outros')),
  cost_date DATE NOT NULL,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  km NUMERIC,
  driver_id UUID REFERENCES public.motoristas(id) ON DELETE SET NULL,
  document_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fuel_transactions
  ADD COLUMN IF NOT EXISTS fuel_type TEXT,
  ADD COLUMN IF NOT EXISTS receipt_url TEXT;

ALTER TABLE public.via_verde_toll_records
  ADD COLUMN IF NOT EXISTS receipt_url TEXT;

CREATE INDEX IF NOT EXISTS idx_vehicle_insurance_vehicle_dates
  ON public.vehicle_insurance_policies(vehicle_id, end_date);

CREATE INDEX IF NOT EXISTS idx_vehicle_inspections_vehicle_dates
  ON public.vehicle_inspections(vehicle_id, valid_until);

CREATE INDEX IF NOT EXISTS idx_vehicle_iuc_vehicle_due
  ON public.vehicle_iuc_records(vehicle_id, due_date);

CREATE INDEX IF NOT EXISTS idx_vehicle_other_costs_vehicle_date
  ON public.vehicle_other_costs(vehicle_id, cost_date DESC);

ALTER TABLE public.vehicle_insurance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_iuc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_other_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vehicle_insurance_all_authenticated ON public.vehicle_insurance_policies;
CREATE POLICY vehicle_insurance_all_authenticated
  ON public.vehicle_insurance_policies
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS vehicle_inspections_all_authenticated ON public.vehicle_inspections;
CREATE POLICY vehicle_inspections_all_authenticated
  ON public.vehicle_inspections
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS vehicle_iuc_all_authenticated ON public.vehicle_iuc_records;
CREATE POLICY vehicle_iuc_all_authenticated
  ON public.vehicle_iuc_records
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS vehicle_other_costs_all_authenticated ON public.vehicle_other_costs;
CREATE POLICY vehicle_other_costs_all_authenticated
  ON public.vehicle_other_costs
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.vehicle_insurance_policies TO authenticated;
GRANT ALL ON public.vehicle_inspections TO authenticated;
GRANT ALL ON public.vehicle_iuc_records TO authenticated;
GRANT ALL ON public.vehicle_other_costs TO authenticated;

CREATE OR REPLACE VIEW public.vehicle_cost_history AS
WITH fuel_costs AS (
  SELECT
    v.id AS vehicle_id,
    ft.id AS source_id,
    'fuel_transactions'::TEXT AS source_table,
    'combustivel'::TEXT AS category,
    ft.timestamp::TIMESTAMPTZ AS event_date,
    COALESCE(ft.total_cost, 0)::NUMERIC AS amount,
    CONCAT('Abastecimento ', COALESCE(ft.liters, 0), 'L')::TEXT AS description,
    ft.receipt_url::TEXT AS document_url
  FROM public.viaturas v
  JOIN public.fuel_transactions ft
    ON ft.vehicle_id::TEXT = v.id::TEXT
    OR public.normalize_plate_ref(ft.vehicle_id::TEXT) = public.normalize_plate_ref(v.matricula)
),
maintenance_costs AS (
  SELECT
    m.vehicle_id AS vehicle_id,
    m.id AS source_id,
    'manutencoes'::TEXT AS source_table,
    'manutencao'::TEXT AS category,
    m.data::TIMESTAMPTZ AS event_date,
    COALESCE(m.custo, 0)::NUMERIC AS amount,
    COALESCE(m.descricao, CONCAT('Manutenção ', COALESCE(m.tipo, 'geral')))::TEXT AS description,
    m.pdf_url::TEXT AS document_url
  FROM public.manutencoes m
  WHERE m.vehicle_id IS NOT NULL
),
toll_costs AS (
  SELECT
    t.vehicle_id AS vehicle_id,
    t.id AS source_id,
    'via_verde_toll_records'::TEXT AS source_table,
    'portagens'::TEXT AS category,
    t.entry_time::TIMESTAMPTZ AS event_date,
    COALESCE(t.amount, 0)::NUMERIC AS amount,
    CASE
      WHEN COALESCE(t.type, 'toll') = 'parking'
        THEN COALESCE(t.entry_point, 'Estacionamento')
      ELSE CONCAT(COALESCE(t.entry_point, 'Entrada'), ' -> ', COALESCE(t.exit_point, 'Saída'))
    END::TEXT AS description,
    t.receipt_url::TEXT AS document_url
  FROM public.via_verde_toll_records t
),
insurance_costs AS (
  SELECT
    s.vehicle_id AS vehicle_id,
    s.id AS source_id,
    'vehicle_insurance_policies'::TEXT AS source_table,
    'seguros'::TEXT AS category,
    s.start_date::TIMESTAMPTZ AS event_date,
    COALESCE(s.premium_amount, 0)::NUMERIC AS amount,
    CONCAT('Seguro ', s.insurer, ' - Apólice ', s.policy_number)::TEXT AS description,
    s.document_url::TEXT AS document_url
  FROM public.vehicle_insurance_policies s
),
inspection_costs AS (
  SELECT
    i.vehicle_id AS vehicle_id,
    i.id AS source_id,
    'vehicle_inspections'::TEXT AS source_table,
    'inspecoes'::TEXT AS category,
    i.inspection_date::TIMESTAMPTZ AS event_date,
    COALESCE(i.cost, 0)::NUMERIC AS amount,
    CONCAT('IPO ', COALESCE(i.result, 'sem resultado'))::TEXT AS description,
    i.document_url::TEXT AS document_url
  FROM public.vehicle_inspections i
),
iuc_costs AS (
  SELECT
    i.vehicle_id AS vehicle_id,
    i.id AS source_id,
    'vehicle_iuc_records'::TEXT AS source_table,
    'iuc'::TEXT AS category,
    COALESCE(i.payment_date, i.due_date, make_date(i.fiscal_year, 1, 1))::TIMESTAMPTZ AS event_date,
    COALESCE(i.amount, 0)::NUMERIC AS amount,
    CONCAT('IUC ', i.fiscal_year::TEXT, ' - ', UPPER(i.status))::TEXT AS description,
    i.document_url::TEXT AS document_url
  FROM public.vehicle_iuc_records i
),
other_costs AS (
  SELECT
    o.vehicle_id AS vehicle_id,
    o.id AS source_id,
    'vehicle_other_costs'::TEXT AS source_table,
    'outros'::TEXT AS category,
    o.cost_date::TIMESTAMPTZ AS event_date,
    COALESCE(o.amount, 0)::NUMERIC AS amount,
    CONCAT(UPPER(o.cost_category), COALESCE(CONCAT(' - ', o.description), ''))::TEXT AS description,
    o.document_url::TEXT AS document_url
  FROM public.vehicle_other_costs o
)
SELECT * FROM fuel_costs
UNION ALL
SELECT * FROM maintenance_costs
UNION ALL
SELECT * FROM toll_costs
UNION ALL
SELECT * FROM insurance_costs
UNION ALL
SELECT * FROM inspection_costs
UNION ALL
SELECT * FROM iuc_costs
UNION ALL
SELECT * FROM other_costs;

CREATE OR REPLACE VIEW public.vehicle_financial_summary AS
SELECT
  v.id AS vehicle_id,
  COALESCE(SUM(CASE WHEN h.category = 'combustivel' THEN h.amount ELSE 0 END), 0)::NUMERIC AS total_fuel_cost,
  COALESCE(SUM(CASE WHEN h.category = 'manutencao' THEN h.amount ELSE 0 END), 0)::NUMERIC AS total_maintenance_cost,
  COALESCE(SUM(CASE WHEN h.category = 'seguros' THEN h.amount ELSE 0 END), 0)::NUMERIC AS total_insurance_cost,
  COALESCE(SUM(CASE WHEN h.category = 'iuc' THEN h.amount ELSE 0 END), 0)::NUMERIC AS total_iuc_cost,
  COALESCE(SUM(CASE WHEN h.category = 'portagens' THEN h.amount ELSE 0 END), 0)::NUMERIC AS total_tolls_cost,
  COALESCE(SUM(CASE WHEN h.category = 'inspecoes' THEN h.amount ELSE 0 END), 0)::NUMERIC AS total_inspection_cost,
  COALESCE(SUM(CASE WHEN h.category = 'outros' THEN h.amount ELSE 0 END), 0)::NUMERIC AS total_other_costs,
  COALESCE(SUM(h.amount), 0)::NUMERIC AS total_vehicle_cost,
  CASE
    WHEN COALESCE(vps.km_travelled, 0) > 0
      THEN (COALESCE(SUM(h.amount), 0) / vps.km_travelled)::NUMERIC
    ELSE 0::NUMERIC
  END AS cost_per_km
FROM public.viaturas v
LEFT JOIN public.vehicle_cost_history h ON h.vehicle_id = v.id
LEFT JOIN public.vehicle_profile_summary vps ON vps.vehicle_id = v.id
GROUP BY v.id, vps.km_travelled;

CREATE OR REPLACE VIEW public.fleet_financial_monthly AS
SELECT
  TO_CHAR(DATE_TRUNC('month', h.event_date), 'YYYY-MM') AS month,
  h.category,
  SUM(h.amount)::NUMERIC AS total_amount
FROM public.vehicle_cost_history h
GROUP BY DATE_TRUNC('month', h.event_date), h.category
ORDER BY DATE_TRUNC('month', h.event_date), h.category;

CREATE OR REPLACE VIEW public.fleet_financial_dashboard AS
WITH totals AS (
  SELECT
    COALESCE(SUM(total_vehicle_cost), 0)::NUMERIC AS total_fleet_cost,
    COALESCE(SUM(total_fuel_cost), 0)::NUMERIC AS total_fuel_cost,
    COALESCE(SUM(total_maintenance_cost), 0)::NUMERIC AS total_maintenance_cost,
    COALESCE(SUM(total_insurance_cost), 0)::NUMERIC AS total_insurance_cost,
    COALESCE(SUM(total_iuc_cost), 0)::NUMERIC AS total_iuc_cost,
    COALESCE(SUM(total_tolls_cost), 0)::NUMERIC AS total_tolls_cost,
    COALESCE(SUM(total_inspection_cost), 0)::NUMERIC AS total_inspection_cost,
    COALESCE(SUM(total_other_costs), 0)::NUMERIC AS total_other_costs
  FROM public.vehicle_financial_summary
),
expensive AS (
  SELECT
    vfs.vehicle_id,
    COALESCE(v.matricula, '-') AS matricula,
    vfs.total_vehicle_cost
  FROM public.vehicle_financial_summary vfs
  LEFT JOIN public.viaturas v ON v.id = vfs.vehicle_id
  ORDER BY vfs.total_vehicle_cost DESC
  LIMIT 1
)
SELECT
  t.*,
  e.vehicle_id AS most_expensive_vehicle_id,
  e.matricula AS most_expensive_vehicle_plate,
  COALESCE(e.total_vehicle_cost, 0)::NUMERIC AS most_expensive_vehicle_cost
FROM totals t
LEFT JOIN expensive e ON TRUE;

CREATE OR REPLACE VIEW public.vehicle_compliance_alerts AS
WITH last_maintenance AS (
  SELECT
    m.vehicle_id,
    MAX(m.data) AS last_maintenance_date,
    MAX(COALESCE(m.km, 0)) AS last_maintenance_km
  FROM public.manutencoes m
  GROUP BY m.vehicle_id
),
insurance_alerts AS (
  SELECT
    gen_random_uuid() AS id,
    s.vehicle_id,
    'seguros'::TEXT AS category,
    'Seguro a expirar'::TEXT AS title,
    CONCAT('Apolice ', s.policy_number, ' expira em ', TO_CHAR(s.end_date, 'DD/MM/YYYY'))::TEXT AS message,
    s.end_date AS due_date,
    CASE WHEN s.end_date <= current_date + INTERVAL '7 days' THEN 'high' ELSE 'medium' END::TEXT AS severity
  FROM public.vehicle_insurance_policies s
  WHERE s.end_date BETWEEN current_date AND (current_date + INTERVAL '30 days')
),
inspection_alerts AS (
  SELECT
    gen_random_uuid() AS id,
    i.vehicle_id,
    'inspecoes'::TEXT AS category,
    'IPO a expirar'::TEXT AS title,
    CONCAT('Validade termina em ', TO_CHAR(i.valid_until, 'DD/MM/YYYY'))::TEXT AS message,
    i.valid_until AS due_date,
    CASE WHEN i.valid_until <= current_date + INTERVAL '7 days' THEN 'high' ELSE 'medium' END::TEXT AS severity
  FROM public.vehicle_inspections i
  WHERE i.valid_until BETWEEN current_date AND (current_date + INTERVAL '30 days')
),
iuc_alerts AS (
  SELECT
    gen_random_uuid() AS id,
    i.vehicle_id,
    'iuc'::TEXT AS category,
    'IUC pendente'::TEXT AS title,
    CONCAT('IUC ', i.fiscal_year::TEXT, ' por regularizar')::TEXT AS message,
    i.due_date AS due_date,
    CASE
      WHEN i.due_date IS NOT NULL AND i.due_date < current_date THEN 'high'
      ELSE 'medium'
    END::TEXT AS severity
  FROM public.vehicle_iuc_records i
  WHERE i.status = 'pending'
    AND (i.due_date IS NULL OR i.due_date <= current_date + INTERVAL '30 days')
),
maintenance_km_alerts AS (
  SELECT
    gen_random_uuid() AS id,
    v.id AS vehicle_id,
    'manutencao'::TEXT AS category,
    'Revisao por km'::TEXT AS title,
    CONCAT('Mais de 10.000 km desde a ultima manutencao (',
      GREATEST(COALESCE(vps.current_km, 0) - COALESCE(lm.last_maintenance_km, 0), 0)::TEXT,
      ' km)')::TEXT AS message,
    NULL::DATE AS due_date,
    'high'::TEXT AS severity
  FROM public.viaturas v
  LEFT JOIN public.vehicle_profile_summary vps ON vps.vehicle_id = v.id
  LEFT JOIN last_maintenance lm ON lm.vehicle_id = v.id
  WHERE GREATEST(COALESCE(vps.current_km, 0) - COALESCE(lm.last_maintenance_km, 0), 0) >= 10000
),
maintenance_date_alerts AS (
  SELECT
    gen_random_uuid() AS id,
    v.id AS vehicle_id,
    'manutencao'::TEXT AS category,
    'Revisao por data'::TEXT AS title,
    'Mais de 365 dias desde a ultima manutencao'::TEXT AS message,
    NULL::DATE AS due_date,
    'medium'::TEXT AS severity
  FROM public.viaturas v
  LEFT JOIN last_maintenance lm ON lm.vehicle_id = v.id
  WHERE lm.last_maintenance_date IS NULL OR lm.last_maintenance_date <= current_date - INTERVAL '365 days'
),
missing_docs_alerts AS (
  SELECT
    gen_random_uuid() AS id,
    s.vehicle_id,
    'documentacao'::TEXT AS category,
    'Documentacao em falta'::TEXT AS title,
    CONCAT('Seguro ', s.policy_number, ' sem PDF anexado')::TEXT AS message,
    NULL::DATE AS due_date,
    'medium'::TEXT AS severity
  FROM public.vehicle_insurance_policies s
  WHERE s.document_url IS NULL OR btrim(s.document_url) = ''
)
SELECT
  a.id,
  a.vehicle_id,
  a.category,
  a.title,
  a.message,
  a.due_date,
  a.severity,
  'open'::TEXT AS status
FROM (
  SELECT * FROM insurance_alerts
  UNION ALL
  SELECT * FROM inspection_alerts
  UNION ALL
  SELECT * FROM iuc_alerts
  UNION ALL
  SELECT * FROM maintenance_km_alerts
  UNION ALL
  SELECT * FROM maintenance_date_alerts
  UNION ALL
  SELECT * FROM missing_docs_alerts
) a;
