-- Add dashboard_layout column to app_settings table for storing global dashboard configuration
-- Also creates the table if it doesn't exist (robustness)

CREATE TABLE IF NOT EXISTS public.app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Access" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Authenticated Update Access" ON public.app_settings FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated Insert Access" ON public.app_settings FOR INSERT WITH CHECK (auth.role() = 'authenticated');
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;


-- Add the column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app_settings' AND column_name = 'dashboard_layout') THEN
        ALTER TABLE public.app_settings ADD COLUMN dashboard_layout JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;
