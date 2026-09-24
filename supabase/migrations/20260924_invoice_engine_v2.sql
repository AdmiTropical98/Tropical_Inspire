-- Tropical Inspire
-- Invoice Engine V2
-- NON-DESTRUCTIVE: this migration creates only new tables.
-- It does not delete, truncate or rewrite existing invoices/requisitions.

create table if not exists public.invoice_engine_imports (
  id uuid primary key default gen_random_uuid(),
  source_file_name text,
  source_file_path text,
  status text not null default 'draft'
    check (status in ('draft','processing','ready','confirmed','failed')),
  parser_version text not null default 'pdf-text-v2',
  supplier_id uuid null references public.fornecedores(id),
  vehicle_id uuid null references public.viaturas(id),
  cost_center_id uuid null references public.centros_custos(id),
  requisition_id uuid null references public.requisicoes(id),
  existing_invoice_id uuid null references public.supplier_invoices(id),
  invoice_number text,
  issue_date date,
  due_date date,
  gross_amount numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  taxable_amount numeric(14,2) not null default 0,
  vat_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  confidence jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  extracted_json jsonb not null default '{}'::jsonb,
  raw_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoice_engine_lines (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.invoice_engine_imports(id) on delete cascade,
  line_number integer not null,
  description text not null default '',
  unidade_medida text not null default 'UN',
  quantity numeric(14,4) not null default 0,
  unit_price numeric(14,4) not null default 0,
  discount_percentage numeric(8,4) not null default 0,
  net_value numeric(14,2) not null default 0,
  vat_rate numeric(5,2) not null default 0,
  vat_value numeric(14,2) not null default 0,
  total_value numeric(14,2) not null default 0,
  confidence numeric(5,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.invoice_engine_events (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.invoice_engine_imports(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.invoice_engine_supplier_profiles (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null unique references public.fornecedores(id) on delete cascade,
  parser_version text not null default 'pdf-text-v2',
  samples_count integer not null default 0,
  layout_signature text,
  learned_rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_invoice_engine_imports_supplier
  on public.invoice_engine_imports(supplier_id);

create index if not exists idx_invoice_engine_imports_vehicle
  on public.invoice_engine_imports(vehicle_id);

create index if not exists idx_invoice_engine_imports_cost_center
  on public.invoice_engine_imports(cost_center_id);

create index if not exists idx_invoice_engine_imports_requisition
  on public.invoice_engine_imports(requisition_id);

create index if not exists idx_invoice_engine_lines_import
  on public.invoice_engine_lines(import_id);

create index if not exists idx_invoice_engine_events_import
  on public.invoice_engine_events(import_id);

-- RLS: only authenticated application users can access the new engine tables.
alter table public.invoice_engine_imports enable row level security;
alter table public.invoice_engine_lines enable row level security;
alter table public.invoice_engine_events enable row level security;
alter table public.invoice_engine_supplier_profiles enable row level security;

drop policy if exists invoice_engine_imports_authenticated on public.invoice_engine_imports;
create policy invoice_engine_imports_authenticated
  on public.invoice_engine_imports for all to authenticated
  using (true) with check (true);

drop policy if exists invoice_engine_lines_authenticated on public.invoice_engine_lines;
create policy invoice_engine_lines_authenticated
  on public.invoice_engine_lines for all to authenticated
  using (true) with check (true);

drop policy if exists invoice_engine_events_authenticated on public.invoice_engine_events;
create policy invoice_engine_events_authenticated
  on public.invoice_engine_events for all to authenticated
  using (true) with check (true);

drop policy if exists invoice_engine_supplier_profiles_authenticated on public.invoice_engine_supplier_profiles;
create policy invoice_engine_supplier_profiles_authenticated
  on public.invoice_engine_supplier_profiles for all to authenticated
  using (true) with check (true);
