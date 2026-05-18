-- Migration: add_fuel_tank_baseline.sql
-- Description: Adds baseline fields to fuel_tank table to support sequential chronology.

ALTER TABLE fuel_tank ADD COLUMN IF NOT EXISTS baseline_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE fuel_tank ADD COLUMN IF NOT EXISTS baseline_level NUMERIC(15,2);

-- Set an initial baseline if none exists (use current values)
UPDATE fuel_tank 
SET baseline_date = NOW(), 
    baseline_level = current_level 
WHERE baseline_date IS NULL;
