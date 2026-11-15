set client_min_messages = warning;
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

-- Equipos que quien consulta administra (rol_org 'admin').
create or replace function public.orgs_admin() returns setof text
language sql stable security definer set search_path = public as $$
  select p.org_id from public.personas p where p.user_id = auth.uid() and p.activa and p.rol_org = 'admin';
$$;
-- Equipos de las campañas que quien consulta ve (para leer las figuras vinculadas a ellas).
create or replace function public.orgs_visibles() returns setof text
language sql stable security definer set search_path = public as $$
  select c.org_id from public.campanas c where c.id in (select public.campanas_visibles());
$$;
-- Equipos donde quien consulta puede dar de alta o cambiar figuras del directorio:
-- quien administra el equipo, o quien tiene Administración o Análisis en alguna campaña del equipo.
create or replace function public.orgs_editoras() returns setof text
language sql stable security definer set search_path = public as $$
  select public.orgs_admin()
  union
  select c.org_id from public.campanas c where c.id in (select public.campanas_editables());
$$;
-- La persona de quien consulta en el equipo de una campaña (null si no tiene).
create or replace function public.mi_persona_en(p_campana text) returns text
language sql stable security definer set search_path = public as $$
  select p.id from public.personas p join public.campanas c on c.org_id = p.org_id
  where c.id = p_campana and p.user_id = auth.uid() and p.activa
  order by p.creada_en limit 1;
$$;
-- ¿La persona es del mismo equipo que la campaña?
create or replace function public.persona_de_la_campana(p_persona text, p_campana text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.personas p join public.campanas c on c.org_id = p.org_id where p.id = p_persona and c.id = p_campana);
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
create or replace view public.v_personas_campana with (security_invoker = true) as
  select * from public.personas_de_mis_campanas();

-- Al confirmar una cuenta, se enlaza con la persona que tenga ese correo.
--   * Solo con el correo confirmado (email_confirmed_at): un registro sin confirmar no hereda los permisos de nadie.
--   * Solo personas sin cuenta, y solo una (personas.user_id es único): la más antigua, prefiriendo las activas.
--   * Nunca falla: si el enlace choca con otro, la cuenta se crea sin persona y se enlaza a mano.
create or replace function public.al_crear_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_persona text;
begin
  if new.email is null or new.email_confirmed_at is null then return new; end if;
  if tg_op = 'UPDATE' and old.email_confirmed_at is not null then return new; end if;
  if exists (select 1 from public.personas where user_id = new.id) then return new; end if;
  select id into v_persona from public.personas
  where user_id is null and email is not null and lower(email) = lower(new.email)
  order by activa desc, creada_en, id limit 1;
  if v_persona is null then return new; end if;
  begin
    update public.personas set user_id = new.id where id = v_persona and user_id is null;
  exception when unique_violation then
    raise warning 'La Iguana: no se enlazó la cuenta % con la persona %', new.id, v_persona;
  end;
  return new;
exception when others then
  raise warning 'La Iguana: al_crear_usuario falló para %: %', new.id, sqlerrm;
  return new;
end;
$$;
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'users') then
    drop trigger if exists la_iguana_al_crear_usuario on auth.users;
    drop trigger if exists la_iguana_al_confirmar_usuario on auth.users;
    if exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'email_confirmed_at') then
      create trigger la_iguana_al_crear_usuario after insert on auth.users
        for each row execute function public.al_crear_usuario();
      create trigger la_iguana_al_confirmar_usuario after update of email_confirmed_at on auth.users
        for each row execute function public.al_crear_usuario();
    else
      raise warning 'auth.users sin email_confirmed_at: las cuentas no se enlazan con personas';
    end if;
  end if;
end $$;

-- ---------- integridad: lo que las políticas de fila no alcanzan a ver ----------

-- Campañas: id, equipo y autoría no cambian desde la app; es_demo solo lo cambia el servicio.
create or replace function public.campana_inmutable() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.id is distinct from old.id or new.org_id is distinct from old.org_id or new.creada_por is distinct from old.creada_por then
      raise exception 'No se puede cambiar el id, el equipo ni la autoría de una campaña' using errcode = '42501';
    end if;
    if new.es_demo is distinct from old.es_demo then
      raise exception 'No se puede cambiar si una campaña es de demostración' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists la_iguana_10_inmutable on public.campanas;
