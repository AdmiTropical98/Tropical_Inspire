create table if not exists public.driver_payroll_manual (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.motoristas(id) on delete cascade,
  mes integer not null check (mes between 1 and 12),
  ano integer not null check (ano >= 2000),
  ordenado_base numeric(12,2) not null default 0,
  horas_extra numeric(10,2) not null default 0,
  valor_horas_extra numeric(12,2) not null default 0,
  folgas_trabalhadas numeric(10,2) not null default 0,
  valor_folgas numeric(12,2) not null default 0,
  outros_abonos numeric(12,2) not null default 0,
  descontos numeric(12,2) not null default 0,
  total_bruto numeric(12,2) not null default 0,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (driver_id, mes, ano)
);

create index if not exists idx_driver_payroll_manual_month_year on public.driver_payroll_manual (ano, mes);
create index if not exists idx_driver_payroll_manual_driver on public.driver_payroll_manual (driver_id);

create or replace function public.set_driver_payroll_manual_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_driver_payroll_manual_updated_at on public.driver_payroll_manual;
create trigger trg_driver_payroll_manual_updated_at
before update on public.driver_payroll_manual
for each row
execute function public.set_driver_payroll_manual_updated_at();

alter table public.driver_payroll_manual enable row level security;

drop policy if exists "Enable read access for all users" on public.driver_payroll_manual;
create policy "Enable read access for all users"
on public.driver_payroll_manual for select
using (true);

drop policy if exists "Enable insert for authenticated users only" on public.driver_payroll_manual;
create policy "Enable insert for authenticated users only"
on public.driver_payroll_manual for insert
with check (auth.role() = 'authenticated');

drop policy if exists "Enable update for authenticated users only" on public.driver_payroll_manual;
create policy "Enable update for authenticated users only"
on public.driver_payroll_manual for update
using (auth.role() = 'authenticated');

drop policy if exists "Enable delete for authenticated users only" on public.driver_payroll_manual;
create policy "Enable delete for authenticated users only"
on public.driver_payroll_manual for delete
using (auth.role() = 'authenticated');