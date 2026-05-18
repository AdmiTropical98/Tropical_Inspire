-- Migration to add driver availability fields
-- RUN THIS IN SUPABASE SQL EDITOR

-- 1. Add columns to motoristas table
ALTER TABLE public.motoristas
ADD COLUMN IF NOT EXISTS shifts JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS zones TEXT[] DEFAULT ARRAY['albufeira', 'quarteira'],
ADD COLUMN IF NOT EXISTS blocked_periods JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS max_daily_services INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS min_interval_minutes INTEGER DEFAULT 30;

-- 2. Update existing records with defaults if they were null (due to pre-existing columns without defaults)
UPDATE public.motoristas SET shifts = '[]'::jsonb WHERE shifts IS NULL;
UPDATE public.motoristas SET zones = ARRAY['albufeira', 'quarteira'] WHERE zones IS NULL;
UPDATE public.motoristas SET blocked_periods = '[]'::jsonb WHERE blocked_periods IS NULL;
UPDATE public.motoristas SET min_interval_minutes = 30 WHERE min_interval_minutes IS NULL;
