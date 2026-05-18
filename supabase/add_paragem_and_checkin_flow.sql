-- Migration for existing environments: replace cost-center usage with paragem
-- and add QR/NFC check-in confirmation flow.

create extension if not exists pgcrypto;

alter table if exists public.colaboradores
  add column if not exists paragem text;

create table if not exists public.transporte_checkins (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  token text not null,
  metodo text not null check (metodo in ('qr', 'nfc')),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'expired', 'cancelled')),
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  confirmed_by text
);

create index if not exists idx_transporte_checkins_token_pending
  on public.transporte_checkins (token, status);

create index if not exists idx_transporte_checkins_colaborador_pending
  on public.transporte_checkins (colaborador_id, status, requested_at desc);

alter table public.transporte_checkins enable row level security;

drop policy if exists "Public Access" on public.transporte_checkins;
create policy "Public Access"
on public.transporte_checkins
for all
using (true)
with check (true);

alter publication supabase_realtime add table public.transporte_checkins;
