alter table public.driver_payroll_manual
  add column if not exists liquido numeric(12,2) not null default 0,
  add column if not exists descricao_acordo text;

update public.driver_payroll_manual
set descricao_acordo = coalesce(nullif(descricao_acordo, ''), observacoes, 'Sem descrição de acordo')
where descricao_acordo is null or descricao_acordo = '';

alter table public.driver_payroll_manual
  alter column descricao_acordo set not null;
