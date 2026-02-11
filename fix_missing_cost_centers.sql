-- FIX: Backfill missing Cost Center IDs in Via Verde and Charging records
-- This script links existing records to the Cost Center assigned to their Vehicle.

-- 1. Update Via Verde Toll Records
UPDATE via_verde_toll_records
SET cost_center_id = viaturas.centro_custo_id
FROM viaturas
WHERE via_verde_toll_records.vehicle_id = viaturas.id
  AND via_verde_toll_records.cost_center_id IS NULL
  AND viaturas.centro_custo_id IS NOT NULL;

-- 2. Update Electric Charging Records
UPDATE electric_charging_records
SET cost_center_id = viaturas.centro_custo_id
FROM viaturas
WHERE electric_charging_records.vehicle_id = viaturas.id
  AND electric_charging_records.cost_center_id IS NULL
  AND viaturas.centro_custo_id IS NOT NULL;

-- 3. Verify results (Optional - just returns count of updated rows if run in editor)
-- SELECT count(*) FROM via_verde_toll_records WHERE cost_center_id IS NOT NULL;
