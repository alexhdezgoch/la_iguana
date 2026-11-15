-- Escrituras que tocan varias tablas o tablas sin escritura directa. Todas validan a quien llama.

-- Quién soy: persona, equipo y rol. La app lo pide al entrar.
create or replace function public.mi_contexto() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'persona', to_jsonb(p) - 'user_id',
    'org', to_jsonb(o)
  )
  from public.personas p join public.organizaciones o on o.id = p.org_id
  where p.user_id = auth.uid() and p.activa
  order by p.creada_en limit 1;
$$;

-- Correo con forma de correo: algo@dominio.tld, sin espacios ni separadores.
create or replace function public.email_valido(p text) returns boolean
language sql immutable set search_path = public as $$
  select coalesce(trim(p), '') ~* '^[^@[:space:]<>(),;:"]+@[^@[:space:]<>(),;:"]+\.[a-z]{2,}$';
$$;

-- Invita a una persona a una campaña. Si el correo ya existe en el equipo, la reutiliza.
-- En esta fase no se envía correo: la cuenta la crea quien administra La Iguana.
-- Solo quien administra el equipo (rol_org 'admin') da de alta personas internas ('miembro'); las altas de los demás
-- quedan como 'externo', y una persona externa solo puede tener Solo lectura o Cliente (900_acceso.sql lo impone).
create or replace function public.invitar_persona(p_campana text, p_nombre text, p_email text, p_rol text) returns text
language plpgsql security definer set search_path = public as $$
declare v_org text; v_persona text; v_email text := trim(coalesce(p_email, '')); v_rol_org text;
begin
  if p_campana is null or p_campana not in (select public.campanas_administrables()) then
    raise exception 'Solo quien administra la campaña puede invitar' using errcode = '42501';
  end if;
  if p_rol is null or p_rol not in ('Administración','Análisis','Solo lectura','Cliente') then
    raise exception 'Rol no válido: %', p_rol using errcode = '22023';
  end if;
  if v_email = '' then
    raise exception 'Falta el correo' using errcode = '22023';
  end if;
  if not public.email_valido(v_email) then
    raise exception 'Correo no válido: %', v_email using errcode = '22023';
  end if;
  select org_id into v_org from public.campanas where id = p_campana;
  select id into v_persona from public.personas where org_id = v_org and lower(email) = lower(v_email);
  if v_persona is null then
    v_rol_org := case when p_rol <> 'Cliente' and v_org in (select public.orgs_admin()) then 'miembro' else 'externo' end;
    if v_rol_org = 'externo' and p_rol in ('Administración','Análisis') then
      raise exception 'Solo quien administra el equipo puede dar % a una persona nueva', p_rol using errcode = '42501';
    end if;
    insert into public.personas (org_id, nombre, email, rol_org)
    values (v_org, coalesce(nullif(trim(p_nombre), ''), v_email), v_email, v_rol_org)
    returning id into v_persona;
  end if;
  insert into public.miembros_campana (campana_id, persona_id, rol) values (p_campana, v_persona, p_rol)
  on conflict (campana_id, persona_id) do update set rol = excluded.rol;
  return v_persona;
end;
$$;

