-- RE-ENABLE RLS but with PERMISSIVE policies
-- This restores the security framework without blocking data access.

-- 1. Enable RLS
ALTER TABLE public.motoristas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervisores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oficina_users ENABLE ROW LEVEL SECURITY;

-- 2. Drop any old/conflicting policies to be clean
DROP POLICY IF EXISTS "Enable read access for all users" ON public.motoristas;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.motoristas;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.motoristas;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.motoristas;
-- (Repeat for others if needed, or just create new names which makes old ones irrelevant but better to clean)
DROP POLICY IF EXISTS "Allow All" ON public.motoristas;
DROP POLICY IF EXISTS "Allow All" ON public.supervisores;
DROP POLICY IF EXISTS "Allow All" ON public.gestores;
DROP POLICY IF EXISTS "Allow All" ON public.oficina_users;


-- 3. Create BROAD Permissive Policies (matches previous "Public Access" fix)
-- For Motoristas
CREATE POLICY "Allow All Access" ON public.motoristas
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- For Supervisores
CREATE POLICY "Allow All Access" ON public.supervisores
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- For Gestores
CREATE POLICY "Allow All Access" ON public.gestores
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- For Oficina
CREATE POLICY "Allow All Access" ON public.oficina_users
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 4. Grant Permissions (Redundant but safe)
GRANT ALL ON public.motoristas TO authenticated;
GRANT ALL ON public.supervisores TO authenticated;
GRANT ALL ON public.gestores TO authenticated;
GRANT ALL ON public.oficina_users TO authenticated;
GRANT ALL ON public.motoristas TO service_role;
GRANT ALL ON public.supervisores TO service_role;
GRANT ALL ON public.gestores TO service_role;
GRANT ALL ON public.oficina_users TO service_role;
