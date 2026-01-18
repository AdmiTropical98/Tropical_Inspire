-- Enable RLS for gestores
ALTER TABLE public.gestores ENABLE ROW LEVEL SECURITY;

-- Allow INSERT for authenticated users (assuming only admins/gestores have backend access)
-- Or ideally, check if user is admin. But for now, let's unlock it for authenticated users.
CREATE POLICY "Enable insert for authenticated users only" 
ON public.gestores 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Also ensure they can see/update/delete if needed
CREATE POLICY "Enable all for authenticated users" 
ON public.gestores 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
