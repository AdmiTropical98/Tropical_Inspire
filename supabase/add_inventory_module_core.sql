-- Inventario independente da Frota
-- Este script apenas cria estruturas novas (prefixo inv_) sem remover ou alterar dados existentes.

create extension if not exists "pgcrypto";

create table if not exists public.inv_offices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  city text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inv_material_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.inv_materials (
  id uuid primary key default gen_random_uuid(),
  office_id uuid references public.inv_offices(id) on delete set null,
  category_id uuid references public.inv_material_categories(id) on delete set null,
  category text,
  name text not null,
  sku text,
  unit text,
  quantity numeric(14, 3) not null default 0,
  minimum_quantity numeric(14, 3) not null default 0,
  maximum_quantity numeric(14, 3),
  unit_cost numeric(14, 3) default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inv_materials_unique_sku unique (sku)
);

create table if not exists public.inv_equipments (
  id uuid primary key default gen_random_uuid(),
  office_id uuid references public.inv_offices(id) on delete set null,
  name text not null,
  serial_number text,
  model text,
  brand text,
  status text not null default 'available' check (status in ('available', 'assigned', 'maintenance', 'retired')),
  assigned_user_id text,
  qr_code text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inv_equipments_unique_serial unique (serial_number)
);

create table if not exists public.inv_movements (
  id uuid primary key default gen_random_uuid(),
  office_id uuid references public.inv_offices(id) on delete set null,
  material_id uuid references public.inv_materials(id) on delete set null,
  equipment_id uuid references public.inv_equipments(id) on delete set null,
  movement_type text not null check (movement_type in ('entry', 'exit', 'transfer')),
  quantity numeric(14, 3),
  source_office_id uuid references public.inv_offices(id) on delete set null,
  target_office_id uuid references public.inv_offices(id) on delete set null,
  created_by uuid,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.inv_reports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null,
  period_start date,
  period_end date,
  filters jsonb,
  generated_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists inv_materials_office_idx on public.inv_materials(office_id);
create index if not exists inv_materials_category_idx on public.inv_materials(category_id);
create index if not exists inv_materials_name_idx on public.inv_materials(name);
create index if not exists inv_equipments_office_idx on public.inv_equipments(office_id);
create index if not exists inv_equipments_name_idx on public.inv_equipments(name);
create index if not exists inv_movements_created_at_idx on public.inv_movements(created_at desc);
create index if not exists inv_movements_office_idx on public.inv_movements(office_id);
create index if not exists inv_movements_material_idx on public.inv_movements(material_id);
create index if not exists inv_movements_equipment_idx on public.inv_movements(equipment_id);

-- Adicionar coluna category e qr_code se ainda nao existirem (compatibilidade)
alter table public.inv_materials add column if not exists category text;
alter table public.inv_materials add column if not exists qr_code text;

-- Converter assigned_user_id para text (armazena nome da pessoa)
do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'inv_equipments' and column_name = 'assigned_user_id' and data_type = 'uuid') then
    alter table public.inv_equipments alter column assigned_user_id type text;
  end if;
end $$;

-- ──────────────────────────────────────────────────────────
-- Row Level Security
-- ──────────────────────────────────────────────────────────
alter table public.inv_offices enable row level security;
alter table public.inv_materials enable row level security;
alter table public.inv_equipments enable row level security;
alter table public.inv_movements enable row level security;
alter table public.inv_material_categories enable row level security;
alter table public.inv_reports enable row level security;

-- Politicas: utilizadores autenticados têm acesso total ao inventário
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'inv_offices' and policyname = 'inv_offices_auth') then
    create policy "inv_offices_auth" on public.inv_offices for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'inv_materials' and policyname = 'inv_materials_auth') then
    create policy "inv_materials_auth" on public.inv_materials for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'inv_equipments' and policyname = 'inv_equipments_auth') then
    create policy "inv_equipments_auth" on public.inv_equipments for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'inv_movements' and policyname = 'inv_movements_auth') then
    create policy "inv_movements_auth" on public.inv_movements for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'inv_material_categories' and policyname = 'inv_material_categories_auth') then
    create policy "inv_material_categories_auth" on public.inv_material_categories for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'inv_reports' and policyname = 'inv_reports_auth') then
    create policy "inv_reports_auth" on public.inv_reports for all to authenticated using (true) with check (true);
  end if;
end $$;

-- Permissoes base do modulo Inventario para o sistema granular
insert into public.role_permissions_defaults (role, permissions, updated_at)
values
  ('ADMIN_MASTER', coalesce((select permissions from public.role_permissions_defaults where role = 'ADMIN_MASTER'), '{}'::jsonb) || '{"inventario": ["ver", "criar", "editar", "eliminar", "exportar", "aprovar"]}'::jsonb, now()),
  ('ADMIN', coalesce((select permissions from public.role_permissions_defaults where role = 'ADMIN'), '{}'::jsonb) || '{"inventario": ["ver", "criar", "editar", "eliminar", "exportar", "aprovar"]}'::jsonb, now())
on conflict (role) do update
set permissions = excluded.permissions,
    updated_at = excluded.updated_at;
