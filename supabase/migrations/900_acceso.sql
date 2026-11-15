-- Acceso. Corre al final (prefijo 900) para cubrir todas las tablas.
--
-- Quién ve qué:
--   * persona con rol_org 'admin': todas las campañas de su equipo, como Administración.
--   * el resto: solo las campañas donde está en miembros_campana, con ese rol.
-- Roles por campaña:
--   Administración: todo, incluido el equipo de la campaña.   Análisis: lee y escribe datos.
--   Solo lectura: lee todo, no escribe.                        Cliente: lee todo menos notas internas, no escribe.

-- Cada función devuelve un conjunto sin parámetros: Postgres la evalúa una vez por consulta, no por fila.
create or replace function public.mis_personas() returns setof text
language sql stable security definer set search_path = public as $$
  select p.id from public.personas p where p.user_id = auth.uid() and p.activa;
$$;

create or replace function public.mis_orgs() returns setof text
language sql stable security definer set search_path = public as $$
  select p.org_id from public.personas p where p.user_id = auth.uid() and p.activa;
$$;

-- Equipos donde quien consulta es del equipo interno (no cliente ni invitado externo).
create or replace function public.orgs_equipo() returns setof text
language sql stable security definer set search_path = public as $$
  select p.org_id from public.personas p where p.user_id = auth.uid() and p.activa and p.rol_org in ('admin','miembro');
$$;

create or replace function public.campanas_con_rol(p_roles text[]) returns setof text
language sql stable security definer set search_path = public as $$
  select c.id from public.campanas c
  join public.personas p on p.org_id = c.org_id and p.user_id = auth.uid() and p.activa
  where p.rol_org = 'admin' and 'Administración' = any (p_roles)
  union
  select m.campana_id from public.miembros_campana m
  join public.personas p on p.id = m.persona_id and p.user_id = auth.uid() and p.activa
  where m.rol = any (p_roles);
$$;

create or replace function public.campanas_visibles() returns setof text
language sql stable security definer set search_path = public as $$
  select public.campanas_con_rol(array['Administración','Análisis','Solo lectura','Cliente']);
$$;
create or replace function public.campanas_internas() returns setof text
language sql stable security definer set search_path = public as $$
  select public.campanas_con_rol(array['Administración','Análisis','Solo lectura']);
$$;
create or replace function public.campanas_editables() returns setof text
language sql stable security definer set search_path = public as $$
  select public.campanas_con_rol(array['Administración','Análisis']);
$$;
create or replace function public.campanas_administrables() returns setof text
language sql stable security definer set search_path = public as $$
  select public.campanas_con_rol(array['Administración']);
$$;

-- Rol de quien consulta en una campaña (para la interfaz).
create or replace function public.mi_rol(p_campana text) returns text
language sql stable security definer set search_path = public as $$
  select case
    when p_campana in (select public.campanas_administrables()) then 'Administración'
    else (select m.rol from public.miembros_campana m where m.campana_id = p_campana and m.persona_id in (select public.mis_personas()) limit 1)
  end;
$$;

-- Nombres visibles del equipo para quien no puede leer `personas` (rol Cliente, invitados externos):
-- solo id, nombre corto e iniciales de quienes son miembros de alguna campaña que quien consulta ve,
-- más quienes administran el equipo de esas campañas (son Administración en todas). Nada más de la persona.
create or replace function public.personas_de_mis_campanas()
returns table (id text, nombre_corto text, iniciales text)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(p.nombre_corto, p.nombre), p.iniciales
  from public.personas p
  where p.activa and (
    p.id in (select m.persona_id from public.miembros_campana m where m.campana_id in (select public.campanas_visibles()))
    or (p.rol_org = 'admin' and p.org_id in (select c.org_id from public.campanas c where c.id in (select public.campanas_visibles())))
  );
$$;
-- La app la lee como tabla: useTabla('v_personas_campana').
create view public.v_personas_campana with (security_invoker = true) as
  select * from public.personas_de_mis_campanas();

-- Al crear una cuenta, se enlaza con la persona que tenga ese correo.
create or replace function public.al_crear_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.personas set user_id = new.id where user_id is null and lower(email) = lower(new.email);
  return new;
