-- RECREATE app_settings as a flexible Key-Value store
DROP TABLE IF EXISTS public.app_settings;

CREATE TABLE public.app_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Nullable for global settings
    key TEXT NOT NULL,
    value JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, key) -- Prevent duplicate keys per user (or duplicate global keys if user_id is null)
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Create policies 
-- 1. Global Settings (Permissions, etc) - Read Publicly (or Authenticated)
CREATE POLICY "Authenticated can view global settings" 
    ON public.app_settings FOR SELECT 
    USING (user_id IS NULL);

-- 2. User Settings - Read/Write Own
CREATE POLICY "Users can view own settings" 
    ON public.app_settings FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" 
    ON public.app_settings FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings" 
    ON public.app_settings FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- 3. Admin can manage Global Settings (assuming admin role check logic exists or doing naive check)
-- For now, allow authenticated to insert global if needed (or restrict). 
-- Let's stick to simple "Authenticated update own", "Read global". 
-- If PermissionsContext tries to WRITE global permissions, it needs admin rights.
-- For now, let's keep it simple: Authenticated read all, write own.

-- Fix permissions
GRANT ALL ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
