-- Migration: Create operation_events table
-- Created: 2026-02-22

CREATE TABLE IF NOT EXISTS public.operation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL CHECK (category IN ('alert', 'schedule', 'fleet', 'team', 'general', 'escalas', 'equipa', 'frota', 'geral')),
    title TEXT NOT NULL,
    description TEXT,
    related_entity UUID,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.operation_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Public Access Events" ON public.operation_events FOR ALL USING (true) WITH CHECK (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.operation_events;