create trigger la_iguana_10_inmutable before update on public.campanas
  for each row execute function public.campana_inmutable();

-- Referencias: cada fila de campaña solo apunta a filas de su misma campaña (eventos, temas, alertas…)
-- y a figuras y personas de su mismo equipo. Argumentos: 'columna:tabla:campana' o 'columna:tabla:org'.
-- Sin security definer: quien llama solo encuentra las filas que puede leer, así que una referencia que no ve también se rechaza.
-- Con otros roles (semilla, funciones de 850) una referencia aún no cargada se deja pasar: la llave foránea responde por ella.
create or replace function public.revisar_referencias() returns trigger
language plpgsql set search_path = public as $$
declare
  fila jsonb := to_jsonb(new);
  previa jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  v_org text; arg text; partes text[]; val text; dueno text;
begin
  if tg_table_name = 'campanas' then v_org := new.org_id;
  else select org_id into v_org from public.campanas where id = fila->>'campana_id';
  end if;
  foreach arg in array tg_argv loop
    partes := string_to_array(arg, ':');
    val := fila->>partes[1];
    if val is null then continue; end if;
    -- En un cambio, solo se revisa lo que cambió (o todo si la fila cambió de campaña).
    if previa is not null and previa->>partes[1] is not distinct from val
      and previa->>'campana_id' is not distinct from fila->>'campana_id' then continue; end if;
    if partes[3] = 'org' then
      execute format('select org_id from public.%I where id = $1', partes[2]) into dueno using val;
      if dueno is null and current_user not in ('authenticated', 'anon') then continue; end if;
      if dueno is distinct from v_org then
        raise exception '%.% = %: no es del equipo de esta campaña', tg_table_name, partes[1], val using errcode = '42501';
      end if;
    else
      execute format('select campana_id from public.%I where id = $1', partes[2]) into dueno using val;
      if dueno is null and current_user not in ('authenticated', 'anon') then continue; end if;
      if dueno is distinct from fila->>'campana_id' then
        raise exception '%.% = %: no es de esta campaña', tg_table_name, partes[1], val using errcode = '42501';
      end if;
    end if;
  end loop;
  return new;
end;
$$;
do $$
declare r record; args text;
begin
  for r in
    select c.relname as tabla,
      string_agg(quote_literal(a.attname || ':' || rc.relname || ':' || case when rc.relname in ('figuras','personas') then 'org' else 'campana' end), ', ' order by a.attname) as refs
    from pg_constraint k
    join pg_class c on c.oid = k.conrelid join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    join pg_class rc on rc.oid = k.confrelid
    join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
    where k.contype = 'f' and array_length(k.conkey, 1) = 1 and rc.relname not in ('campanas', 'organizaciones')
      and exists (select 1 from information_schema.columns x where x.table_schema = 'public' and x.table_name = rc.relname and x.column_name = case when rc.relname in ('figuras','personas') then 'org_id' else 'campana_id' end)
      and (exists (select 1 from information_schema.columns x where x.table_schema = 'public' and x.table_name = c.relname and x.column_name = 'campana_id') or c.relname = 'campanas')
    group by c.relname
  loop
    args := r.refs;
    if r.tabla = 'campanas' then args := args || ', ' || quote_literal('figura_propia_id:figuras:org'); end if;
    execute format('drop trigger if exists la_iguana_20_referencias on public.%I', r.tabla);
    execute format('create trigger la_iguana_20_referencias before insert or update on public.%I for each row execute function public.revisar_referencias(%s)', r.tabla, args);
  end loop;
end $$;

-- Firmas: autor, quien revisa y quien aprueba son siempre la persona de la sesión (en el equipo de la campaña).
-- Argumentos: columna y 'siempre' (se llena aunque venga vacía) o 'si_hay' (puede quedar vacía).
-- Sin security definer a propósito: current_user debe ser el rol de quien llama (las funciones de 850 firman por su cuenta).
create or replace function public.firmar_como_yo() returns trigger
language plpgsql set search_path = public as $$
declare v_yo text; col text := tg_argv[0]; val text := to_jsonb(new)->>tg_argv[0];
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'UPDATE' and val is not distinct from to_jsonb(old)->>col then return new; end if;
  if val is null and tg_argv[1] = 'si_hay' then return new; end if;
  v_yo := public.mi_persona_en(new.campana_id);
  if v_yo is null then
    raise exception 'No perteneces al equipo de esta campaña' using errcode = '42501';
  end if;
  new := jsonb_populate_record(new, jsonb_build_object(col, v_yo));
  return new;
