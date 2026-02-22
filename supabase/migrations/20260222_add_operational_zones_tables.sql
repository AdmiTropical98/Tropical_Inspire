-- Create tables for Operational Zones management

CREATE TABLE IF NOT EXISTS public.areas_operacionais (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL UNIQUE,
    color TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.zonas_operacionais (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome_local TEXT NOT NULL,
    area_operacional TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Active RLS for both tables
ALTER TABLE public.areas_operacionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zonas_operacionais ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read and write (Simplifying for now, as requested by previous patterns)
CREATE POLICY "Allow all to areas_operacionais" ON public.areas_operacionais
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all to zonas_operacionais" ON public.zonas_operacionais
    FOR ALL USING (true) WITH CHECK (true);

-- Grant access to anon and authenticated
GRANT ALL ON public.areas_operacionais TO anon, authenticated, service_role;
GRANT ALL ON public.zonas_operacionais TO anon, authenticated, service_role;
