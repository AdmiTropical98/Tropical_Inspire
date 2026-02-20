-- Migration: evolve_fuel_management.sql
-- Description: Creates the derived metrics layer for the Fuel Management module.

-- 1. Create a view for fuel history with calculated metrics
-- This view calculates consumption per refueling event and joins vehicle/driver details.
CREATE OR REPLACE VIEW historico_com_metricas AS
WITH prev_tx AS (
  SELECT 
    ft.*,
    LAG(km) OVER(PARTITION BY vehicle_id ORDER BY timestamp) as prev_km
  FROM fuel_transactions ft
)
SELECT 
  pt.*,
  v.matricula,
  v.marca,
  v.modelo,
  m.nome as driver_name,
  CASE 
    WHEN pt.km > pt.prev_km AND pt.prev_km > 0 AND pt.liters > 0 THEN ROUND(((pt.liters / (pt.km - pt.prev_km)) * 100)::numeric, 2)
    ELSE NULL
  END as consumo_calculado,
  cc.nome as centro_custo_nome
FROM prev_tx pt
LEFT JOIN viaturas v ON pt.vehicle_id = v.id
LEFT JOIN motoristas m ON pt.driver_id = m.id
LEFT JOIN centros_custos cc ON pt.centro_custo_id = cc.id;

-- 2. Create an auxiliary table for vehicle metrics (caching layer)
-- This table stores aggregated stats for the dashboard to avoid heavy calculations.
CREATE TABLE IF NOT EXISTS metricas_viatura (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES viaturas(id) ON DELETE CASCADE UNIQUE,
  consumo_medio NUMERIC(10,2),
  total_litros_mes NUMERIC(10,2),
  total_custo_mes NUMERIC(10,2),
  ultima_km INTEGER,
  estimativa_autonomia NUMERIC(10,2),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Add index for performance on transitions
CREATE INDEX IF NOT EXISTS idx_fuel_transactions_vehicle_time ON fuel_transactions(vehicle_id, timestamp DESC);

-- 4. Initial seed for metricas_viatura (example for one vehicle)
-- INSERT INTO metricas_viatura (vehicle_id, consumo_medio, total_litros_mes, total_custo_mes, ultima_km)
-- SELECT vehicle_id, AVG(consumo_calculado), SUM(liters), SUM(total_cost), MAX(km)
-- FROM historico_com_metricas
-- WHERE timestamp > NOW() - INTERVAL '30 days'
-- GROUP BY vehicle_id
-- ON CONFLICT (vehicle_id) DO UPDATE SET ...;
