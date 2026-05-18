-- Create user_layouts table to fix 404 errors
CREATE TABLE IF NOT EXISTS public.user_layouts (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    layout_data JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_layouts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own layout" 
    ON public.user_layouts FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own layout" 
    ON public.user_layouts FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own layout" 
    ON public.user_layouts FOR INSERT 
    WITH CHECK (auth.uid() = user_id);
    
-- Fix permissions if needed
GRANT ALL ON public.user_layouts TO authenticated;
GRANT ALL ON public.user_layouts TO service_role;
