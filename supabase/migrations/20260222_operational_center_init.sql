-- Migration: Operational Center Initialization
-- Created: 2026-02-22

-- 1. Create operation_threads table
CREATE TABLE IF NOT EXISTS public.operation_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('alert', 'schedule', 'fleet', 'team', 'general')),
    title TEXT NOT NULL,
    related_user UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    related_vehicle UUID REFERENCES public.viaturas(id) ON DELETE SET NULL,
    related_schedule UUID REFERENCES public.servicos(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'archived')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create operation_messages table
CREATE TABLE IF NOT EXISTS public.operation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID REFERENCES public.operation_threads(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id),
    message TEXT NOT NULL,
    system_generated BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.operation_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_messages ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- For simplicity and matching current project style, we allow authenticated users to see threads.
-- In a more restrictive environment, we'd limit this.
CREATE POLICY "Users can view threads" ON public.operation_threads
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create threads" ON public.operation_threads
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update threads" ON public.operation_threads
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can view messages" ON public.operation_messages
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert messages" ON public.operation_messages
    FOR INSERT TO authenticated WITH CHECK (true);

-- 5. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.operation_threads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.operation_messages;

-- 6. Initial Migration for "General" threads
-- Note: Since existing conversations are in localStorage, they cannot be migrated via SQL.
-- We will handle the "general" category in the UI.
