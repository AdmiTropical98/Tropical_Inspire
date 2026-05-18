-- Migration: Create Conversations Table for Message Center
-- Created: 2026-02-22

-- 1. Create Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_at TIMESTAMPTZ,
    UNIQUE(user_id, participant_id)
);

-- 2. Create Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'normal', -- 'normal', 'alerta', 'operacional', 'sistema'
    metadata JSONB,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 4. Policies for Conversations
-- Users can see their own conversations
CREATE POLICY "Users can view own conversations" ON public.conversations
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR participant_id = auth.uid());

-- Users can create conversations
CREATE POLICY "Users can create conversations" ON public.conversations
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- 5. Policies for Messages
-- Users can view messages in their conversations
CREATE POLICY "Users can view messages in own conversations" ON public.messages
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.conversations
            WHERE id = conversation_id
            AND (user_id = auth.uid() OR participant_id = auth.uid())
        )
    );

-- Users can insert messages
CREATE POLICY "Users can insert messages" ON public.messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.conversations
            WHERE id = conversation_id
            AND (user_id = auth.uid() OR participant_id = auth.uid())
        )
    );

-- Users can update their own messages
CREATE POLICY "Users can update messages" ON public.messages
    FOR UPDATE
    TO authenticated
    USING (sender_id = auth.uid());

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_id ON public.conversations(participant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON public.conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
