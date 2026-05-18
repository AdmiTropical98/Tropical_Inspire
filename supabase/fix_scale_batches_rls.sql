-- Enable RLS on scale_batches
ALTER TABLE scale_batches ENABLE ROW LEVEL SECURITY;

-- Enable RLS on servicos (if not already enabled)
ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users (Admins/Supervisors) to INSERT scale_batches
CREATE POLICY "Enable insert for authenticated users" 
ON scale_batches FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Policy to allow authenticated users to SELECT scale_batches
CREATE POLICY "Enable select for authenticated users" 
ON scale_batches FOR SELECT 
TO authenticated 
USING (true);

-- Policy to allow authenticated users to INSERT servicos
-- (This is crucial for the batch creation which inserts multiple services)
CREATE POLICY "Enable insert for authenticated users on services" 
ON servicos FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Policy to allow authenticated users to SELECT servicos
CREATE POLICY "Enable select for authenticated users on services" 
ON servicos FOR SELECT 
TO authenticated 
USING (true);

-- Policy to allow authenticated users to UPDATE servicos (e.g. assigning drivers later)
CREATE POLICY "Enable update for authenticated users on services" 
ON servicos FOR UPDATE
TO authenticated 
USING (true)
WITH CHECK (true);

-- Policy to allow authenticated users to DELETE servicos (e.g. removing mistakes)
CREATE POLICY "Enable delete for authenticated users on services" 
ON servicos FOR DELETE
TO authenticated 
USING (true);
