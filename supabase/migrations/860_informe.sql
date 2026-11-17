set client_min_messages = warning;
-- Informe: public.informe_datos(p_reporte_id) arma en un solo JSON todo lo que el Informe muestra.
-- Contrato (forma exacta y significado de cada clave): src/lib/informe/tipos.ts. Si cambias algo aquí, cámbialo allá.
--
-- Acceso: security definer con revisión explícita. Devuelve null si el reporte no existe o si su campaña no está en
-- campanas_visibles() (ajeno, anónimo). Cliente y Solo lectura lo reciben aunque no lean autores, comentarios,
-- codificaciones ni recolecciones: salen solo agregados, y la regla de publicación de cuentas se aplica aquí:
--   el usuario de una cuenta se muestra solo si seguidores >= 100.000 o es una organización; si no, "Cuenta personal",
--   sin usuario, sin enlace de la cuenta ni de la publicación. Los textos de comentarios nunca salen.
-- Toda consulta filtra por la campaña del reporte. Días y horas en campanas.zona_horaria (o config.zona).
-- Configuración: reportes.extra.informe (ver InformeConfig en tipos.ts).
-- Solo lee: sirve en transacciones de solo lectura (sin tablas temporales); las filas del periodo se guardan una vez
-- en un arreglo de public.informe_fila y cada bloque las vuelve a leer con unnest().

drop function if exists public.informe_datos(text);
drop type if exists public.informe_fila;
create type public.informe_fila as (
  id text, canal text, publicada_en timestamptz, dia date, hora integer, autor_id text, fuente text,
  vistas bigint, me_gusta bigint, respuestas bigint, compartidos bigint, interaccion bigint,
  otro_pais boolean, en_tema boolean,
  conv boolean,           -- en el tema, no de otro país, con el eje de conversación (cualquier método)
  foco boolean,           -- ídem con el eje foco
  comp boolean,           -- ídem con el eje de comparación
  ambito boolean,         -- en el ámbito de los rankings (cualquier método)
  firme boolean,          -- en el ámbito por Regla o Manual: entra en rankings
  ejes text[]             -- ejes de config.ejes que tiene (vacío si es de otro país o no trata el tema)
);

-- ---------- ayudas puras (sin acceso a datos: reciben la fila ya leída) ----------
create or replace function public.informe_interaccion(m public.menciones) returns bigint
language sql immutable set search_path = public as $$
  select coalesce(m.interacciones,
    case when m.me_gusta is not null or m.respuestas is not null or m.compartidos is not null
      then coalesce(m.me_gusta, 0) + coalesce(m.respuestas, 0) + coalesce(m.compartidos, 0) end);
$$;

-- Regla de publicación. Sin autor: solo las noticias muestran su fuente (el medio); lo demás queda como cuenta personal.
create or replace function public.informe_visible(a public.autores, p_canal text) returns boolean
language sql immutable set search_path = public as $$
  select case when a.id is null then p_canal = 'Medio digital'
    else coalesce(a.es_organizacion, false) or coalesce(a.seguidores, 0) >= 100000 end;
$$;

create or replace function public.informe_cuenta(a public.autores, p_fuente text, p_canal text) returns jsonb
language sql immutable set search_path = public as $$
  select case
    when not public.informe_visible(a, p_canal) then jsonb_build_object('autor_id', null, 'visible', false, 'etiqueta', 'Cuenta personal',
      'handle', null, 'nombre', null, 'tipo', null, 'descriptor', null, 'seguidores', null, 'es_organizacion', false, 'figura', false, 'url', null)
    when a.id is null then jsonb_build_object('autor_id', null, 'visible', true, 'etiqueta', coalesce(p_fuente, 'Medio sin nombre'),
      'handle', null, 'nombre', p_fuente, 'tipo', 'Medio', 'descriptor', null, 'seguidores', null, 'es_organizacion', true, 'figura', false, 'url', null)
    else jsonb_build_object('autor_id', a.id, 'visible', true, 'etiqueta', coalesce(a.handle, a.nombre, 'Cuenta sin nombre'),
      'handle', a.handle, 'nombre', a.nombre, 'tipo', a.tipo, 'descriptor', a.descriptor, 'seguidores', a.seguidores,
      'es_organizacion', a.es_organizacion, 'figura', a.figura_id is not null, 'url', a.url)
  end;
$$;

create or replace function public.informe_pub(m public.menciones, a public.autores) returns jsonb
language sql immutable set search_path = public as $$
  select jsonb_build_object(
    'mencion_id', m.id, 'canal', m.canal, 'publicada_en', m.publicada_en, 'fuente', m.fuente,
    'titulo', m.titulo, 'texto', left(coalesce(m.texto, m.resumen), 280),
    'url', case when public.informe_visible(a, m.canal) then m.url end,
    'formato', m.formato, 'tipo_pub', m.tipo_pub,
    'vistas', m.vistas, 'me_gusta', m.me_gusta, 'respuestas', m.respuestas, 'compartidos', m.compartidos,
    'interaccion', public.informe_interaccion(m),
    'cuenta', public.informe_cuenta(a, m.fuente, m.canal));
$$;

create or replace function public.informe_pct(p_parte numeric, p_todo numeric) returns numeric
language sql immutable set search_path = public as $$
  select case when p_todo is null or p_todo = 0 then null else round(100.0 * coalesce(p_parte, 0) / p_todo, 1) end;
$$;

-- Filas [{canal, dko, <métrica>: n, …}] → {<métrica>: {por_canal: {canal: [n por dko]}, total: [n por dko]}}.
create or replace function public.informe_pivote(p jsonb) returns jsonb
language sql immutable set search_path = public as $$
  with u as (
    select x->>'canal' as canal, (x->>'dko')::int as dko, e.key as metrica, e.value::numeric as v
    from jsonb_array_elements(coalesce(p, '[]'::jsonb)) x
    cross join lateral jsonb_each_text(x - 'canal' - 'ko' - 'dko') e),
  pc as (
    select metrica, jsonb_object_agg(canal, arr) as por_canal
    from (select metrica, canal, jsonb_agg(v order by dko) as arr from u group by metrica, canal) a group by metrica),
  tt as (
    select metrica, jsonb_agg(s order by dko) as total
    from (select metrica, dko, sum(v) as s from u group by metrica, dko) a group by metrica)
  select coalesce(jsonb_object_agg(pc.metrica, jsonb_build_object('por_canal', pc.por_canal, 'total', tt.total)), '{}'::jsonb)
  from pc join tt using (metrica);
$$;

