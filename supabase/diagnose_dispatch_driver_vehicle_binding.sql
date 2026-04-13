-- Diagnose and remediate Dispatch Board driver -> vehicle binding issues
-- Focus: persisted association overriding live Cartrack assignment.

-- ============================================================
-- 1. Confirm schema exists
-- ============================================================

select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'motoristas'
  and column_name in ('viatura_id', 'cartrack_id', 'cartrack_key', 'current_vehicle');

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('motorista_viatura_assoc', 'driver_vehicle_sessions');

-- ============================================================
-- 2. Inspect target vehicle
-- Replace AG-11-FG if needed
-- ============================================================

select id, matricula, marca, modelo
from public.viaturas
where regexp_replace(upper(matricula), '[^A-Z0-9]', '', 'g') = regexp_replace(upper('AG-11-FG'), '[^A-Z0-9]', '', 'g');

-- ============================================================
-- 3. Inspect candidate drivers
-- Replace names if needed
-- ============================================================

select
  id,
  nome,
  cartrack_id,
  cartrack_key,
  viatura_id,
  current_vehicle,
  status,
  estado_operacional
from public.motoristas
where upper(nome) in ('YURI', 'ROBERT')
order by nome;

-- ============================================================
-- 4. See who is persistently bound to the vehicle right now
-- ============================================================

select
  a.id,
  m.nome as motorista,
  v.matricula as viatura,
  a.origem,
  a.inicio,
  a.fim
from public.motorista_viatura_assoc a
join public.motoristas m on m.id = a.motorista_id
join public.viaturas v on v.id = a.viatura_id
where regexp_replace(upper(v.matricula), '[^A-Z0-9]', '', 'g') = regexp_replace(upper('AG-11-FG'), '[^A-Z0-9]', '', 'g')
order by a.inicio desc;

-- Active only
select
  a.id,
  m.nome as motorista,
  v.matricula as viatura,
  a.origem,
  a.inicio
from public.motorista_viatura_assoc a
join public.motoristas m on m.id = a.motorista_id
join public.viaturas v on v.id = a.viatura_id
where a.fim is null
  and regexp_replace(upper(v.matricula), '[^A-Z0-9]', '', 'g') = regexp_replace(upper('AG-11-FG'), '[^A-Z0-9]', '', 'g')
order by a.inicio desc;

-- ============================================================
-- 5. See who still has AG-11-FG persisted in motoristas
-- ============================================================

select
  id,
  nome,
  viatura_id,
  current_vehicle,
  cartrack_id,
  cartrack_key
from public.motoristas
where regexp_replace(upper(coalesce(current_vehicle, '')), '[^A-Z0-9]', '', 'g') = regexp_replace(upper('AG-11-FG'), '[^A-Z0-9]', '', 'g')
   or viatura_id = (
      select id
      from public.viaturas
      where regexp_replace(upper(matricula), '[^A-Z0-9]', '', 'g') = regexp_replace(upper('AG-11-FG'), '[^A-Z0-9]', '', 'g')
      limit 1
   )
order by nome;

-- ============================================================
-- 6. Active driver_vehicle_sessions for AG-11-FG / Yuri / Robert
-- ============================================================

select
  s.id,
  m.nome as motorista,
  s.vehicle_id,
  s.start_time,
  s.end_time,
  s.active
from public.driver_vehicle_sessions s
join public.motoristas m on m.id = s.driver_id
where m.nome in ('YURI', 'ROBERT')
   or s.vehicle_id in (
      select id::text
      from public.viaturas
      where regexp_replace(upper(matricula), '[^A-Z0-9]', '', 'g') = regexp_replace(upper('AG-11-FG'), '[^A-Z0-9]', '', 'g')
   )
order by s.start_time desc;

-- ============================================================
-- 7. Matrix view: compare all active bindings at once
-- ============================================================

with vehicle_target as (
  select id, matricula
  from public.viaturas
  where regexp_replace(upper(matricula), '[^A-Z0-9]', '', 'g') = regexp_replace(upper('AG-11-FG'), '[^A-Z0-9]', '', 'g')
  limit 1
),
assoc as (
  select a.motorista_id, a.viatura_id, a.origem, a.inicio
  from public.motorista_viatura_assoc a
  where a.fim is null
),
sessions as (
  select distinct on (s.driver_id)
    s.driver_id,
    s.vehicle_id,
    s.start_time,
    s.active
  from public.driver_vehicle_sessions s
  where s.active = true
  order by s.driver_id, s.start_time desc
)
select
  m.nome,
  m.cartrack_id,
  m.cartrack_key,
  m.current_vehicle,
  persisted_v.matricula as persisted_viatura,
  assoc_v.matricula as assoc_viatura,
  assoc.origem as assoc_source,
  assoc.inicio as assoc_since,
  sessions.vehicle_id as session_vehicle_id,
  session_v.matricula as session_viatura,
  sessions.start_time as session_since,
  case
    when assoc.viatura_id = vt.id then 'ASSOC_MATCH'
    when m.viatura_id = vt.id then 'MOTORISTA_MATCH'
    when sessions.vehicle_id = vt.id::text then 'SESSION_MATCH'
    when regexp_replace(upper(coalesce(m.current_vehicle, '')), '[^A-Z0-9]', '', 'g') = regexp_replace(upper(vt.matricula), '[^A-Z0-9]', '', 'g') then 'CURRENT_VEHICLE_MATCH'
    else 'NO_MATCH'
  end as binding_state
