-- Migration: fix_fuel_transactions_columns.sql
-- Description: Adds missing columns to fuel_transactions table to support metrics and status tracking.

ALTER TABLE fuel_transactions ADD COLUMN IF NOT EXISTS pump_counter_after NUMERIC;
ALTER TABLE fuel_transactions ADD COLUMN IF NOT EXISTS is_external BOOLEAN DEFAULT false;
ALTER TABLE fuel_transactions ADD COLUMN IF NOT EXISTS consumo_calculado NUMERIC(10,2);
ALTER TABLE fuel_transactions ADD COLUMN IF NOT EXISTS is_anormal BOOLEAN DEFAULT false;
ALTER TABLE fuel_transactions ADD COLUMN IF NOT EXISTS price_per_liter NUMERIC(15,3);
ALTER TABLE fuel_transactions ADD COLUMN IF NOT EXISTS total_cost NUMERIC(15,2);
ALTER TABLE fuel_transactions ADD COLUMN IF NOT EXISTS staff_name TEXT;