end;
$$;
do $$
declare r record;
begin
  for r in select * from (values ('notas_internas', 'autor_id', 'siempre'), ('alerta_actividad', 'persona_id', 'siempre'),
    ('menciones', 'revisada_por', 'si_hay'), ('reporte_envios', 'aprobado_por', 'si_hay')) v(tabla, col, modo)
  loop
    execute format('drop trigger if exists la_iguana_10_firma on public.%I', r.tabla);
    execute format('create trigger la_iguana_10_firma before insert or update on public.%I for each row execute function public.firmar_como_yo(%L, %L)', r.tabla, r.col, r.modo);
  end loop;
end $$;

-- Miembros: la persona es del equipo de la campaña, y una persona externa solo puede tener Solo lectura o Cliente.
create or replace function public.revisar_miembro() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.persona_de_la_campana(new.persona_id, new.campana_id) then
    raise exception 'La persona % no es del equipo de esta campaña', new.persona_id using errcode = '42501';
  end if;
  if new.rol in ('Administración', 'Análisis') and exists (select 1 from public.personas where id = new.persona_id and rol_org = 'externo') then
    raise exception 'Una persona externa al equipo solo puede tener Solo lectura o Cliente' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists la_iguana_10_miembro on public.miembros_campana;
create trigger la_iguana_10_miembro before insert or update on public.miembros_campana
  for each row execute function public.revisar_miembro();

-- Enlaces de menciones: solo http(s). La app además los filtra al mostrarlos (src/lib/url.ts).
alter table public.menciones drop constraint if exists menciones_url_http;
alter table public.menciones add constraint menciones_url_http check (url is null or url ~* '^https?://[^[:space:]]+$');

-- ---------- permisos de tabla ----------
revoke all on all tables in schema public from anon, public;
revoke all on all functions in schema public from anon, public;
revoke all on all sequences in schema public from anon, public;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
-- personas.user_id no sale a la app: lectura por columnas, sin user_id. Altas y cambios solo por funciones.
-- (La app pide columnas explícitas para personas: ver COLUMNAS en src/lib/db.ts.)
revoke select, insert, update, delete on public.personas from authenticated;
grant select (id, org_id, nombre, nombre_corto, iniciales, email, puesto, rol_org, activa, extra, creada_en) on public.personas to authenticated;

-- Lo que se cree después en public tampoco queda abierto a anon ni a public por defecto.
-- En Supabase las migraciones corren como postgres; en el banco de pruebas, como su propio usuario.
-- Ojo: "in schema" solo quita lo que se concedió por esquema (los grants a anon de Supabase). El execute a PUBLIC de las
-- funciones es un valor global de Postgres y solo se quita sin "in schema" (afecta las funciones que ese rol cree en cualquier esquema).
do $$
begin
  alter default privileges in schema public revoke all on tables from anon, public;
  alter default privileges in schema public revoke all on sequences from anon, public;
  alter default privileges in schema public revoke all on functions from anon, public;
  alter default privileges revoke execute on functions from public;
  if current_user <> 'postgres' and exists (select 1 from pg_roles where rolname = 'postgres') and pg_has_role(current_user, 'postgres', 'MEMBER') then
    begin
      alter default privileges for role postgres in schema public revoke all on tables from anon, public;
      alter default privileges for role postgres in schema public revoke all on sequences from anon, public;
      alter default privileges for role postgres in schema public revoke all on functions from anon, public;
      alter default privileges for role postgres revoke execute on functions from public;
    exception when others then
      raise notice 'Sin permiso para los privilegios por defecto de postgres: %', sqlerrm;
    end;
  end if;
end $$;

-- ---------- equipo ----------
alter table public.organizaciones enable row level security;
drop policy if exists org_lee on public.organizaciones;
create policy org_lee on public.organizaciones for select to authenticated using (id in (select public.mis_orgs()));

