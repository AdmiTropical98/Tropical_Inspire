alter table public.driver_payroll_manual
  add column if not exists regime_salarial text,
  add column if not exists vencimento_base numeric(12,2) not null default 0,
  add column if not exists abonos numeric(12,2) not null default 0,
  add column if not exists horas_extra_25 numeric(12,2) not null default 0,
  add column if not exists horas_extra_37_5 numeric(12,2) not null default 0,
  add column if not exists horas_feriado numeric(12,2) not null default 0,
  add column if not exists outros_ajustes numeric(12,2) not null default 0;

alter table public.driver_payroll_manual
  drop constraint if exists driver_payroll_manual_regime_salarial_check;

alter table public.driver_payroll_manual
  add constraint driver_payroll_manual_regime_salarial_check
  check (
    regime_salarial is null
    or regime_salarial in ('Base Mensal', 'Valor Diário', 'Carta CAM', 'Personalizado')
  );

-- Migração de compatibilidade para dados antigos (se as colunas legadas existirem)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'driver_payroll_manual'
      and column_name = 'ordenado_base'
  ) then
    execute '
      update public.driver_payroll_manual
      set vencimento_base = coalesce(nullif(vencimento_base, 0), ordenado_base, 0)
    ';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'driver_payroll_manual'
      and column_name = 'outros_abonos'
  ) then
    execute '
      update public.driver_payroll_manual
      set abonos = coalesce(nullif(abonos, 0), outros_abonos, 0)
    ';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'driver_payroll_manual'
      and column_name = 'valor_folgas'
  ) then
    execute '
      update public.driver_payroll_manual
      set folgas_trabalhadas = coalesce(nullif(folgas_trabalhadas, 0), valor_folgas, 0)
    ';
  end if;
end;
$$;