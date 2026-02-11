-- Fix Schema and Permissions for Via Verde and Carregamentos
-- Created to address persistent insert failures

-- 1. Ensure via_verde_toll_records table exists and has correct permissions
CREATE TABLE IF NOT EXISTS public.via_verde_toll_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_id UUID NOT NULL REFERENCES public.viaturas(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES public.motoristas(id) ON DELETE SET NULL,
    cost_center_id UUID REFERENCES public.centros_custos(id) ON DELETE SET NULL,
    entry_point TEXT NOT NULL,
    exit_point TEXT NOT NULL,
    entry_time TIMESTAMPTZ NOT NULL,
    exit_time TIMESTAMPTZ,
    amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    distance DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- 2. Ensure electric_charging_records table exists
CREATE TABLE IF NOT EXISTS public.electric_charging_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_id UUID NOT NULL REFERENCES public.viaturas(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES public.motoristas(id) ON DELETE SET NULL,
    cost_center_id UUID REFERENCES public.centros_custos(id) ON DELETE SET NULL,
    station_name TEXT NOT NULL,
    date TIMESTAMPTZ NOT NULL,
    kwh DECIMAL(10,2) DEFAULT 0,
    cost DECIMAL(10,2) DEFAULT 0,
    duration INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- 3. Enable RLS
ALTER TABLE public.via_verde_toll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.electric_charging_records ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies to avoid conflicts (clean slate for these tables)
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.via_verde_toll_records;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.electric_charging_records;
DROP POLICY IF EXISTS "Authenticated users can select" ON public.via_verde_toll_records;
DROP POLICY IF EXISTS "Authenticated users can insert" ON public.via_verde_toll_records;
DROP POLICY IF EXISTS "Authenticated users can delete" ON public.via_verde_toll_records;
-- Add other potential policy names here if known, but generic ones are safer to just re-add

-- 5. Create permissive policies for authenticated users (since this is an internal app)
CREATE POLICY "Enable all access for authenticated users" ON public.via_verde_toll_records
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable all access for authenticated users" ON public.electric_charging_records
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 6. Grant basic permissions to authenticated role
GRANT ALL ON public.via_verde_toll_records TO authenticated;
GRANT ALL ON public.electric_charging_records TO authenticated;
