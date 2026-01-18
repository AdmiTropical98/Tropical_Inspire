-- FORCE RECREATE app_settings table to fix 42703 error
DROP TABLE IF EXISTS public.app_settings;

CREATE TABLE public.app_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    dashboard_layout JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Create policies 
CREATE POLICY "Users can view own settings" 
    ON public.app_settings FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" 
    ON public.app_settings FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings" 
    ON public.app_settings FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Fix permissions
GRANT ALL ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