end;
$$;
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'users') then
    drop trigger if exists la_iguana_al_crear_usuario on auth.users;
    create trigger la_iguana_al_crear_usuario after insert on auth.users
      for each row execute function public.al_crear_usuario();
  end if;
end $$;

-- ---------- permisos de tabla ----------
revoke all on all tables in schema public from anon, public;
revoke all on all functions in schema public from anon, public;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- ---------- equipo ----------
alter table public.organizaciones enable row level security;
create policy org_lee on public.organizaciones for select to authenticated using (id in (select public.mis_orgs()));

alter table public.personas enable row level security;
create policy personas_lee on public.personas for select to authenticated
  using (user_id = (select auth.uid()) or org_id in (select public.orgs_equipo()));
-- altas y cambios de personas: solo por invitar_persona() y crear_campana().

alter table public.borradores enable row level security;
create policy borradores_propios on public.borradores for all to authenticated
  using (persona_id in (select public.mis_personas()))
  with check (persona_id in (select public.mis_personas()) and org_id in (select public.orgs_equipo()));

-- ---------- campañas ----------
alter table public.campanas enable row level security;
create policy campanas_lee on public.campanas for select to authenticated using (id in (select public.campanas_visibles()));
create policy campanas_cambia on public.campanas for update to authenticated
  using (id in (select public.campanas_administrables())) with check (id in (select public.campanas_administrables()));
-- altas: solo por crear_campana(). Sin borrado desde la app.

alter table public.miembros_campana enable row level security;
create policy miembros_lee on public.miembros_campana for select to authenticated using (campana_id in (select public.campanas_visibles()));
create policy miembros_alta on public.miembros_campana for insert to authenticated with check (campana_id in (select public.campanas_administrables()));
create policy miembros_cambia on public.miembros_campana for update to authenticated
  using (campana_id in (select public.campanas_administrables())) with check (campana_id in (select public.campanas_administrables()));
create policy miembros_baja on public.miembros_campana for delete to authenticated using (campana_id in (select public.campanas_administrables()));

-- ---------- figuras (del equipo) ----------
alter table public.figuras enable row level security;
create policy figuras_lee on public.figuras for select to authenticated using (
  org_id in (select public.orgs_equipo())
  or id in (select cf.figura_id from public.campana_figuras cf where cf.campana_id in (select public.campanas_visibles()))
);
create policy figuras_alta on public.figuras for insert to authenticated with check (org_id in (select public.orgs_equipo()));
create policy figuras_cambia on public.figuras for update to authenticated
  using (org_id in (select public.orgs_equipo())) with check (org_id in (select public.orgs_equipo()));

-- ---------- notas internas: el rol Cliente no las lee ----------
alter table public.notas_internas enable row level security;
create policy notas_lee on public.notas_internas for select to authenticated using (campana_id in (select public.campanas_internas()));
create policy notas_alta on public.notas_internas for insert to authenticated with check (campana_id in (select public.campanas_editables()));
create policy notas_cambia on public.notas_internas for update to authenticated
  using (campana_id in (select public.campanas_editables())) with check (campana_id in (select public.campanas_editables()));
create policy notas_baja on public.notas_internas for delete to authenticated using (campana_id in (select public.campanas_editables()));

-- ---------- el resto de las tablas con campana_id: leen los miembros, escriben Administración y Análisis ----------
do $$
declare t text;
begin
  for t in
    select c.table_name from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'campana_id' and tb.table_type = 'BASE TABLE'
      and c.table_name not in ('miembros_campana', 'notas_internas')
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (campana_id in (select public.campanas_visibles()))', t || '_lee', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (campana_id in (select public.campanas_editables()))', t || '_alta', t);
    execute format('create policy %I on public.%I for update to authenticated using (campana_id in (select public.campanas_editables())) with check (campana_id in (select public.campanas_editables()))', t || '_cambia', t);
    execute format('create policy %I on public.%I for delete to authenticated using (campana_id in (select public.campanas_editables()))', t || '_baja', t);
  end loop;
end $$;

-- Red de seguridad: ninguna tabla pública queda sin RLS.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and not rowsecurity loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
