-- Create colaboradores and presencas_transporte tables for transport collaborator module
-- Run this script in Supabase SQL Editor for environments that still lack these tables.

create extension if not exists pgcrypto;

create table if not exists public.colaboradores (
  id uuid primary key default gen_random_uuid(),
  numero text not null,
  nome text not null,
  paragem text,
  centro_custo_id uuid references public.centros_custos(id) on delete set null,
  supervisor_id uuid references public.supervisores(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_colaboradores_numero_unique
  on public.colaboradores (numero);

create index if not exists idx_colaboradores_status
  on public.colaboradores (status);

create index if not exists idx_colaboradores_supervisor
  on public.colaboradores (supervisor_id);

create table if not exists public.presencas_transporte (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  viatura_id text,
  tipo text not null check (tipo in ('entrada', 'saida')),
  data_hora timestamptz not null default now(),
  latitude numeric,
  longitude numeric
);

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

create index if not exists idx_presencas_transporte_colaborador_data
  on public.presencas_transporte (colaborador_id, data_hora desc);

create index if not exists idx_transporte_checkins_token_pending
  on public.transporte_checkins (token, status);

create index if not exists idx_transporte_checkins_colaborador_pending
  on public.transporte_checkins (colaborador_id, status, requested_at desc);

alter table public.colaboradores enable row level security;
alter table public.presencas_transporte enable row level security;
alter table public.transporte_checkins enable row level security;

drop policy if exists "Public Access" on public.colaboradores;
create policy "Public Access"
on public.colaboradores
for all
using (true)
with check (true);

drop policy if exists "Public Access" on public.presencas_transporte;
create policy "Public Access"
on public.presencas_transporte
for all
using (true)
with check (true);

drop policy if exists "Public Access" on public.transporte_checkins;
create policy "Public Access"
on public.transporte_checkins
for all
using (true)
with check (true);

alter publication supabase_realtime add table public.colaboradores;
alter publication supabase_realtime add table public.presencas_transporte;
alter publication supabase_realtime add table public.transporte_checkins;