-- ---------- la función ----------
create or replace function public.informe_datos(p_reporte_id text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r public.reportes%rowtype;
  c public.campanas%rowtype;
  cfg jsonb;
  v_zona text;
  v_ini timestamptz; v_fin timestamptz;
  v_modo text;
  v_dias date[];
  v_base date; v_evento date;
  v_vent_ini timestamptz; v_vent_fin timestamptz;
  v_conv text; v_foco text; v_comp text;
  v_ejes text[]; v_amb text; v_amb_ejes text[];
  v_canales text[]; v_canales_cfg text[]; v_canales_com text[];
  v_muestras text[]; v_propias text[];
  v_filas public.informe_fila[];
  n_pub int; n_cta int; n_tit int; n_med int; n_com int;
  m_pub text; m_cta text; m_dest text;
  v_orden constant text[] := array['Medio digital','X','Instagram','TikTok','YouTube','Facebook','Radio','Televisión'];
  v_cero jsonb; v_cero_h jsonb;
  j_dias jsonb; j_series jsonb; j_com jsonb; j_hora jsonb; j_prom jsonb; j_pico jsonb; j_pico_foco jsonb;
  j_desglose jsonb := '{}'::jsonb; j_ejes jsonb; j_ejes_canal jsonb; j_ejes_def jsonb;
  j_rank_pub jsonb; j_rank_cta jsonb; j_titulares jsonb; j_por_fuente jsonb; j_med_cuentas jsonb; n_titulares int;
  j_coment jsonb; j_muestras jsonb := '[]'::jsonb; j_codigos jsonb; j_recol jsonb; j_dest jsonb; n_dest_omit int;
  j_propias jsonb; j_cuentas jsonb;
  v_flag text; mu public.muestras%rowtype; j_m jsonb; v_pond boolean; v_n int;
  t_ini text; t_fin text;
begin
  select * into r from public.reportes where id = p_reporte_id;
  if r.id is null or r.campana_id not in (select public.campanas_visibles()) then
    return null;
  end if;
  select * into c from public.campanas where id = r.campana_id;
  cfg := coalesce(r.extra->'informe', '{}'::jsonb);
  if jsonb_typeof(cfg) <> 'object' then cfg := '{}'::jsonb; end if;

  v_zona := coalesce(nullif(trim(cfg->>'zona'), ''), c.zona_horaria, 'America/Caracas');
  if not exists (select 1 from pg_timezone_names where name = v_zona) then v_zona := coalesce(c.zona_horaria, 'America/Caracas'); end if;
  v_modo := case when cfg->>'modo' = 'tema' then 'tema' else 'evento' end;

  -- Periodo [inicio, fin). Una fecha sola (AAAA-MM-DD) se lee en la zona: inicio a las 00:00, fin al terminar ese día.
  t_ini := nullif(trim(cfg->>'periodo_inicio'), ''); t_fin := nullif(trim(cfg->>'periodo_fin'), '');
  v_ini := case when t_ini ~ '^\d{4}-\d{2}-\d{2}$' then t_ini::date::timestamp at time zone v_zona else t_ini::timestamptz end;
  v_fin := case when t_fin ~ '^\d{4}-\d{2}-\d{2}$' then (t_fin::date + 1)::timestamp at time zone v_zona else t_fin::timestamptz end;
  v_ini := coalesce(v_ini, c.periodo_inicio::timestamp at time zone v_zona, date_trunc('day', now() at time zone v_zona - interval '6 days') at time zone v_zona);
  v_fin := coalesce(v_fin, (c.periodo_fin + 1)::timestamp at time zone v_zona, v_ini + interval '7 days');
  if v_fin <= v_ini then v_fin := v_ini + interval '1 day'; end if;
  if v_fin > v_ini + interval '93 days' then v_fin := v_ini + interval '93 days'; end if;
  v_dias := array(select g::date from generate_series((v_ini at time zone v_zona)::date, ((v_fin - interval '1 microsecond') at time zone v_zona)::date, interval '1 day') g);

  -- Día base y día del evento (modo evento).
  v_vent_ini := nullif(cfg->'ventana_evento'->>'inicio', '')::timestamptz;
  v_vent_fin := nullif(cfg->'ventana_evento'->>'fin', '')::timestamptz;
  if v_modo = 'evento' then
    v_base := nullif(cfg->>'dia_base', '')::date;
    v_evento := coalesce(nullif(cfg->>'dia_evento', '')::date, (v_vent_ini at time zone v_zona)::date,
      (select e.fecha_inicio from public.eventos e where e.id = coalesce(cfg->>'evento_id', r.evento_id) and e.campana_id = r.campana_id),
      v_base + 1, v_dias[1]);
  end if;

  -- Ejes: solo de esta campaña.
  select e.id into v_conv from public.ejes e where e.id = cfg->>'eje_conversacion' and e.campana_id = r.campana_id;
  select e.id into v_foco from public.ejes e where e.id = cfg->>'eje_foco' and e.campana_id = r.campana_id;
  select e.id into v_comp from public.ejes e where e.id = cfg->'comparacion'->>'eje_id' and e.campana_id = r.campana_id;
  v_conv := coalesce(v_conv, v_foco);
  v_ejes := array(select e.id from jsonb_array_elements_text(case when jsonb_typeof(cfg->'ejes') = 'array' then cfg->'ejes' else '[]'::jsonb end) with ordinality u(id, o)
    join public.ejes e on e.id = u.id and e.campana_id = r.campana_id order by u.o);
  if cardinality(v_ejes) = 0 and v_modo = 'tema' then
    v_ejes := array(select e.id from public.ejes e where e.campana_id = r.campana_id order by e.orden, e.nombre);
  end if;
  v_amb := coalesce(nullif(cfg->>'ambito_rankings', ''), case v_modo when 'tema' then 'ejes' else 'foco' end);
  if v_amb not in ('foco', 'conversacion', 'ejes') then v_amb := case v_modo when 'tema' then 'ejes' else 'foco' end; end if;
  v_amb_ejes := case v_amb when 'foco' then array_remove(array[v_foco], null) when 'conversacion' then array_remove(array[v_conv], null) else v_ejes end;

  if jsonb_typeof(cfg->'canales') = 'array' and jsonb_array_length(cfg->'canales') > 0 then
    v_canales_cfg := array(select jsonb_array_elements_text(cfg->'canales'));
  end if;
  v_muestras := array(select mu2.id from jsonb_array_elements_text(case when jsonb_typeof(cfg->'muestras') = 'array' then cfg->'muestras' else '[]'::jsonb end) with ordinality u(id, o)
    join public.muestras mu2 on mu2.id = u.id and mu2.campana_id = r.campana_id order by u.o);
  if cardinality(v_muestras) = 0 then
    v_muestras := array(select mu2.id from public.muestras mu2 where mu2.campana_id = r.campana_id order by mu2.orden, mu2.creada_en, mu2.id);
  end if;
  v_propias := array(select a.id from jsonb_array_elements_text(case when jsonb_typeof(cfg->'cuentas_propias') = 'array' then cfg->'cuentas_propias' else '[]'::jsonb end) with ordinality u(id, o)
    join public.autores a on a.id = u.id and a.campana_id = r.campana_id order by u.o);

  n_pub := least(greatest(coalesce(nullif(cfg->'limites'->>'publicaciones', '')::int, 5), 1), 50);
  n_cta := least(greatest(coalesce(nullif(cfg->'limites'->>'cuentas', '')::int, 10), 1), 50);
  n_tit := least(greatest(coalesce(nullif(cfg->'limites'->>'titulares', '')::int, 100), 1), 500);
  n_med := least(greatest(coalesce(nullif(cfg->'limites'->>'medios', '')::int, 10), 1), 50);
  n_com := least(greatest(coalesce(nullif(cfg->'limites'->>'comentarios', '')::int, 3), 1), 20);
  m_pub := case when cfg->'enmascarar'->>'top_publicaciones' = 'omitir' then 'omitir' else 'agrupar' end;
  m_cta := case when cfg->'enmascarar'->>'top_cuentas' = 'omitir' then 'omitir' else 'agrupar' end;
  m_dest := case when cfg->'enmascarar'->>'destacadas' = 'omitir' then 'omitir' else 'agrupar' end;

  -- ---------- filas del periodo, una vez ----------
  select coalesce(array_agg(row(
      m.id, m.canal, m.publicada_en, (m.publicada_en at time zone v_zona)::date, extract(hour from m.publicada_en at time zone v_zona)::int,
      m.autor_id, m.fuente, m.vistas, m.me_gusta, m.respuestas, m.compartidos, public.informe_interaccion(m),
      m.otro_pais, m.en_tema,
      coalesce(en and v_conv = any (x.todos), false), coalesce(en and v_foco = any (x.todos), false), coalesce(en and v_comp = any (x.todos), false),
      coalesce(en and x.todos && v_amb_ejes, false), coalesce(en and x.firmes && v_amb_ejes, false),
      case when en then array(select unnest(x.todos) intersect select unnest(v_ejes)) else '{}'::text[] end
    )::public.informe_fila order by m.publicada_en, m.id), '{}')
  into v_filas
  from public.menciones m
  cross join lateral (select m.en_tema and not m.otro_pais as en) b
  cross join lateral (
    select coalesce(array_agg(me.eje_id), '{}') as todos,
           coalesce(array_agg(me.eje_id) filter (where me.metodo in ('Regla', 'Manual')), '{}') as firmes
    from public.mencion_ejes me where me.mencion_id = m.id and me.campana_id = r.campana_id) x
  where m.campana_id = r.campana_id and m.publicada_en >= v_ini and m.publicada_en < v_fin and m.estado <> 'Descartada'
    and (v_canales_cfg is null or m.canal = any (v_canales_cfg));

  v_canales := coalesce(v_canales_cfg, array(
    select f.canal from unnest(v_filas) f group by f.canal
    order by coalesce(array_position(v_orden, f.canal), 99), f.canal));
  v_canales_com := array(
    select x.canal from public.comentarios x
    where x.campana_id = r.campana_id and x.publicada_en >= v_ini and x.publicada_en < v_fin and (v_canales_cfg is null or x.canal = any (v_canales_cfg))
    group by x.canal order by coalesce(array_position(v_orden, x.canal), 99), x.canal);
  v_cero := jsonb_build_object('por_canal', '{}'::jsonb, 'total', to_jsonb(array_fill(0, array[cardinality(v_dias)])));
  v_cero_h := jsonb_build_object('por_canal', '{}'::jsonb, 'total', to_jsonb(array_fill(0, array[24])));

  select jsonb_agg(jsonb_build_object('fecha', d.dia,
      'es_base', d.dia is not distinct from v_base, 'es_evento', d.dia is not distinct from v_evento,
      'desde', case when d.o = 1 and (v_ini at time zone v_zona)::time <> '00:00' then to_char(v_ini at time zone v_zona, 'HH24:MI') end,
      'hasta', case when d.o = cardinality(v_dias) and (v_fin at time zone v_zona)::time <> '00:00' then to_char(v_fin at time zone v_zona, 'HH24:MI') end,
      'parcial', (d.o = 1 and (v_ini at time zone v_zona)::time <> '00:00') or (d.o = cardinality(v_dias) and (v_fin at time zone v_zona)::time <> '00:00'))
    order by d.o)
  into j_dias from unnest(v_dias) with ordinality d(dia, o);

  -- ---------- series por canal y día ----------
  select public.informe_pivote(jsonb_agg(to_jsonb(g))) into j_series from (
    select k.canal, d.o as dko,
      count(f.id) as filas,
      count(f.id) filter (where f.conv) as conversacion,
      count(f.id) filter (where f.foco) as foco,
      count(f.id) filter (where f.comp) as comparacion,
      count(f.id) filter (where f.otro_pais) as otro_pais,
      count(f.id) filter (where cardinality(f.ejes) > 0) as sin_duplicados,
      count(f.id) filter (where not f.otro_pais and cardinality(f.ejes) = 0) as sin_eje,
      count(f.id) filter (where f.ambito and not f.firme) as solo_busqueda,
      coalesce(sum(f.vistas), 0) as vistas_filas,
      coalesce(sum(f.vistas) filter (where f.conv), 0) as vistas_conversacion,
      coalesce(sum(f.vistas) filter (where f.foco), 0) as vistas_foco,
      coalesce(sum(f.vistas) filter (where f.comp), 0) as vistas_comparacion,
      coalesce(sum(f.vistas) filter (where f.ambito and not f.firme), 0) as vistas_solo_busqueda,
      coalesce(sum(f.interaccion) filter (where f.conv), 0) as interaccion_conversacion,
      coalesce(sum(f.interaccion) filter (where f.foco), 0) as interaccion_foco
    from unnest(v_canales) with ordinality k(canal, ko)
    cross join unnest(v_dias) with ordinality d(dia, o)
    left join unnest(v_filas) f on f.canal = k.canal and f.dia = d.dia
    group by k.canal, d.o) g;

  select public.informe_pivote(jsonb_agg(to_jsonb(g))) into j_com from (
    select k.canal, d.o as dko, count(x.id) as comentarios
    from unnest(v_canales_com) k(canal)
    cross join unnest(v_dias) with ordinality d(dia, o)
    left join public.comentarios x on x.campana_id = r.campana_id and x.canal = k.canal
      and x.publicada_en >= v_ini and x.publicada_en < v_fin and (x.publicada_en at time zone v_zona)::date = d.dia
    group by k.canal, d.o) g;
  j_series := coalesce(j_series, '{}'::jsonb) || jsonb_build_object('comentarios', coalesce(j_com->'comentarios', v_cero));
  -- Métricas que faltan (sin canales) quedan en cero.
  select j_series || coalesce(jsonb_object_agg(k, v_cero), '{}'::jsonb) into j_series
  from unnest(array['filas','conversacion','foco','comparacion','otro_pais','sin_duplicados','sin_eje','solo_busqueda','vistas_filas',
    'vistas_conversacion','vistas_foco','vistas_comparacion','vistas_solo_busqueda','interaccion_conversacion','interaccion_foco']) k
  where not j_series ? k;

  -- ---------- hora por hora del día del evento ----------
  if v_evento is not null then
    select public.informe_pivote(jsonb_agg(to_jsonb(g))) into j_hora from (
      select k.canal, h.h as dko,
        count(f.id) filter (where f.conv) as conversacion,
        count(f.id) filter (where f.foco) as foco
      from unnest(v_canales) k(canal)
      cross join generate_series(0, 23) h(h)
      left join unnest(v_filas) f on f.canal = k.canal and f.dia = v_evento and f.hora = h.h
      group by k.canal, h.h) g;
    select jsonb_build_object(
        'por_canal', coalesce(jsonb_object_agg(k.canal, round(coalesce(b.n, 0) / 24.0, 1)), '{}'::jsonb),
        'total', round(coalesce(sum(b.n), 0) / 24.0, 1),
        'n_por_canal', coalesce(jsonb_object_agg(k.canal, coalesce(b.n, 0)), '{}'::jsonb),
        'n_total', coalesce(sum(b.n), 0))
      into j_prom
      from unnest(v_canales) k(canal)
      left join (select f.canal, count(*) as n from unnest(v_filas) f where f.conv and f.dia = v_base group by f.canal) b on b.canal = k.canal;
    if v_base is null then j_prom := null; end if;
    -- Pico: la hora con más publicaciones (empate: la más temprana).
    for v_flag in select unnest(array['conversacion', 'foco']) loop
      with hh as (
        select f.canal, f.hora, count(*) as n from unnest(v_filas) f
        where f.dia = v_evento and case v_flag when 'conversacion' then f.conv else f.foco end group by f.canal, f.hora),
      pc as (select distinct on (canal) canal, hora, n from hh order by canal, n desc, hora),
      tt as (select hora, sum(n) as n from hh group by hora order by sum(n) desc, hora limit 1)
      select jsonb_build_object(
        'por_canal', coalesce((select jsonb_object_agg(pc.canal, jsonb_build_object('hora', pc.hora, 'n', pc.n,
            'veces_base', case when (j_prom->'n_por_canal'->>pc.canal)::numeric > 0
              then round(pc.n * 24.0 / (j_prom->'n_por_canal'->>pc.canal)::numeric, 1) end)) from pc), '{}'::jsonb),
        'total', (select jsonb_build_object('hora', tt.hora, 'n', tt.n,
            'veces_base', case when (j_prom->>'n_total')::numeric > 0 then round(tt.n * 24.0 / (j_prom->>'n_total')::numeric, 1) end) from tt))
      into j_m;
      if v_flag = 'conversacion' then j_pico := j_m; else j_pico_foco := j_m; end if;
    end loop;
  end if;

  -- ---------- desglose por canal (conversación y foco) ----------
  for v_flag in select unnest(array['conversacion', 'foco']) loop
    with p as (
      select k.canal, k.ko,
        count(f.id) as publicaciones, count(f.vistas) as con_vistas, count(f.interaccion) as con_interaccion,
        coalesce(sum(f.vistas), 0) as vistas, coalesce(sum(f.me_gusta), 0) as me_gusta, coalesce(sum(f.respuestas), 0) as respuestas,
        coalesce(sum(f.compartidos), 0) as compartidos, coalesce(sum(f.interaccion), 0) as interaccion
      from unnest(v_canales) with ordinality k(canal, ko)
      left join unnest(v_filas) f on f.canal = k.canal and case v_flag when 'conversacion' then f.conv else f.foco end
      group by k.canal, k.ko),
    t as (select coalesce(sum(publicaciones), 0) as publicaciones, coalesce(sum(con_vistas), 0) as con_vistas, coalesce(sum(con_interaccion), 0) as con_interaccion,
      coalesce(sum(vistas), 0) as vistas, coalesce(sum(me_gusta), 0) as me_gusta, coalesce(sum(respuestas), 0) as respuestas,
      coalesce(sum(compartidos), 0) as compartidos, coalesce(sum(interaccion), 0) as interaccion from p)
    select jsonb_build_object(
      'filas', coalesce((select jsonb_agg(to_jsonb(p) - 'ko' || jsonb_build_object(
          'pct_publicaciones', public.informe_pct(p.publicaciones, t.publicaciones),
          'pct_vistas', case when p.con_vistas > 0 then public.informe_pct(p.vistas, t.vistas) end,
          'pct_interaccion', case when p.con_interaccion > 0 then public.informe_pct(p.interaccion, t.interaccion) end) order by p.ko) from p), '[]'::jsonb),
      'total', to_jsonb(t))
    into j_m from t;
    j_desglose := j_desglose || jsonb_build_object(v_flag, j_m);
  end loop;

  -- ---------- ejes ----------
  select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'nombre', e.nombre, 'regla', e.regla, 'terminos', e.terminos, 'color', e.color, 'orden', e.orden)
    order by e.orden, e.nombre), '[]'::jsonb) into j_ejes_def from public.ejes e where e.campana_id = r.campana_id;
  with g as (
    select e.id as eje_id, e.o as eo, k.canal, d.o as dko, d.dia, count(f.id) as n
    from unnest(v_ejes) with ordinality e(id, o)
    cross join unnest(v_canales) k(canal)
    cross join unnest(v_dias) with ordinality d(dia, o)
    left join unnest(v_filas) f on f.canal = k.canal and f.dia = d.dia and e.id = any (f.ejes)
    group by e.id, e.o, k.canal, d.o, d.dia),
  t as (
    select g.*, rc.tope, rc.estimado from g
    left join lateral (select bool_or(x.llego_al_tope) as tope, max(x.estimado) as estimado from public.recolecciones x
      where x.campana_id = r.campana_id and x.eje_id = g.eje_id and x.canal = g.canal and x.dia = g.dia) rc on true),
  pc as (
    select eje_id, eo, canal, sum(n) as total, jsonb_build_object('por_dia', jsonb_agg(n order by dko), 'total', sum(n),
      'tope', jsonb_agg(coalesce(tope, false) order by dko), 'estimado', jsonb_agg(case when tope then estimado end order by dko)) as obj
    from t group by eje_id, eo, canal)
  select coalesce(jsonb_agg(z.obj order by z.eo), '[]'::jsonb) into j_ejes from (
    select pc.eo, jsonb_build_object('eje_id', pc.eje_id, 'nombre', min(e.nombre), 'total', sum(pc.total), 'por_canal', jsonb_object_agg(pc.canal, pc.obj)) as obj
    from pc join public.ejes e on e.id = pc.eje_id group by pc.eje_id, pc.eo) z;

  -- ---------- rankings de publicaciones (ámbito, solo Regla o Manual) ----------
  with p as (
    select f.canal, f.id, f.autor_id, f.vistas, f.interaccion, f.publicada_en, public.informe_visible(a, f.canal) as vis
    from unnest(v_filas) f
    left join public.autores a on a.id = f.autor_id and a.campana_id = r.campana_id
    where f.firme),
  rk as (
    select p.*,
      row_number() over (partition by canal order by vistas desc nulls last, interaccion desc nulls last, publicada_en, id) as rv,
      row_number() over (partition by canal order by interaccion desc nulls last, vistas desc nulls last, publicada_en, id) as ri,
      row_number() over (partition by canal, vis order by vistas desc nulls last, interaccion desc nulls last, publicada_en, id) as rvv,
      row_number() over (partition by canal, vis order by interaccion desc nulls last, vistas desc nulls last, publicada_en, id) as riv
    from p),
  -- El JSON de cada publicación se arma solo para las que entran en alguna lista.
  o as (
    select rk.*, public.informe_pub(m, a) as obj
    from rk
    join public.menciones m on m.id = rk.id and m.campana_id = r.campana_id
    left join public.autores a on a.id = rk.autor_id and a.campana_id = r.campana_id
    where least(rk.rv, rk.ri, rk.rvv, rk.riv) <= n_pub),
  pc as (
    select canal, jsonb_build_object(
      'por_vistas', coalesce(jsonb_agg(obj order by rv) filter (where case when m_pub = 'omitir' then vis and rvv <= n_pub else rv <= n_pub end), '[]'::jsonb),
      'por_interaccion', coalesce(jsonb_agg(obj order by ri) filter (where case when m_pub = 'omitir' then vis and riv <= n_pub else ri <= n_pub end), '[]'::jsonb),
      'omitidas', jsonb_build_object(
        'por_vistas', case when m_pub = 'omitir' then count(*) filter (where not vis and rv <= n_pub) else 0 end,
        'por_interaccion', case when m_pub = 'omitir' then count(*) filter (where not vis and ri <= n_pub) else 0 end)) as obj
    from o group by canal)
  select coalesce(jsonb_object_agg(canal, obj), '{}'::jsonb) into j_rank_pub from pc;

  -- ---------- rankings de cuentas (ámbito, solo Regla o Manual) ----------
  with g as (
    select f.canal, coalesce(f.autor_id, 'fuente:' || coalesce(f.fuente, '')) as clave, f.autor_id, max(f.fuente) as fuente,
      count(*) as publicaciones, coalesce(sum(f.vistas), 0) as vistas, coalesce(sum(f.me_gusta), 0) as me_gusta,
      coalesce(sum(f.respuestas), 0) as respuestas, coalesce(sum(f.compartidos), 0) as compartidos,
      coalesce(sum(f.interaccion), 0) as interaccion, min(f.publicada_en) as primera
    from unnest(v_filas) f where f.firme
    group by f.canal, coalesce(f.autor_id, 'fuente:' || coalesce(f.fuente, '')), f.autor_id),
  h as (
    select g.*, public.informe_visible(a, g.canal) as vis
    from g left join public.autores a on a.id = g.autor_id and a.campana_id = r.campana_id),
  rk as (
    select h.*,
      row_number() over (partition by canal order by vistas desc, interaccion desc, publicaciones desc, clave) as r1,
      row_number() over (partition by canal order by interaccion desc, vistas desc, publicaciones desc, clave) as r2,
      row_number() over (partition by canal order by publicaciones desc, vistas desc, interaccion desc, clave) as r3,
      row_number() over (partition by canal order by me_gusta desc, vistas desc, publicaciones desc, clave) as r4,
      row_number() over (partition by canal order by respuestas desc, me_gusta desc, publicaciones desc, clave) as r5,
      row_number() over (partition by canal, vis order by vistas desc, interaccion desc, publicaciones desc, clave) as v1,
      row_number() over (partition by canal, vis order by interaccion desc, vistas desc, publicaciones desc, clave) as v2,
      row_number() over (partition by canal, vis order by publicaciones desc, vistas desc, interaccion desc, clave) as v3,
      row_number() over (partition by canal, vis order by me_gusta desc, vistas desc, publicaciones desc, clave) as v4,
      row_number() over (partition by canal, vis order by respuestas desc, me_gusta desc, publicaciones desc, clave) as v5,
      count(*) over (partition by canal) as cuentas
    from h),
  o as (
    select rk.*, public.informe_cuenta(a, rk.fuente, rk.canal) || jsonb_build_object('publicaciones', rk.publicaciones, 'vistas', rk.vistas,
        'me_gusta', rk.me_gusta, 'respuestas', rk.respuestas, 'compartidos', rk.compartidos, 'interaccion', rk.interaccion, 'primera', rk.primera) as obj
    from rk left join public.autores a on a.id = rk.autor_id and a.campana_id = r.campana_id
    where least(rk.r1, rk.r2, rk.r3, rk.r4, rk.r5, rk.v1, rk.v2, rk.v3, rk.v4, rk.v5) <= n_cta),
  pc as (
    select canal, jsonb_build_object(
      'por_vistas', coalesce(jsonb_agg(obj order by r1) filter (where case when m_cta = 'omitir' then vis and v1 <= n_cta else r1 <= n_cta end), '[]'::jsonb),
      'por_interaccion', coalesce(jsonb_agg(obj order by r2) filter (where case when m_cta = 'omitir' then vis and v2 <= n_cta else r2 <= n_cta end), '[]'::jsonb),
      'por_publicaciones', coalesce(jsonb_agg(obj order by r3) filter (where case when m_cta = 'omitir' then vis and v3 <= n_cta else r3 <= n_cta end), '[]'::jsonb),
      'por_me_gusta', coalesce(jsonb_agg(obj order by r4) filter (where case when m_cta = 'omitir' then vis and v4 <= n_cta else r4 <= n_cta end), '[]'::jsonb),
      'por_respuestas', coalesce(jsonb_agg(obj order by r5) filter (where case when m_cta = 'omitir' then vis and v5 <= n_cta else r5 <= n_cta end), '[]'::jsonb),
      'cuentas', max(cuentas),
      'omitidas', jsonb_build_object(
        'por_vistas', case when m_cta = 'omitir' then count(*) filter (where not vis and r1 <= n_cta) else 0 end,
        'por_interaccion', case when m_cta = 'omitir' then count(*) filter (where not vis and r2 <= n_cta) else 0 end,
        'por_publicaciones', case when m_cta = 'omitir' then count(*) filter (where not vis and r3 <= n_cta) else 0 end,
        'por_me_gusta', case when m_cta = 'omitir' then count(*) filter (where not vis and r4 <= n_cta) else 0 end,
        'por_respuestas', case when m_cta = 'omitir' then count(*) filter (where not vis and r5 <= n_cta) else 0 end)) as obj
    from o group by canal)
  select coalesce(jsonb_object_agg(canal, obj), '{}'::jsonb) into j_rank_cta from pc;

  -- ---------- medios ----------
  select count(*) into n_titulares from unnest(v_filas) f where f.canal = 'Medio digital' and f.ambito;
  select coalesce(jsonb_agg(jsonb_build_object('mencion_id', z.id, 'fuente', z.fuente, 'titulo', z.titulo, 'publicada_en', z.publicada_en, 'url', z.url)
    order by z.publicada_en, z.id), '[]'::jsonb) into j_titulares
  from (select m.id, m.fuente, coalesce(m.titulo, left(coalesce(m.texto, m.resumen), 280)) as titulo, m.publicada_en, m.url
        from unnest(v_filas) f join public.menciones m on m.id = f.id and m.campana_id = r.campana_id
        where f.canal = 'Medio digital' and f.ambito order by m.publicada_en, m.id limit n_tit) z;
  select coalesce(jsonb_agg(jsonb_build_object('fuente', z.fuente, 'articulos', z.n) order by z.n desc, z.fuente), '[]'::jsonb) into j_por_fuente
  from (select coalesce(f.fuente, 'Medio sin nombre') as fuente, count(*) as n from unnest(v_filas) f
        where f.canal = 'Medio digital' and f.ambito group by 1 order by 2 desc, 1 limit n_med) z;
  select coalesce(jsonb_object_agg(z.canal, z.lista), '{}'::jsonb) into j_med_cuentas from (
    select y.canal, jsonb_agg(y.obj order by y.primera, y.clave) as lista from (
      select f.canal, a.id as clave, min(f.publicada_en) as primera,
        public.informe_cuenta(a, null, f.canal) || jsonb_build_object('publicaciones', count(*), 'primera', min(f.publicada_en),
          'vistas', coalesce(sum(f.vistas), 0), 'con_vistas', count(f.vistas), 'me_gusta', coalesce(sum(f.me_gusta), 0),
          'interaccion', coalesce(sum(f.interaccion), 0)) as obj
      from unnest(v_filas) f join public.autores a on a.id = f.autor_id and a.campana_id = r.campana_id
      where f.ambito and a.tipo = 'Medio' and public.informe_visible(a, f.canal)
      group by f.canal, a.id) y
    group by y.canal) z;

  -- ---------- comentarios: concentración ----------
  with amb as (
    select distinct me.mencion_id from public.mencion_ejes me join public.menciones pm on pm.id = me.mencion_id
    where me.campana_id = r.campana_id and me.eje_id = any (v_amb_ejes) and pm.en_tema and not pm.otro_pais),
  prop as (
    select pm.id from public.menciones pm join public.autores a on a.id = pm.autor_id and a.campana_id = r.campana_id
    where pm.campana_id = r.campana_id and (a.id = any (v_propias) or a.figura_id is not null)),
  cm as (
    select x.id, x.canal, x.mencion_id, x.duplicado, x.solo_emojis, amb.mencion_id is not null as en_ambito, prop.id is not null as de_propias
    from public.comentarios x
    left join amb on amb.mencion_id = x.mencion_id
    left join prop on prop.id = x.mencion_id
    where x.campana_id = r.campana_id and x.publicada_en >= v_ini and x.publicada_en < v_fin and (v_canales_cfg is null or x.canal = any (v_canales_cfg))),
  porpub as (
    select cm.canal, cm.mencion_id, count(*) as n,
      row_number() over (partition by cm.canal order by count(*) desc, cm.mencion_id) as rn
    from cm where cm.mencion_id is not null group by cm.canal, cm.mencion_id),
  agg as (
    select cm.canal, count(*) as comentarios, count(distinct cm.mencion_id) as publicaciones,
      count(*) filter (where cm.en_ambito) as en_ambito, count(*) filter (where cm.de_propias) as de_cuentas_propias,
      count(*) filter (where cm.duplicado) as duplicados, count(*) filter (where cm.solo_emojis) as solo_emojis
    from cm group by cm.canal)
  select jsonb_build_object(
    'por_canal', coalesce((select jsonb_object_agg(agg.canal, to_jsonb(agg) - 'canal' || jsonb_build_object(
        'pct_en_ambito', public.informe_pct(agg.en_ambito, agg.comentarios),
        'pct_de_cuentas_propias', public.informe_pct(agg.de_cuentas_propias, agg.comentarios),
        'top', coalesce((select jsonb_agg(public.informe_pub(m, a) || jsonb_build_object('comentarios', pp.n, 'pct', public.informe_pct(pp.n, agg.comentarios)) order by pp.rn)
                 from porpub pp join public.menciones m on m.id = pp.mencion_id and m.campana_id = r.campana_id
                 left join public.autores a on a.id = m.autor_id and a.campana_id = r.campana_id
                 where pp.canal = agg.canal and pp.rn <= n_com), '[]'::jsonb))) from agg), '{}'::jsonb),
    'total', (select jsonb_build_object('comentarios', coalesce(sum(comentarios), 0), 'publicaciones', coalesce(sum(publicaciones), 0),
        'en_ambito', coalesce(sum(en_ambito), 0), 'de_cuentas_propias', coalesce(sum(de_cuentas_propias), 0),
        'duplicados', coalesce(sum(duplicados), 0), 'solo_emojis', coalesce(sum(solo_emojis), 0)) from agg))
  into j_coment;

  -- ---------- muestras: sentimiento y temas ----------
  select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'libro', k.libro, 'nombre', k.nombre, 'tono', k.tono, 'orden', k.orden) order by k.libro, k.orden, k.nombre), '[]'::jsonb)
  into j_codigos from public.codigos k
  where k.campana_id = r.campana_id and (nullif(cfg->>'libro', '') is null or k.libro = cfg->>'libro');
  for mu in select x.* from unnest(v_muestras) with ordinality u(id, o) join public.muestras x on x.id = u.id order by u.o loop
    v_pond := mu.ponderacion = 'por volumen' and jsonb_typeof(mu.estratos) = 'array' and jsonb_array_length(mu.estratos) > 0;
    with cod as (
      select coalesce(cm.canal, mn.canal) as canal, k.sentimiento, k.codigo_id
      from public.codificaciones k
      left join public.comentarios cm on cm.id = k.comentario_id and cm.campana_id = r.campana_id
      left join public.menciones mn on mn.id = k.mencion_id and mn.campana_id = r.campana_id
      where k.campana_id = r.campana_id and k.muestra_id = mu.id),
    uni as (
      select e->>'canal' as canal, nullif(e->>'universo', '')::numeric as universo, o
      from jsonb_array_elements(case when jsonb_typeof(mu.estratos) = 'array' then mu.estratos else '[]'::jsonb end) with ordinality x(e, o)),
    est as (
      select coalesce(u.canal, s.canal) as canal, coalesce(u.o, 1000) as o, u.universo,
        coalesce(s.n, 0) as n, coalesce(s.fav, 0) as fav, coalesce(s.neu, 0) as neu, coalesce(s.des, 0) as des
      from (select canal, count(*) as n, count(*) filter (where sentimiento = 'Favorable') as fav,
              count(*) filter (where sentimiento = 'Neutral') as neu, count(*) filter (where sentimiento = 'Desfavorable') as des
            from cod group by canal) s
      full join uni u on u.canal = s.canal),
    -- Pesos: universo del estrato / universo de los estratos con ítems codificados.
    w as (select canal, universo / nullif(sum(universo) over (), 0) as peso from est where v_pond and n > 0 and universo is not null),
    tot as (select count(*) as n, count(*) filter (where sentimiento = 'Favorable') as fav, count(*) filter (where sentimiento = 'Neutral') as neu,
              count(*) filter (where sentimiento = 'Desfavorable') as des, count(sentimiento) as con_sentimiento from cod),
    tem as (
      select k.codigo_id, count(*) as n from cod k where k.codigo_id is not null group by k.codigo_id),
    tem_est as (
      select k.codigo_id, k.canal, count(*) as n from cod k where k.codigo_id is not null group by k.codigo_id, k.canal)
    select jsonb_build_object(
      'id', mu.id, 'nombre', mu.nombre, 'objeto', mu.objeto, 'canal', mu.canal, 'universo', mu.universo, 'tamano', mu.tamano,
      'semilla', mu.semilla, 'metodo', mu.metodo, 'ponderacion', mu.ponderacion, 'extra', mu.extra,
      'n', tot.n, 'con_sentimiento', tot.con_sentimiento,
      'margen_max', case when tot.n > 0 then round(1.96 * sqrt(0.25 / tot.n) * 100)::int end,
      'sentimiento', jsonb_build_object(
        'favorable', jsonb_build_object('n', tot.fav, 'pct', public.informe_pct(tot.fav, tot.n)),
        'neutral', jsonb_build_object('n', tot.neu, 'pct', public.informe_pct(tot.neu, tot.n)),
        'desfavorable', jsonb_build_object('n', tot.des, 'pct', public.informe_pct(tot.des, tot.n))),
      'ponderado', case when v_pond and exists (select 1 from w) then jsonb_build_object(
        'favorable', (select round(sum(w.peso * est.fav * 100.0 / est.n), 1) from w join est using (canal)),
        'neutral', (select round(sum(w.peso * est.neu * 100.0 / est.n), 1) from w join est using (canal)),
        'desfavorable', (select round(sum(w.peso * est.des * 100.0 / est.n), 1) from w join est using (canal)),
        'universo', (select sum(est.universo) from w join est using (canal))) end,
      'estratos', coalesce((select jsonb_agg(jsonb_build_object('canal', est.canal, 'universo', est.universo, 'n', est.n,
          'margen_max', case when est.n > 0 then round(1.96 * sqrt(0.25 / est.n) * 100)::int end,
          'peso', (select round(w.peso, 4) from w where w.canal = est.canal),
          'favorable', jsonb_build_object('n', est.fav, 'pct', public.informe_pct(est.fav, est.n)),
          'neutral', jsonb_build_object('n', est.neu, 'pct', public.informe_pct(est.neu, est.n)),
          'desfavorable', jsonb_build_object('n', est.des, 'pct', public.informe_pct(est.des, est.n))) order by est.o, est.canal) from est), '[]'::jsonb),
      'temas', coalesce((select jsonb_agg(jsonb_build_object('codigo_id', tem.codigo_id, 'n', tem.n, 'pct', public.informe_pct(tem.n, tot.n),
          'pct_ponderado', case when v_pond and exists (select 1 from w)
            then coalesce((select round(sum(w.peso * coalesce(te.n, 0) * 100.0 / est.n), 1) from w join est using (canal)
                           left join tem_est te on te.canal = w.canal and te.codigo_id = tem.codigo_id), 0)
            else public.informe_pct(tem.n, tot.n) end,
          'por_estrato', coalesce((select jsonb_object_agg(te.canal, jsonb_build_object('n', te.n,
              'pct', public.informe_pct(te.n, (select est.n from est where est.canal = te.canal))))
            from tem_est te where te.codigo_id = tem.codigo_id), '{}'::jsonb))
        order by tem.n desc, tem.codigo_id) from tem), '[]'::jsonb),
      'sin_codigo', (select count(*) from cod where codigo_id is null))
    into j_m from tot;
    j_muestras := j_muestras || jsonb_build_array(j_m);
  end loop;

  -- ---------- recolecciones (Metodología) ----------
  select coalesce(jsonb_agg(to_jsonb(x) - 'campana_id' || jsonb_build_object('eje_nombre', e.nombre)
      order by coalesce(array_position(v_orden, x.canal), 99), x.canal, x.dia nulls first, x.ejecutada_en nulls first, x.id), '[]'::jsonb)
  into j_recol
  from public.recolecciones x left join public.ejes e on e.id = x.eje_id
  where x.campana_id = r.campana_id
    and ((x.dia is not null and x.dia = any (v_dias))
      or (x.dia is null and (x.periodo_inicio is null or x.periodo_inicio < v_fin) and (x.periodo_fin is null or x.periodo_fin > v_ini)));

  -- ---------- destacadas (elegidas por quien analiza) ----------
  with d as (
    select o, public.informe_pub(m, a) || jsonb_build_object('eje_id', e->>'eje_id', 'resumen', e->>'resumen', 'etiqueta', e->>'etiqueta',
        'grupo', coalesce(nullif(e->>'grupo', ''), 'destacadas')) as obj,
      public.informe_visible(a, m.canal) as vis
    from jsonb_array_elements(case when jsonb_typeof(cfg->'destacadas') = 'array' then cfg->'destacadas' else '[]'::jsonb end) with ordinality x(e, o)
    join public.menciones m on m.id = e->>'mencion_id' and m.campana_id = r.campana_id
    left join public.autores a on a.id = m.autor_id and a.campana_id = r.campana_id)
  select coalesce(jsonb_agg(obj order by o) filter (where m_dest = 'agrupar' or vis), '[]'::jsonb),
         count(*) filter (where m_dest = 'omitir' and not vis)
  into j_dest, n_dest_omit from d;

  -- ---------- cuentas propias (la emisora, el medio anfitrión…) ----------
  with prop as (
    select f.*, m, a from unnest(v_filas) f
    join public.menciones m on m.id = f.id and m.campana_id = r.campana_id
    join public.autores a on a.id = f.autor_id and a.campana_id = r.campana_id
    where f.autor_id = any (v_propias)),
  qe as (
    select e->>'mencion_id' as mencion_id, e->>'resumen' as que_es
    from jsonb_array_elements(case when jsonb_typeof(cfg->'destacadas') = 'array' then cfg->'destacadas' else '[]'::jsonb end) e
    where e->>'grupo' = 'propias')
  select jsonb_build_object(
    'autores', coalesce((select jsonb_agg(public.informe_cuenta(a, null, a.canal) order by u.o)
        from unnest(v_propias) with ordinality u(id, o) join public.autores a on a.id = u.id), '[]'::jsonb),
    'publicaciones', coalesce((select jsonb_agg(public.informe_pub(p.m, p.a) || jsonb_build_object('que_es', qe.que_es)
        order by coalesce(array_position(v_orden, p.canal), 99), p.publicada_en, p.id)
        from prop p left join qe on qe.mencion_id = p.id where p.ambito or qe.mencion_id is not null), '[]'::jsonb),
    'por_canal', coalesce((select jsonb_agg(jsonb_build_object('canal', z.canal, 'publicaciones', z.n, 'vistas', z.vistas, 'en_ambito', z.en_ambito)
        order by coalesce(array_position(v_orden, z.canal), 99), z.canal)
        from (select p.canal, count(*) as n, coalesce(sum(p.vistas), 0) as vistas, count(*) filter (where p.ambito) as en_ambito from prop p group by p.canal) z), '[]'::jsonb))
  into j_propias;

  select jsonb_build_object('por_canal', coalesce(jsonb_object_agg(z.canal, z.n), '{}'::jsonb), 'total', (select count(distinct f.autor_id) from unnest(v_filas) f))
  into j_cuentas from (select f.canal, count(distinct f.autor_id) as n from unnest(v_filas) f group by f.canal) z;

  -- ---------- todo junto ----------
  return jsonb_build_object(
    'version', 1,
    'generado_en', now(),
    'reporte', jsonb_build_object('id', r.id, 'nombre', r.nombre, 'tipo', r.tipo, 'campana_id', r.campana_id, 'evento_id', coalesce(cfg->>'evento_id', r.evento_id)),
    'campana', jsonb_build_object('id', c.id, 'nombre', c.nombre, 'nombre_corto', c.nombre_corto, 'titulo_largo', c.titulo_largo, 'es_demo', c.es_demo, 'zona_horaria', c.zona_horaria),
    'config', cfg,
    'portada', jsonb_build_object('titulo', coalesce(cfg->>'titulo', r.nombre), 'subtitulo', cfg->>'subtitulo', 'nota_portada', cfg->>'nota_portada',
      'nota_version', cfg->>'nota_version', 'fecha_informe', coalesce(nullif(cfg->>'fecha_informe', '')::date, c.fecha_corte, (now() at time zone v_zona)::date)),
    'secciones', case when jsonb_typeof(cfg->'secciones') = 'array' then cfg->'secciones' else '[]'::jsonb end,
    'modo', v_modo,
    'zona', v_zona,
    'periodo', jsonb_build_object('inicio', v_ini, 'fin', v_fin,
      'inicio_local', to_char(v_ini at time zone v_zona, 'YYYY-MM-DD"T"HH24:MI'), 'fin_local', to_char(v_fin at time zone v_zona, 'YYYY-MM-DD"T"HH24:MI'),
      'dia_base', v_base, 'dia_evento', v_evento,
      'ventana_evento', case when v_vent_ini is not null then jsonb_build_object('inicio', v_vent_ini, 'fin', v_vent_fin,
        'hora_inicio', to_char(v_vent_ini at time zone v_zona, 'HH24:MI'), 'hora_fin', to_char(v_vent_fin at time zone v_zona, 'HH24:MI'),
        'estimada', coalesce((cfg->'ventana_evento'->>'estimada')::boolean, false)) end),
    'dias', coalesce(j_dias, '[]'::jsonb),
    'canales', to_jsonb(v_canales),
    'canales_comentarios', to_jsonb(v_canales_com),
    'ejes_usados', jsonb_build_object('conversacion', v_conv, 'foco', v_foco, 'comparacion', v_comp, 'ejes', to_jsonb(v_ejes),
      'ambito_rankings', v_amb, 'ambito_ejes', to_jsonb(v_amb_ejes)),
    'series', j_series,
    'por_hora', case when v_evento is not null then jsonb_build_object('dia', v_evento,
      'conversacion', coalesce(j_hora->'conversacion', v_cero_h), 'foco', coalesce(j_hora->'foco', v_cero_h),
      'promedio_base', j_prom, 'pico', j_pico, 'pico_foco', j_pico_foco) end,
    'desglose', j_desglose,
    'cuentas_distintas', j_cuentas,
    'ejes', jsonb_build_object('definiciones', j_ejes_def, 'lista', j_ejes),
    'comparacion', case when v_comp is not null then jsonb_build_object('eje_id', v_comp,
      'nombre', (select e.nombre from public.ejes e where e.id = v_comp), 'etiqueta', cfg->'comparacion'->>'etiqueta') end,
    'rankings', jsonb_build_object('ambito', v_amb, 'modo_publicaciones', m_pub, 'modo_cuentas', m_cta, 'limite_publicaciones', n_pub, 'limite_cuentas', n_cta,
      'publicaciones', j_rank_pub, 'cuentas', j_rank_cta),
    'medios', jsonb_build_object('titulares', j_titulares, 'total_titulares', n_titulares, 'por_fuente', j_por_fuente, 'cuentas', j_med_cuentas),
    'comentarios', j_coment,
    'codigos', j_codigos,
    'muestras', j_muestras,
    'recolecciones', j_recol,
    'destacadas', jsonb_build_object('lista', j_dest, 'omitidas', n_dest_omit, 'modo', m_dest),
    'cuentas_propias', j_propias
  );
end;
$$;

-- 900_acceso.sql vuelve a dar estos permisos; se dan aquí también por si esta migración se corre sola.
revoke all on function public.informe_datos(text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on function public.informe_datos(text) from anon; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant execute on function public.informe_datos(text) to authenticated; end if;
end $$;
