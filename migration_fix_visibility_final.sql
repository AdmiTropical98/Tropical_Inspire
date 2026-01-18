-- FINAL FIX FOR USER VISIBILITY
-- Run this in Supabase SQL Editor to restore access to all user tables.

-- 1. MOTORISTAS
ALTER TABLE public.motoristas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access" ON public.motoristas;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.motoristas;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.motoristas;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.motoristas;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON public.motoristas;
CREATE POLICY "Public Access" ON public.motoristas FOR ALL USING (true) WITH CHECK (true);

-- 2. SUPERVISORES
ALTER TABLE public.supervisores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access" ON public.supervisores;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.supervisores;
CREATE POLICY "Public Access" ON public.supervisores FOR ALL USING (true) WITH CHECK (true);

-- 3. GESTORES
ALTER TABLE public.gestores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access" ON public.gestores;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.gestores;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.gestores;
CREATE POLICY "Public Access" ON public.gestores FOR ALL USING (true) WITH CHECK (true);

-- 4. OFICINA USERS
ALTER TABLE public.oficina_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Access" ON public.oficina_users;
CREATE POLICY "Public Access" ON public.oficina_users FOR ALL USING (true) WITH CHECK (true);
