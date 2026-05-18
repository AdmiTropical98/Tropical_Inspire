-- Vehicle Profile SQL aggregations (optimized reads per vehicle)

CREATE OR REPLACE FUNCTION public.normalize_plate_ref(input_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT UPPER(REGEXP_REPLACE(COALESCE(input_text, ''), '[^a-zA-Z0-9]', '', 'g'));
$$;

CREATE INDEX IF NOT EXISTS idx_fuel_transactions_vehicle_time ON public.fuel_transactions (vehicle_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_requisicoes_viatura_date ON public.requisicoes (viatura_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_manutencoes_vehicle_date ON public.manutencoes (vehicle_id, data DESC);

CREATE OR REPLACE VIEW public.vehicle_profile_summary AS
SELECT
  v.id AS vehicle_id,
  COALESCE(f.total_fuel_cost, 0)::numeric AS total_fuel_cost,
  COALESCE(m.total_maintenance_cost, 0)::numeric AS total_maintenance_cost,
  (COALESCE(f.total_fuel_cost, 0) + COALESCE(m.total_maintenance_cost, 0))::numeric AS total_cost,
  COALESCE(r.total_requisitions, 0)::int AS total_requisitions,
  COALESCE(f.total_refuels, 0)::int AS total_refuels,
  COALESCE(f.total_liters, 0)::numeric AS total_liters,
  COALESCE(f.km_travelled, 0)::numeric AS km_travelled,
  COALESCE(f.average_consumption, 0)::numeric AS average_consumption,
  CASE
    WHEN COALESCE(f.km_travelled, 0) > 0
      THEN ((COALESCE(f.total_fuel_cost, 0) + COALESCE(m.total_maintenance_cost, 0)) / f.km_travelled)::numeric
    ELSE 0::numeric
  END AS cost_per_km,
  GREATEST(COALESCE(f.max_km, 0), COALESCE(m.max_km, 0), 0)::numeric AS current_km
FROM public.viaturas v
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS total_refuels,
    SUM(COALESCE(ft.total_cost, 0)) AS total_fuel_cost,
    SUM(COALESCE(ft.liters, 0)) AS total_liters,
    MIN(NULLIF(ft.km, 0)) AS min_km,
    MAX(NULLIF(ft.km, 0)) AS max_km,
    CASE
      WHEN MIN(NULLIF(ft.km, 0)) IS NOT NULL AND MAX(NULLIF(ft.km, 0)) IS NOT NULL
        THEN (MAX(NULLIF(ft.km, 0)) - MIN(NULLIF(ft.km, 0)))
      ELSE 0
    END AS km_travelled,
    CASE
      WHEN SUM(CASE WHEN ft.prev_km IS NOT NULL AND ft.km > ft.prev_km THEN 1 ELSE 0 END) > 0 THEN
        AVG(CASE
          WHEN ft.prev_km IS NOT NULL AND ft.km > ft.prev_km THEN (COALESCE(ft.liters, 0) / (ft.km - ft.prev_km)) * 100
          ELSE NULL
        END)
      ELSE 0
    END AS average_consumption
  FROM (
    SELECT
      t.*,
      LAG(t.km) OVER (ORDER BY t.timestamp) AS prev_km
    FROM public.fuel_transactions t
    WHERE
      t.vehicle_id::text = v.id::text
      OR public.normalize_plate_ref(t.vehicle_id::text) = public.normalize_plate_ref(v.matricula)
  ) ft
) f ON TRUE
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS total_requisitions,
    SUM(
      COALESCE(
        r.custo,
        (
          SELECT SUM(COALESCE((item->>'valor_total')::numeric, COALESCE((item->>'valor_unitario')::numeric, 0) * COALESCE((item->>'quantidade')::numeric, 0)))
          FROM jsonb_array_elements(COALESCE(r.itens, '[]'::jsonb)) item
        ),
        0
      )
    ) AS total_requisition_cost
  FROM public.requisicoes r
  WHERE r.viatura_id::text = v.id::text
) r ON TRUE
LEFT JOIN LATERAL (
  SELECT
    (COALESCE(SUM(COALESCE(ma.custo, 0)), 0) + COALESCE(r.total_requisition_cost, 0)) AS total_maintenance_cost,
    MAX(NULLIF(ma.km, 0)) AS max_km
  FROM public.manutencoes ma
  WHERE ma.vehicle_id::text = v.id::text
) m ON TRUE;

CREATE OR REPLACE VIEW public.vehicle_fuel_monthly_summary AS
SELECT
  v.id AS vehicle_id,
  TO_CHAR(DATE_TRUNC('month', ft.timestamp), 'YYYY-MM') AS month,
  SUM(COALESCE(ft.total_cost, 0))::numeric AS cost,
  SUM(COALESCE(ft.liters, 0))::numeric AS liters
FROM public.viaturas v
JOIN public.fuel_transactions ft
  ON ft.vehicle_id::text = v.id::text
  OR public.normalize_plate_ref(ft.vehicle_id::text) = public.normalize_plate_ref(v.matricula)
GROUP BY v.id, DATE_TRUNC('month', ft.timestamp)
ORDER BY v.id, DATE_TRUNC('month', ft.timestamp);

CREATE OR REPLACE VIEW public.vehicle_maintenance_monthly_summary AS
WITH requisitions_month AS (
  SELECT
    r.viatura_id::text AS vehicle_id,
    TO_CHAR(DATE_TRUNC('month', r.data::timestamp), 'YYYY-MM') AS month,
    SUM(
      COALESCE(
        r.custo,
        (
          SELECT SUM(COALESCE((item->>'valor_total')::numeric, COALESCE((item->>'valor_unitario')::numeric, 0) * COALESCE((item->>'quantidade')::numeric, 0)))
          FROM jsonb_array_elements(COALESCE(r.itens, '[]'::jsonb)) item
        ),
        0
      )
    )::numeric AS cost
  FROM public.requisicoes r
  WHERE r.viatura_id IS NOT NULL
  GROUP BY r.viatura_id, DATE_TRUNC('month', r.data::timestamp)
),
maintenance_month AS (
  SELECT
    m.vehicle_id::text AS vehicle_id,
    TO_CHAR(DATE_TRUNC('month', m.data::timestamp), 'YYYY-MM') AS month,
    SUM(COALESCE(m.custo, 0))::numeric AS cost
  FROM public.manutencoes m
  WHERE m.vehicle_id IS NOT NULL
  GROUP BY m.vehicle_id, DATE_TRUNC('month', m.data::timestamp)
)
SELECT
  x.vehicle_id,
  x.month,
  SUM(x.cost)::numeric AS cost
FROM (
  SELECT * FROM requisitions_month
  UNION ALL
  SELECT * FROM maintenance_month
) x
GROUP BY x.vehicle_id, x.month
ORDER BY x.vehicle_id, x.month;

CREATE OR REPLACE VIEW public.vehicle_consumption_monthly_summary AS
WITH fuel_with_delta AS (
  SELECT
    v.id AS vehicle_id,
    ft.timestamp,
    ft.liters,
    ft.km,
    LAG(ft.km) OVER (PARTITION BY v.id ORDER BY ft.timestamp) AS prev_km
  FROM public.viaturas v
  JOIN public.fuel_transactions ft
    ON ft.vehicle_id::text = v.id::text
    OR public.normalize_plate_ref(ft.vehicle_id::text) = public.normalize_plate_ref(v.matricula)
)
SELECT
  vehicle_id,
  TO_CHAR(DATE_TRUNC('month', timestamp), 'YYYY-MM') AS month,
  AVG(
    CASE
      WHEN prev_km IS NOT NULL AND km > prev_km
        THEN (COALESCE(liters, 0) / (km - prev_km)) * 100
      ELSE NULL
    END
  )::numeric AS average_consumption
FROM fuel_with_delta
GROUP BY vehicle_id, DATE_TRUNC('month', timestamp)
ORDER BY vehicle_id, DATE_TRUNC('month', timestamp);
