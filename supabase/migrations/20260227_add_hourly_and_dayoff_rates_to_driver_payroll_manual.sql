alter table public.driver_payroll_manual
  add column if not exists valor_hora_bruto numeric(12,2) not null default 0,
  add column if not exists valor_folga_bruto numeric(12,2) not null default 0;

update public.driver_payroll_manual
set valor_hora_bruto = round((coalesce(valor_horas_extra, 0) / nullif(coalesce(horas_extra, 0), 0))::numeric, 2)
where coalesce(valor_hora_bruto, 0) = 0
  and coalesce(horas_extra, 0) > 0
  and coalesce(valor_horas_extra, 0) > 0;

update public.driver_payroll_manual
set valor_folga_bruto = round((coalesce(valor_folgas, 0) / nullif(coalesce(folgas_trabalhadas, 0), 0))::numeric, 2)
where coalesce(valor_folga_bruto, 0) = 0
  and coalesce(folgas_trabalhadas, 0) > 0
  and coalesce(valor_folgas, 0) > 0;