from public.motoristas m
cross join vehicle_target vt
left join public.viaturas persisted_v on persisted_v.id = m.viatura_id
left join assoc on assoc.motorista_id = m.id
left join public.viaturas assoc_v on assoc_v.id = assoc.viatura_id
left join sessions on sessions.driver_id = m.id
left join public.viaturas session_v on session_v.id::text = sessions.vehicle_id
where m.nome in ('YURI', 'ROBERT')
order by m.nome;

-- ============================================================
-- 8. Quick sanity check: multiple active owners for same vehicle
-- ============================================================

select
  v.matricula,
  count(*) as active_assoc_count,
  string_agg(m.nome, ', ' order by m.nome) as motoristas
from public.motorista_viatura_assoc a
join public.motoristas m on m.id = a.motorista_id
join public.viaturas v on v.id = a.viatura_id
where a.fim is null
group by v.matricula
having count(*) > 1
order by active_assoc_count desc, v.matricula;

-- ============================================================
-- 9. Remediation option A: clear stale AG-11-FG association from Yuri
-- Review before executing
-- ============================================================

-- update public.motorista_viatura_assoc
-- set fim = now()
-- where fim is null
--   and motorista_id = (select id from public.motoristas where nome = 'YURI' limit 1)
--   and viatura_id = (
--     select id
--     from public.viaturas
--     where regexp_replace(upper(matricula), '[^A-Z0-9]', '', 'g') = regexp_replace(upper('AG-11-FG'), '[^A-Z0-9]', '', 'g')
--     limit 1
--   );

-- update public.motoristas
-- set viatura_id = null,
--     current_vehicle = null
-- where nome = 'YURI'
--   and (
--     viatura_id = (
--       select id
--       from public.viaturas
--       where regexp_replace(upper(matricula), '[^A-Z0-9]', '', 'g') = regexp_replace(upper('AG-11-FG'), '[^A-Z0-9]', '', 'g')
--       limit 1
--     )
--     or regexp_replace(upper(coalesce(current_vehicle, '')), '[^A-Z0-9]', '', 'g') = regexp_replace(upper('AG-11-FG'), '[^A-Z0-9]', '', 'g')
--   );

-- ============================================================
-- 10. Remediation option B: force AG-11-FG -> Robert as manual association
-- Review before executing
-- ============================================================

-- insert into public.motorista_viatura_assoc (motorista_id, viatura_id, inicio, origem)
-- values (
--   (select id from public.motoristas where nome = 'ROBERT' limit 1),
--   (
--     select id
--     from public.viaturas
--     where regexp_replace(upper(matricula), '[^A-Z0-9]', '', 'g') = regexp_replace(upper('AG-11-FG'), '[^A-Z0-9]', '', 'g')
--     limit 1
--   ),
--   now(),
--   'manual'
-- );

-- ============================================================
-- 11. Integrity checks for broader fleet issues
-- ============================================================

-- Drivers with tag/id but no persisted vehicle and no active assoc
select
  m.id,
  m.nome,
  m.cartrack_id,
  m.cartrack_key,
  m.viatura_id,
  m.current_vehicle
from public.motoristas m
left join public.motorista_viatura_assoc a
  on a.motorista_id = m.id
 and a.fim is null
where (m.cartrack_id is not null or coalesce(m.cartrack_key, '') <> '')
  and m.viatura_id is null
  and a.id is null
order by m.nome;

-- Vehicles actively associated to one driver but persisted on another
select
  v.matricula,
  assoc_m.nome as assoc_motorista,
  persisted_m.nome as persisted_motorista,
  a.origem,
  a.inicio
from public.motorista_viatura_assoc a
join public.viaturas v on v.id = a.viatura_id
join public.motoristas assoc_m on assoc_m.id = a.motorista_id
left join public.motoristas persisted_m on persisted_m.viatura_id = v.id and persisted_m.id <> assoc_m.id
where a.fim is null
  and persisted_m.id is not null
order by v.matricula;