-- Add missing 'telemovel' column to 'oficina_users' table
ALTER TABLE public.oficina_users ADD COLUMN IF NOT EXISTS telemovel TEXT;

-- Verify if other potentially missing columns from recent schema updates exist
-- (checking based on schema.sql definition)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'oficina_users' AND column_name = 'email') THEN
        ALTER TABLE public.oficina_users ADD COLUMN email TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'oficina_users' AND column_name = 'blocked_permissions') THEN
        ALTER TABLE public.oficina_users ADD COLUMN blocked_permissions JSONB;
    END IF;
END $$;
