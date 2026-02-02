-- RLS Fix for scale_batches table
-- This script drops existing policies and re-creates them to ensure Supervisors/Admins can create batches.

-- 1. Enable RLS (ensure it is on)
ALTER TABLE scale_batches ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON scale_batches;
DROP POLICY IF EXISTS "Enable select for authenticated users" ON scale_batches;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON scale_batches;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON scale_batches;

-- 3. Create Permissive Policies for Authenticated Users
-- INSERT
CREATE POLICY "Enable insert for authenticated users" 
ON scale_batches FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- SELECT (Read)
CREATE POLICY "Enable select for authenticated users" 
ON scale_batches FOR SELECT 
TO authenticated 
USING (true);

-- UPDATE
CREATE POLICY "Enable update for authenticated users" 
ON scale_batches FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

-- DELETE
CREATE POLICY "Enable delete for authenticated users" 
ON scale_batches FOR DELETE 
TO authenticated 
USING (true);

-- 4. Verify/Fix Servicos Policies (since batches create services too)
ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable insert for authenticated users on services" ON servicos;
DROP POLICY IF EXISTS "Enable select for authenticated users on services" ON servicos;

CREATE POLICY "Enable insert for authenticated users on services" 
ON servicos FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Enable select for authenticated users on services" 
ON servicos FOR SELECT 
TO authenticated 
USING (true);
