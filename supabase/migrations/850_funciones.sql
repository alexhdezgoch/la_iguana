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

-- Invita a una persona a una campaña. Si el correo ya existe en el equipo, la reutiliza.
-- En esta fase no se envía correo: la cuenta la crea quien administra La Iguana.
create or replace function public.invitar_persona(p_campana text, p_nombre text, p_email text, p_rol text) returns text
language plpgsql security definer set search_path = public as $$
declare v_org text; v_persona text;
begin
  if p_campana not in (select public.campanas_administrables()) then
    raise exception 'Solo quien administra la campaña puede invitar' using errcode = '42501';
  end if;
  if p_rol not in ('Administración','Análisis','Solo lectura','Cliente') then
    raise exception 'Rol no válido: %', p_rol using errcode = '22023';
  end if;
  if coalesce(trim(p_email), '') = '' then
    raise exception 'Falta el correo' using errcode = '22023';
  end if;
  select org_id into v_org from public.campanas where id = p_campana;
  select id into v_persona from public.personas where org_id = v_org and lower(email) = lower(trim(p_email));
  if v_persona is null then
    insert into public.personas (org_id, nombre, email, rol_org)
    values (v_org, coalesce(nullif(trim(p_nombre), ''), trim(p_email)), trim(p_email), case when p_rol = 'Cliente' then 'externo' else 'miembro' end)
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
  c jsonb := coalesce(p->'campana', '{}'::jsonb);
  v_id text;
  f jsonb; t jsonb; e jsonb;
  v_fig text; v_persona text; v_propia text; n int := 0;
begin
  select id into v_yo from public.personas where org_id = v_org and user_id = auth.uid() and activa and rol_org in ('admin','miembro');
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
    v_persona := e->>'persona_id';
    if v_persona is null then
      select id into v_persona from public.personas where org_id = v_org and lower(email) = lower(trim(e->>'email'));
      if v_persona is null then
        insert into public.personas (org_id, nombre, email, rol_org)
        values (v_org, coalesce(nullif(trim(e->>'nombre'), ''), trim(e->>'email')), trim(e->>'email'), case when e->>'rol' = 'Cliente' then 'externo' else 'miembro' end)
        returning id into v_persona;
      end if;
    elsif not exists (select 1 from public.personas where id = v_persona and org_id = v_org) then
      raise exception 'La persona % no es de este equipo', v_persona using errcode = '22023';
    end if;
    if v_persona <> v_yo then
      insert into public.miembros_campana (campana_id, persona_id, rol) values (v_id, v_persona, coalesce(nullif(e->>'rol', ''), 'Análisis'))
      on conflict (campana_id, persona_id) do update set rol = excluded.rol;
    end if;
  end loop;

  return v_id;
end;
$$;