alter table public.personas enable row level security;
drop policy if exists personas_lee on public.personas;
create policy personas_lee on public.personas for select to authenticated
  using (user_id = (select auth.uid()) or org_id in (select public.orgs_equipo()));
-- altas y cambios de personas: solo por invitar_persona() y crear_campana().

alter table public.borradores enable row level security;
drop policy if exists borradores_propios on public.borradores;
create policy borradores_propios on public.borradores for all to authenticated
  using (persona_id in (select public.mis_personas()))
  with check (persona_id in (select public.mis_personas()) and org_id in (select public.orgs_equipo()));

-- ---------- campañas ----------
alter table public.campanas enable row level security;
drop policy if exists campanas_lee on public.campanas;
create policy campanas_lee on public.campanas for select to authenticated using (id in (select public.campanas_visibles()));
drop policy if exists campanas_cambia on public.campanas;
create policy campanas_cambia on public.campanas for update to authenticated
  using (id in (select public.campanas_administrables())) with check (id in (select public.campanas_administrables()));
-- altas: solo por crear_campana(). Sin borrado desde la app.

alter table public.miembros_campana enable row level security;
drop policy if exists miembros_lee on public.miembros_campana;
create policy miembros_lee on public.miembros_campana for select to authenticated using (campana_id in (select public.campanas_visibles()));
drop policy if exists miembros_alta on public.miembros_campana;
create policy miembros_alta on public.miembros_campana for insert to authenticated
  with check (campana_id in (select public.campanas_administrables()) and public.persona_de_la_campana(persona_id, campana_id));
drop policy if exists miembros_cambia on public.miembros_campana;
create policy miembros_cambia on public.miembros_campana for update to authenticated
  using (campana_id in (select public.campanas_administrables()))
  with check (campana_id in (select public.campanas_administrables()) and public.persona_de_la_campana(persona_id, campana_id));
drop policy if exists miembros_baja on public.miembros_campana;
create policy miembros_baja on public.miembros_campana for delete to authenticated using (campana_id in (select public.campanas_administrables()));

-- ---------- figuras (del equipo) ----------
alter table public.figuras enable row level security;
drop policy if exists figuras_lee on public.figuras;
create policy figuras_lee on public.figuras for select to authenticated using (
  org_id in (select public.orgs_equipo())
  or (org_id in (select public.orgs_visibles())
      and id in (select cf.figura_id from public.campana_figuras cf where cf.campana_id in (select public.campanas_visibles())))
);
-- Directorio de figuras: lo cambian quien administra el equipo y quien tiene Administración o Análisis en una campaña del equipo.
drop policy if exists figuras_alta on public.figuras;
create policy figuras_alta on public.figuras for insert to authenticated with check (org_id in (select public.orgs_editoras()));
drop policy if exists figuras_cambia on public.figuras;
create policy figuras_cambia on public.figuras for update to authenticated
  using (org_id in (select public.orgs_editoras())) with check (org_id in (select public.orgs_editoras()));

-- ---------- notas internas: el rol Cliente no las lee ----------
alter table public.notas_internas enable row level security;
drop policy if exists notas_lee on public.notas_internas;
create policy notas_lee on public.notas_internas for select to authenticated using (campana_id in (select public.campanas_internas()));
drop policy if exists notas_alta on public.notas_internas;
create policy notas_alta on public.notas_internas for insert to authenticated with check (campana_id in (select public.campanas_editables()));
drop policy if exists notas_cambia on public.notas_internas;
create policy notas_cambia on public.notas_internas for update to authenticated
  using (campana_id in (select public.campanas_editables())) with check (campana_id in (select public.campanas_editables()));
drop policy if exists notas_baja on public.notas_internas;
create policy notas_baja on public.notas_internas for delete to authenticated using (campana_id in (select public.campanas_editables()));

-- ---------- el resto de las tablas con campana_id: leen los miembros, escriben Administración y Análisis ----------
do $$
declare t text; accion text;
begin
  for t in
    select c.table_name from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'campana_id' and tb.table_type = 'BASE TABLE'
      and c.table_name not in ('miembros_campana', 'notas_internas')
  loop
    execute format('alter table public.%I enable row level security', t);
    foreach accion in array array['_lee','_alta','_cambia','_baja'] loop
      execute format('drop policy if exists %I on public.%I', t || accion, t);
    end loop;
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
