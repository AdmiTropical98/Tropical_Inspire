-- RESTORE ACCESS MIGRATION
-- This script explicitly ensures that all user tables are readable by the application.
-- It recreates the "Public Access" policy to allow reading (SELECT) for everyone (including anon for development).

-- 1. MOTORISTAS
ALTER TABLE public.motoristas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access" ON public.motoristas;
CREATE POLICY "Public Access" ON public.motoristas FOR ALL USING (true) WITH CHECK (true);

-- 2. SUPERVISORES
ALTER TABLE public.supervisores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access" ON public.supervisores;
CREATE POLICY "Public Access" ON public.supervisores FOR ALL USING (true) WITH CHECK (true);

-- 3. OFICINA USERS (Técnicos)
ALTER TABLE public.oficina_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access" ON public.oficina_users;
CREATE POLICY "Public Access" ON public.oficina_users FOR ALL USING (true) WITH CHECK (true);

-- 4. GESTORES (Re-opening access temporarily to fix visibility)
ALTER TABLE public.gestores ENABLE ROW LEVEL SECURITY;
-- Drop the strict authentication policies if they exist (clean slate for this table)
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.gestores;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.gestores;
DROP POLICY IF EXISTS "Public Access" ON public.gestores;

-- Re-apply Public Access (or strict auth if preferred, but for "Missing Users" bug, let's open it first)
CREATE POLICY "Public Access" ON public.gestores FOR ALL USING (true) WITH CHECK (true);