-- Crea una campaña completa en una sola transacción y deja a quien la crea como Administración.
-- p = {
--   org_id,
--   campana:  { nombre, nombre_corto?, contienda, titulo_largo, iniciales, ambito, pais, territorio, fase, inicio_campana, fin_campana, veda_inicio, veda_fin, jornada,
--               zona_horaria? (por defecto America/Caracas), extra },
--   fases:    [ { nombre, inicio, fin } ],
--   figuras:  [ { figura_id } | { nueva: { nombre, nombre_corto?, iniciales, cargo, partido, coalicion, territorio, tipo, cuentas, trayectoria } }, cada una con relacion y terminos: [ { texto, tipo } ] ],
--   terminos: [ { texto, tipo } ],                      -- de la campaña (incluye exclusiones)
--   equipo:   [ { persona_id, rol } | { nombre, email, rol } ]
-- }
-- Devuelve el id de la campaña.
create or replace function public.crear_campana(p jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_org text := p->>'org_id';
  v_yo text;
  v_yo_admin boolean;
  v_rol text; v_email text; v_rol_org text;
  c jsonb := coalesce(p->'campana', '{}'::jsonb);
  v_id text;
  f jsonb; t jsonb; e jsonb;
  v_fig text; v_persona text; v_propia text; n int := 0;
begin
  select id, rol_org = 'admin' into v_yo, v_yo_admin from public.personas where org_id = v_org and user_id = auth.uid() and activa and rol_org in ('admin','miembro');
  if v_yo is null then
    raise exception 'No perteneces a este equipo' using errcode = '42501';
  end if;
  if coalesce(trim(c->>'nombre'), '') = '' then
    raise exception 'Falta el nombre de la campaña' using errcode = '22023';
  end if;

  insert into public.campanas (org_id, nombre, nombre_corto, contienda, titulo_largo, iniciales, ambito, pais, territorio, fase,
    inicio_campana, fin_campana, veda_inicio, veda_fin, jornada, zona_horaria, extra, creada_por, orden)
  values (v_org, trim(c->>'nombre'), nullif(trim(c->>'nombre_corto'), ''), c->>'contienda', coalesce(c->>'titulo_largo', c->>'contienda'), c->>'iniciales', c->>'ambito', c->>'pais', c->>'territorio',
    coalesce(nullif(c->>'fase', ''), 'Precampaña'),
    nullif(c->>'inicio_campana', '')::date, nullif(c->>'fin_campana', '')::date, nullif(c->>'veda_inicio', '')::date,
    nullif(c->>'veda_fin', '')::date, nullif(c->>'jornada', '')::date,
    coalesce(nullif(trim(c->>'zona_horaria'), ''), nullif(trim(c->'extra'->>'zona_horaria'), ''), 'America/Caracas'),
    coalesce(c->'extra', '{}'::jsonb) - 'zona_horaria', v_yo,
    (select coalesce(max(orden), 0) + 1 from public.campanas where org_id = v_org))
  returning id into v_id;

  insert into public.miembros_campana (campana_id, persona_id, rol) values (v_id, v_yo, 'Administración');

  for f in select * from jsonb_array_elements(coalesce(p->'fases', '[]'::jsonb)) loop
    n := n + 1;
    insert into public.campana_fases (campana_id, nombre, inicio, fin, orden)
    values (v_id, f->>'nombre', nullif(f->>'inicio', '')::date, nullif(f->>'fin', '')::date, n);
  end loop;

  n := 0;
  for f in select * from jsonb_array_elements(coalesce(p->'figuras', '[]'::jsonb)) loop
    n := n + 1;
    v_fig := f->>'figura_id';
    if v_fig is not null then
      if not exists (select 1 from public.figuras where id = v_fig and org_id = v_org) then
        raise exception 'La figura % no es de este equipo', v_fig using errcode = '22023';
      end if;
    else
      insert into public.figuras (org_id, nombre, nombre_corto, iniciales, cargo, partido, coalicion, territorio, tipo, cuentas, trayectoria)
      values (v_org, f->'nueva'->>'nombre', nullif(trim(f->'nueva'->>'nombre_corto'), ''), f->'nueva'->>'iniciales', f->'nueva'->>'cargo', f->'nueva'->>'partido', f->'nueva'->>'coalicion',
        f->'nueva'->>'territorio', f->'nueva'->>'tipo', coalesce(f->'nueva'->'cuentas', '[]'::jsonb), f->'nueva'->>'trayectoria')
      returning id into v_fig;
    end if;
    insert into public.campana_figuras (campana_id, figura_id, relacion, orden)
    values (v_id, v_fig, coalesce(nullif(f->>'relacion', ''), 'A observar'), n)
    on conflict (campana_id, figura_id) do update set relacion = excluded.relacion;
    if f->>'relacion' = 'Propia' and v_propia is null then v_propia := v_fig; end if;
    for t in select * from jsonb_array_elements(coalesce(f->'terminos', '[]'::jsonb)) loop
      insert into public.terminos (campana_id, figura_id, texto, tipo) values (v_id, v_fig, t->>'texto', coalesce(nullif(t->>'tipo', ''), 'Término'));
    end loop;
  end loop;
  if v_propia is not null then
    update public.campanas set figura_propia_id = v_propia where id = v_id;
  end if;

  for t in select * from jsonb_array_elements(coalesce(p->'terminos', '[]'::jsonb)) loop
    insert into public.terminos (campana_id, texto, tipo) values (v_id, t->>'texto', coalesce(nullif(t->>'tipo', ''), 'Término'));
  end loop;

  for e in select * from jsonb_array_elements(coalesce(p->'equipo', '[]'::jsonb)) loop
    v_rol := coalesce(nullif(e->>'rol', ''), 'Análisis');
    if v_rol not in ('Administración','Análisis','Solo lectura','Cliente') then
      raise exception 'Rol no válido: %', v_rol using errcode = '22023';
    end if;
    v_persona := e->>'persona_id';
    if v_persona is null then
      v_email := trim(coalesce(e->>'email', ''));
      if not public.email_valido(v_email) then
        raise exception 'Correo no válido: %', coalesce(nullif(v_email, ''), '(vacío)') using errcode = '22023';
      end if;
      select id into v_persona from public.personas where org_id = v_org and lower(email) = lower(v_email);
      if v_persona is null then
        -- Igual que invitar_persona(): solo quien administra el equipo da de alta personas internas.
        v_rol_org := case when v_rol <> 'Cliente' and v_yo_admin then 'miembro' else 'externo' end;
        if v_rol_org = 'externo' and v_rol in ('Administración','Análisis') then
          raise exception 'Solo quien administra el equipo puede dar % a una persona nueva (%)', v_rol, v_email using errcode = '42501';
        end if;
        insert into public.personas (org_id, nombre, email, rol_org)
        values (v_org, coalesce(nullif(trim(e->>'nombre'), ''), v_email), v_email, v_rol_org)
        returning id into v_persona;
      end if;
    elsif not exists (select 1 from public.personas where id = v_persona and org_id = v_org) then
      raise exception 'La persona % no es de este equipo', v_persona using errcode = '22023';
    end if;
    if v_persona <> v_yo then
      insert into public.miembros_campana (campana_id, persona_id, rol) values (v_id, v_persona, v_rol)
      on conflict (campana_id, persona_id) do update set rol = excluded.rol;
    end if;
  end loop;

  return v_id;
end;
$$;

-- Agrega una figura a una campaña en una sola transacción: la crea en el directorio del equipo (p.nueva) o vincula
-- una existente del mismo equipo (p.figura_id); guarda sus términos y la nota interna, y si la campaña no tiene
-- figura propia y quien llama la administra, la fija. Requiere Administración o Análisis en la campaña.
-- p = { campana_id, relacion, responsable_equipo?, figura_id? | nueva: { nombre, nombre_corto?, iniciales?, cargo?, partido?,
--       coalicion?, territorio?, tipo?, cuentas? }, persona_publica: true (obligatorio con nueva), terminos?: [{ texto, tipo }], notas? }
-- Devuelve el id de la figura.
create or replace function public.agregar_figura(p jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_camp text := p->>'campana_id';
  v_org text; v_yo text; v_fig text; v_nombre text; v_rel text := p->>'relacion';
  n jsonb := p->'nueva'; t jsonb; i int := 0; v_orden int;
  v_terminos jsonb := coalesce(p->'terminos', '[]'::jsonb);
begin
  if v_camp is null or v_camp not in (select public.campanas_editables()) then
    raise exception 'Tu rol en esta campaña no permite agregar figuras' using errcode = '42501';
  end if;
  if v_rel is null or v_rel not in ('Propia','Aliada','Rival','A observar') then
    raise exception 'Relación no válida: %', v_rel using errcode = '22023';
  end if;
  if jsonb_typeof(v_terminos) <> 'array' or jsonb_array_length(v_terminos) > 30 then
    raise exception 'Hasta 30 términos por figura' using errcode = '22023';
  end if;
  select org_id into v_org from public.campanas where id = v_camp;
  select id into v_yo from public.personas where org_id = v_org and user_id = auth.uid() and activa;

  if p ? 'figura_id' and p->>'figura_id' is not null then
    select id, nombre into v_fig, v_nombre from public.figuras where id = p->>'figura_id' and org_id = v_org;
    if v_fig is null then
      raise exception 'La figura % no es de este equipo', p->>'figura_id' using errcode = '22023';
    end if;
    if exists (select 1 from public.campana_figuras where campana_id = v_camp and figura_id = v_fig) then
      raise exception '% ya está en esta campaña', v_nombre using errcode = '23505';
    end if;
    v_terminos := jsonb_build_array(jsonb_build_object('texto', v_nombre, 'tipo', 'Nombre'));
  else
    v_nombre := trim(coalesce(n->>'nombre', ''));
    if v_nombre = '' then
      raise exception 'Falta el nombre de la figura' using errcode = '22023';
    end if;
    if coalesce((p->>'persona_publica')::boolean, false) is not true then
      raise exception 'Falta confirmar que es una persona pública en un rol público' using errcode = '22023';
    end if;
    insert into public.figuras (org_id, nombre, nombre_corto, iniciales, cargo, partido, coalicion, territorio, tipo, cuentas, extra)
    values (v_org, v_nombre, nullif(trim(n->>'nombre_corto'), ''), nullif(trim(n->>'iniciales'), ''), nullif(trim(n->>'cargo'), ''),
      nullif(trim(n->>'partido'), ''), nullif(trim(n->>'coalicion'), ''), nullif(trim(n->>'territorio'), ''), nullif(trim(n->>'tipo'), ''),
      case when jsonb_typeof(n->'cuentas') = 'array' then n->'cuentas' else '[]'::jsonb end,
      jsonb_build_object('persona_publica', jsonb_build_object('confirmada_por', v_yo, 'en', now())))
    returning id into v_fig;
    if jsonb_array_length(v_terminos) = 0 then
      v_terminos := jsonb_build_array(jsonb_build_object('texto', v_nombre, 'tipo', 'Nombre'));
    end if;
  end if;

  select coalesce(max(orden), 0) + 1 into v_orden from public.campana_figuras where campana_id = v_camp;
  insert into public.campana_figuras (campana_id, figura_id, relacion, orden, extra)
  values (v_camp, v_fig, v_rel, v_orden,
    case when nullif(trim(p->>'responsable_equipo'), '') is null then '{}'::jsonb else jsonb_build_object('responsable_equipo', trim(p->>'responsable_equipo')) end);

  for t in select * from jsonb_array_elements(v_terminos) loop
    if nullif(trim(t->>'texto'), '') is null then continue; end if;
    i := i + 1;
    insert into public.terminos (campana_id, figura_id, texto, tipo, orden)
    values (v_camp, v_fig, trim(t->>'texto'), coalesce(nullif(trim(t->>'tipo'), ''), 'Término'), i);
  end loop;

  if nullif(trim(p->>'notas'), '') is not null then
    insert into public.notas_internas (campana_id, entidad, entidad_id, texto, autor_id)
    values (v_camp, 'figura', v_fig, trim(p->>'notas'), v_yo);
  end if;

  if v_rel = 'Propia' and v_camp in (select public.campanas_administrables()) then
    update public.campanas set figura_propia_id = v_fig where id = v_camp and figura_propia_id is null;
  end if;
  return v_fig;
end;
$$;

-- Cambia una alerta y deja su fila en alerta_actividad, en una sola transacción. Requiere Administración o Análisis.
-- p_cambios solo admite estado, responsable_id, pospuesta_hasta, resuelta_en y motivo_cierre ({} = solo anotar).
-- p_nota (opcional) guarda además una nota interna de la alerta. p_en: momento de la actividad (por defecto, ahora).
-- Devuelve el id de la fila de actividad.
create or replace function public.cambiar_alerta(p_alerta text, p_cambios jsonb default '{}'::jsonb, p_texto text default null,
  p_nota text default null, p_en timestamptz default null) returns text
language plpgsql security definer set search_path = public as $$
declare
  a public.alertas; v_org text; v_yo text; v_id text; k text;
  v_cambios jsonb := coalesce(p_cambios, '{}'::jsonb);
  v_en timestamptz := coalesce(p_en, now());
begin
  select * into a from public.alertas where id = p_alerta;
  if a.id is null or a.campana_id not in (select public.campanas_editables()) then
    raise exception 'Tu rol en esta campaña no permite cambiar esta alerta' using errcode = '42501';
  end if;
  if jsonb_typeof(v_cambios) <> 'object' then
    raise exception 'Cambios no válidos' using errcode = '22023';
  end if;
  for k in select jsonb_object_keys(v_cambios) loop
    if k not in ('estado','responsable_id','pospuesta_hasta','resuelta_en','motivo_cierre') then
      raise exception 'No se puede cambiar % desde aquí', k using errcode = '22023';
    end if;
  end loop;
  if nullif(trim(p_texto), '') is null then
    raise exception 'Falta el texto de la actividad' using errcode = '22023';
  end if;
  select org_id into v_org from public.campanas where id = a.campana_id;
  select id into v_yo from public.personas where org_id = v_org and user_id = auth.uid() and activa;

  if v_cambios <> '{}'::jsonb then
    update public.alertas x set
      estado = case when v_cambios ? 'estado' then v_cambios->>'estado' else x.estado end,
      responsable_id = case when v_cambios ? 'responsable_id' then v_cambios->>'responsable_id' else x.responsable_id end,
      pospuesta_hasta = case when v_cambios ? 'pospuesta_hasta' then (v_cambios->>'pospuesta_hasta')::timestamptz else x.pospuesta_hasta end,
      resuelta_en = case when v_cambios ? 'resuelta_en' then (v_cambios->>'resuelta_en')::timestamptz else x.resuelta_en end,
      motivo_cierre = case when v_cambios ? 'motivo_cierre' then v_cambios->>'motivo_cierre' else x.motivo_cierre end
    where x.id = a.id;
  end if;
  if nullif(trim(p_nota), '') is not null then
    insert into public.notas_internas (campana_id, entidad, entidad_id, texto, autor_id, creada_en, actualizada_en)
    values (a.campana_id, 'alerta', a.id, trim(p_nota), v_yo, v_en, v_en);
  end if;
  insert into public.alerta_actividad (campana_id, alerta_id, persona_id, texto, creada_en)
  values (a.campana_id, a.id, v_yo, left(trim(p_texto), 500), v_en)
  returning id into v_id;
  return v_id;
end;
$$;

-- Suma un uso a una plantilla de reporte sin leer y reescribir el contador. Requiere Administración o Análisis.
create or replace function public.usar_plantilla(p_plantilla text) returns integer
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  update public.reporte_plantillas set usos = usos + 1
  where id = p_plantilla and campana_id in (select public.campanas_editables())
  returning usos into v;
  if v is null then
    raise exception 'Tu rol en esta campaña no permite usar esta plantilla' using errcode = '42501';
  end if;
  return v;
end;
$$;
