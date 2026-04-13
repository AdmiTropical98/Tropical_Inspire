-- Persisted driver -> vehicle association for Dispatch Board and Linha de Transportes
-- Adds direct relationship in motoristas and a historical association table.

create extension if not exists pgcrypto;

alter table if exists public.motoristas
  add column if not exists viatura_id uuid references public.viaturas(id) on delete set null;

create index if not exists idx_motoristas_viatura_id
  on public.motoristas (viatura_id);

create table if not exists public.motorista_viatura_assoc (
  id uuid primary key default gen_random_uuid(),
  motorista_id uuid not null references public.motoristas(id) on delete cascade,
  viatura_id uuid not null references public.viaturas(id) on delete cascade,
  inicio timestamptz not null default now(),
  fim timestamptz,
  origem text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint motorista_viatura_assoc_period_chk check (fim is null or fim >= inicio)
);

create index if not exists idx_motorista_viatura_assoc_motorista_inicio
  on public.motorista_viatura_assoc (motorista_id, inicio desc);

create index if not exists idx_motorista_viatura_assoc_viatura_inicio
  on public.motorista_viatura_assoc (viatura_id, inicio desc);

create unique index if not exists uq_motorista_viatura_assoc_motorista_ativa
  on public.motorista_viatura_assoc (motorista_id)
  where fim is null;

alter table public.motorista_viatura_assoc enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'motorista_viatura_assoc'
      and policyname = 'Public Access'
  ) then
    create policy "Public Access"
      on public.motorista_viatura_assoc
      for all
      using (true)
      with check (true);
  end if;
end;
$$;

create or replace function public.set_updated_at_motorista_viatura_assoc()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_motorista_viatura_assoc on public.motorista_viatura_assoc;
create trigger trg_set_updated_at_motorista_viatura_assoc
before update on public.motorista_viatura_assoc
for each row
execute function public.set_updated_at_motorista_viatura_assoc();

create or replace function public.close_active_motorista_viatura_assoc()
returns trigger
language plpgsql
as $$
begin
  update public.motorista_viatura_assoc
  set fim = coalesce(new.inicio, now()),
      updated_at = now()
  where motorista_id = new.motorista_id
    and fim is null;

  return new;
end;
$$;

drop trigger if exists trg_close_active_motorista_viatura_assoc on public.motorista_viatura_assoc;
create trigger trg_close_active_motorista_viatura_assoc
before insert on public.motorista_viatura_assoc
for each row
execute function public.close_active_motorista_viatura_assoc();

create or replace function public.sync_motorista_viatura_from_assoc()
returns trigger
language plpgsql
as $$
declare
  v_plate text;
begin
  if new.fim is null then
    select v.matricula into v_plate
    from public.viaturas v
    where v.id = new.viatura_id;

    update public.motoristas m
    set viatura_id = new.viatura_id,
        current_vehicle = coalesce(v_plate, m.current_vehicle)
    where m.id = new.motorista_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_motorista_viatura_from_assoc on public.motorista_viatura_assoc;
create trigger trg_sync_motorista_viatura_from_assoc
after insert or update of viatura_id, fim on public.motorista_viatura_assoc
for each row
execute function public.sync_motorista_viatura_from_assoc();

-- Backfill direct relation from existing current_vehicle plate when possible.
update public.motoristas m
set viatura_id = v.id
from public.viaturas v
where m.viatura_id is null
  and coalesce(trim(m.current_vehicle), '') <> ''
  and regexp_replace(upper(m.current_vehicle), '[^A-Z0-9]', '', 'g') = regexp_replace(upper(v.matricula), '[^A-Z0-9]', '', 'g');

-- Create initial active association rows for currently linked drivers.
insert into public.motorista_viatura_assoc (motorista_id, viatura_id, inicio, origem)
select m.id, m.viatura_id, now(), 'backfill_current_vehicle'
from public.motoristas m
where m.viatura_id is not null
  and not exists (
    select 1
    from public.motorista_viatura_assoc a
    where a.motorista_id = m.id
      and a.fim is null
  );
