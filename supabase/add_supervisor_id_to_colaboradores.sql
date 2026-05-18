-- Add supervisor ownership field to colaboradores so each supervisor can manage their team.

alter table if exists public.colaboradores
  add column if not exists supervisor_id uuid references public.supervisores(id) on delete set null;

create index if not exists idx_colaboradores_supervisor
  on public.colaboradores (supervisor_id);
