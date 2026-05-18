-- Migration: fuel_tank_resync.sql
ALTER TABLE fuel_tank ADD COLUMN IF NOT EXISTS baseline_totalizer NUMERIC DEFAULT 0;

-- Se o totalizador atual estiver zerado, usamos o valor atual da bomba como baseline
UPDATE fuel_tank SET baseline_totalizer = pump_totalizer WHERE baseline_totalizer IS NULL OR baseline_totalizer = 0;
