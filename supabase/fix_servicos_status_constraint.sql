-- Fix servicos_status_check constraint to allow all lifecycle status values
-- Run this in your Supabase SQL editor

ALTER TABLE public.servicos DROP CONSTRAINT IF EXISTS servicos_status_check;

ALTER TABLE public.servicos ADD CONSTRAINT servicos_status_check
  CHECK (status IN (
    -- Lifecycle statuses (used by the app)
    'SCHEDULED',
    'DRIVER_ASSIGNED',
    'EN_ROUTE_ORIGIN',
    'ARRIVED_ORIGIN',
    'BOARDING',
    'EN_ROUTE_DESTINATION',
    'COMPLETED',
    -- Legacy lowercase values (backwards compatibility)
    'scheduled',
    'active',
    'completed',
    'pending',
    'started',
    'URGENTE'
  ));
