-- Migration: Populate Operation Threads from User Profiles
-- Created: 2026-02-22

-- This migration ensures that every existing user has a corresponding "general" thread
-- in the new operational center, allowing the UI to show the contact list correctly.

INSERT INTO public.operation_threads (id, type, title, related_user, status)
SELECT 
  gen_random_uuid(),
  'general',
  COALESCE(nome, email, 'Utilizador'),
  id,
  'active'
FROM public.user_profiles up
WHERE NOT EXISTS (
  SELECT 1 FROM public.operation_threads ot 
  WHERE ot.related_user = up.id 
  AND ot.type = 'general'
);
