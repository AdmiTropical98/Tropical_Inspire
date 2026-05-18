-- Enable RLS
ALTER TABLE scale_batches ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all authenticated users to view batches
-- This prevents the issue where batches disappear on refresh because the user supposedly "doesn't have access"
DROP POLICY IF EXISTS "Enable read access for all users" ON scale_batches;

CREATE POLICY "Enable read access for all users" ON scale_batches
FOR SELECT
TO authenticated
USING (true);

-- Also allow insert/update for now (simplified permissions model until robust Role system is enforced at DB level)
DROP POLICY IF EXISTS "Enable insert access for all users" ON scale_batches;
CREATE POLICY "Enable insert access for all users" ON scale_batches
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update access for all users" ON scale_batches;
CREATE POLICY "Enable update access for all users" ON scale_batches
FOR UPDATE
TO authenticated
USING (true);
