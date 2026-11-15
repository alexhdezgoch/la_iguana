-- La Iguana: esquema base.
-- Convenciones:
--   * id text: legible en los datos de ejemplo, uuid por defecto en filas nuevas.
--   * Toda tabla de datos de campaña lleva campana_id; el acceso (900_acceso.sql) se decide con esa columna.
--   * Las figuras y las personas son del equipo (org); su vínculo con cada campaña vive en campana_figuras y miembros_campana.
--   * Sin tipo numeric (la API lo devuelve como texto): integer, bigint o double precision.
--   * Los totales (menciones, participación, neto, riesgo) son cortes guardados que escribe la ingesta. En esta fase vienen de la semilla.
--   * detalle / extra jsonb guardan solo detalle de presentación. Lo que la ingesta va a escribir tiene columna o tabla propia.

create extension if not exists pgcrypto;

create or replace function public.nuevo_id() returns text
language sql volatile as $$ select gen_random_uuid()::text $$;

-- ====================================================================
-- Equipo
-- ====================================================================

create table public.organizaciones (
  id text primary key default public.nuevo_id(),
  nombre text not null,
  iniciales text,
  creada_en timestamptz not null default now()
);

-- Personas del equipo y de los clientes. user_id se llena cuando la persona tiene cuenta (por correo).
create table public.personas (
  id text primary key default public.nuevo_id(),
  org_id text not null references public.organizaciones(id) on delete cascade,
  user_id uuid unique,
  nombre text not null,
  nombre_corto text,                    -- "Lucía G."
  iniciales text,
  email text,
  puesto text,
  -- admin: ve y administra todas las campañas del equipo. miembro: solo las campañas donde está. externo: cliente o invitado.
  rol_org text not null default 'miembro' check (rol_org in ('admin','miembro','externo')),
  activa boolean not null default true,
  extra jsonb not null default '{}'::jsonb,
  creada_en timestamptz not null default now()
);
create unique index personas_org_email on public.personas (org_id, lower(email)) where email is not null;

-- Borradores de formularios largos (asistente de nueva campaña).
create table public.borradores (
  id text primary key default public.nuevo_id(),
  org_id text not null references public.organizaciones(id) on delete cascade,
  persona_id text not null references public.personas(id) on delete cascade,
  tipo text not null,                   -- 'nueva-campana'
  datos jsonb not null default '{}'::jsonb,
  actualizado_en timestamptz not null default now()
);

-- ====================================================================
-- Campañas
-- ====================================================================

create table public.campanas (
  id text primary key default public.nuevo_id(),
  org_id text not null references public.organizaciones(id) on delete cascade,
  nombre text not null,                 -- "María Corina Machado"
  contienda text,                       -- "Presidenciales 2027"
  titulo_largo text,                    -- "Presidenciales Venezuela 2027"
  iniciales text,
  ambito text,                          -- Presidenciales, Regionales, Municipales
  pais text,
  territorio text,
  fase text not null default 'Precampaña',   -- fase vigente; el calendario completo está en campana_fases
  inicio_campana date,
  fin_campana date,
  veda_inicio date,
  veda_fin date,
  jornada date,
  fecha_corte date,                     -- "hoy" de los datos de ejemplo; null = fecha real
  zona_horaria text not null default 'America/Caracas',
  periodo_inicio date,
  periodo_fin date,
  figura_propia_id text,
  vista text not null default 'completa' check (vista in ('completa','compacta')),
  es_demo boolean not null default false,
  estado text not null default 'Activa',
  orden integer not null default 0,
  extra jsonb not null default '{}'::jsonb,
  creada_por text references public.personas(id) on delete set null,
  creada_en timestamptz not null default now()
);

create table public.miembros_campana (
  id text primary key default public.nuevo_id(),
  campana_id text not null references public.campanas(id) on delete cascade,
  persona_id text not null references public.personas(id) on delete cascade,
  rol text not null default 'Análisis' check (rol in ('Administración','Análisis','Solo lectura','Cliente')),
  creado_en timestamptz not null default now(),
  unique (campana_id, persona_id)
);
create index on public.miembros_campana (persona_id);

create table public.campana_fases (
  id text primary key default public.nuevo_id(),
  campana_id text not null references public.campanas(id) on delete cascade,
  nombre text not null,                 -- Precampaña, Intercampaña, Campaña, Veda, Jornada electoral, Post-electoral
  inicio date,
  fin date,
  orden integer not null default 0,
  extra jsonb not null default '{}'::jsonb
);
create index on public.campana_fases (campana_id);

-- ====================================================================
-- Figuras
-- ====================================================================

-- La persona pública, una vez por equipo. Puede estar en varias campañas con relaciones distintas.
create table public.figuras (
  id text primary key default public.nuevo_id(),
  org_id text not null references public.organizaciones(id) on delete cascade,
  nombre text not null,
  iniciales text,
  cargo text,
  partido text,
  coalicion text,
  territorio text,
  tipo text,                            -- Candidata/o, Funcionaria/o en funciones, Dirigente, Líder de opinión
  cuentas jsonb not null default '[]'::jsonb,   -- [{red, usuario, seguidores, verificada}]
  trayectoria text,
  extra jsonb not null default '{}'::jsonb,
  creada_en timestamptz not null default now()
);
create index on public.figuras (org_id);

create table public.campana_figuras (
  id text primary key default public.nuevo_id(),
  campana_id text not null references public.campanas(id) on delete cascade,
  figura_id text not null references public.figuras(id) on delete cascade,
  relacion text not null default 'A observar' check (relacion in ('Propia','Aliada','Rival','A observar')),
  responsable_id text references public.personas(id) on delete set null,
  orden integer not null default 0,
  extra jsonb not null default '{}'::jsonb,
  creada_en timestamptz not null default now(),
  unique (campana_id, figura_id)
);
create index on public.campana_figuras (figura_id);

-- Términos de búsqueda y exclusiones. De la campaña, de una figura o de un evento.
create table public.terminos (
  id text primary key default public.nuevo_id(),
  campana_id text not null references public.campanas(id) on delete cascade,
  figura_id text references public.figuras(id) on delete cascade,
  evento_id text,
  texto text not null,
  tipo text not null default 'Término',  -- Nombre, Apodo, Hashtag, Lema, Término, Exclusión
  activo boolean not null default true,
  orden integer not null default 0
);
create index on public.terminos (campana_id);

-- Corte de métricas por figura, campaña y periodo.
create table public.figura_metricas (
  id text primary key default public.nuevo_id(),
  campana_id text not null references public.campanas(id) on delete cascade,
  figura_id text not null references public.figuras(id) on delete cascade,
  periodo text not null default '30d',
  menciones integer not null default 0,
  participacion double precision,       -- % de la conversación de la campaña
  favorable integer,                    -- %
  neutral integer,
  desfavorable integer,
  neto integer,
  alcance bigint,
  seguidores bigint,
  interaccion double precision,         -- %
  notas_medios integer,
  riesgo integer,
  riesgo_nivel text check (riesgo_nivel in ('Bajo','Medio','Alto')),
  detalle jsonb not null default '{}'::jsonb,   -- cobertura por medio, audiencia, etc.
  unique (campana_id, figura_id, periodo)
);

-- Serie diaria de cualquier entidad: figura, tema, narrativa, evento o la campaña completa.
create table public.series_diarias (
  id text primary key default public.nuevo_id(),
  campana_id text not null references public.campanas(id) on delete cascade,
  entidad text not null check (entidad in ('campana','figura','tema','narrativa','evento')),
  entidad_id text not null,
  fecha date not null,
  menciones integer not null default 0,
  favorable integer,
  neutral integer,
  desfavorable integer,
  alcance bigint,
  unique (campana_id, entidad, entidad_id, fecha)
);

-- ====================================================================
-- Temas y narrativas
-- ====================================================================

create table public.temas (
  id text primary key default public.nuevo_id(),
  campana_id text not null references public.campanas(id) on delete cascade,
  nombre text not null,
  menciones integer not null default 0,
  porcentaje double precision,
  cambio double precision,              -- % de cambio contra el periodo anterior
  tendencia text,
  es_propio boolean not null default false,
  orden integer not null default 0,
  detalle jsonb not null default '{}'::jsonb
);
create index on public.temas (campana_id);

-- Cruce tema × figura (mapa de calor).
create table public.tema_figuras (
  id text primary key default public.nuevo_id(),
  campana_id text not null references public.campanas(id) on delete cascade,
  tema_id text not null references public.temas(id) on delete cascade,
  figura_id text not null references public.figuras(id) on delete cascade,
  menciones integer not null default 0,
  porcentaje double precision,
  neto integer,
  unique (tema_id, figura_id)
);
create index on public.tema_figuras (campana_id);

create table public.narrativas (
  id text primary key default public.nuevo_id(),
  campana_id text not null references public.campanas(id) on delete cascade,
  figura_id text references public.figuras(id) on delete set null,
  tema_id text references public.temas(id) on delete set null,
  nombre text not null,
  direccion text not null default 'Sin dirección' check (direccion in ('Favorable','Desfavorable','Sin dirección','Posicionamiento')),
  menciones integer not null default 0,
  tendencia text,                       -- En aumento, Estable, A la baja
  cambio_24h double precision,
  estado text not null default 'Activa',
  seguida boolean not null default false,
  descripcion text,
  orden integer not null default 0,
  detalle jsonb not null default '{}'::jsonb   -- canales, quién la impulsa, hallazgos "posibles", relacionadas
);
create index on public.narrativas (campana_id);

-- ====================================================================
-- Eventos
-- ====================================================================

create table public.eventos (
  id text primary key default public.nuevo_id(),
  campana_id text not null references public.campanas(id) on delete cascade,
  nombre text not null,
  tipo text not null,                   -- Mitin, Debate, Gira, Conferencia de prensa, Encuentro ciudadano, Informe, Entrevista, Crisis
  es_crisis boolean not null default false,
  origen text not null default 'Propio' check (origen in ('Propio','De rival','Institucional')),
  estado text not null default 'Borrador' check (estado in ('Borrador','Programado','En curso','En análisis','Cerrado','Cancelado')),
  fecha_inicio date,
  fecha_fin date,
  hora text,
  sede text,
  ciudad text,
  objetivos text,
  narrativa_id text references public.narrativas(id) on delete set null,
  hashtags text[] not null default '{}',
  ventana_horas integer not null default 72,
  asistencia integer,
  responsable_id text references public.personas(id) on delete set null,
  nota_estado text,                     -- "Día 4 de 5", "Resultados preliminares"
  menciones integer,
  menciones_antes integer,
  menciones_durante integer,
  menciones_despues integer,
  alcance bigint,
  neto integer,
  neto_antes integer,
  notas_medios integer,
  veredicto text,
  resultados jsonb not null default '{}'::jsonb,  -- pico, hashtags, cobertura, publicaciones destacadas, reacciones
  aprendizajes text,
  extra jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now()
);
create index on public.eventos (campana_id);
alter table public.terminos add constraint terminos_evento_fk foreign key (evento_id) references public.eventos(id) on delete cascade;

create table public.evento_participantes (
  id text primary key default public.nuevo_id(),
  campana_id text not null references public.campanas(id) on delete cascade,
  evento_id text not null references public.eventos(id) on delete cascade,
  figura_id text not null references public.figuras(id) on delete cascade,
  rol text not null default 'Invitada/o',   -- Protagonista, Oradora/or, Invitada/o, Adversaria/o, Moderadora/or
  menciones integer,
  participacion double precision,
  favorable integer,
  neutral integer,
  desfavorable integer,
  neto integer,
  orden integer not null default 0,
  extra jsonb not null default '{}'::jsonb,
  unique (evento_id, figura_id)
);
create index on public.evento_participantes (campana_id);

create table public.evento_mensajes (
  id text primary key default public.nuevo_id(),
  campana_id text not null references public.campanas(id) on delete cascade,
  evento_id text not null references public.eventos(id) on delete cascade,
  texto text not null,
  terminos text[] not null default '{}',
  menciones integer,
  porcentaje double precision,
  estado text,                          -- Aterrizó, Parcial, No aterrizó
  orden integer not null default 0
);
create index on public.evento_mensajes (campana_id);

-- ====================================================================
-- Menciones
-- ====================================================================

create table public.menciones (
  id text primary key default public.nuevo_id(),
  campana_id text not null references public.campanas(id) on delete cascade,
  canal text not null,                  -- X, Facebook, TikTok, Instagram, Medio digital, YouTube, Radio, Televisión
  fuente text,                          -- medio o "Cuenta pública"; nunca el nombre de una persona privada
  fuente_tipo text,
  titulo text,
  resumen text,
  url text,
  publicada_en timestamptz,
  figura_id text references public.figuras(id) on delete set null,   -- figura principal
  tema_id text references public.temas(id) on delete set null,
  narrativa_id text references public.narrativas(id) on delete set null,
  evento_id text references public.eventos(id) on delete set null,
  sentimiento text check (sentimiento in ('Favorable','Neutral','Desfavorable')),          -- clasificación automática, figura principal
  sentimiento_manual text check (sentimiento_manual in ('Favorable','Neutral','Desfavorable')),
  importancia text check (importancia in ('alto','medio','bajo')),
  alcance bigint,
  interacciones bigint,
  requiere_revision boolean not null default false,   -- la ingesta marca las importantes para revisión humana
  revisada boolean not null default false,
  revisada_por text references public.personas(id) on delete set null,
  revisada_en timestamptz,
  estado text not null default 'Procesada' check (estado in ('Por procesar','Procesada','Descartada')),
  origen text not null default 'Ingesta' check (origen in ('Ingesta','Manual')),
  extra jsonb not null default '{}'::jsonb,
  creada_en timestamptz not null default now()
);
create index on public.menciones (campana_id, publicada_en desc);

-- Una mención puede nombrar a varias figuras, cada una con su propio sentimiento.
create table public.mencion_figuras (
  id text primary key default public.nuevo_id(),
  campana_id text not null references public.campanas(id) on delete cascade,
  mencion_id text not null references public.menciones(id) on delete cascade,
  figura_id text not null references public.figuras(id) on delete cascade,
  sentimiento text check (sentimiento in ('Favorable','Neutral','Desfavorable')),
  sentimiento_manual text check (sentimiento_manual in ('Favorable','Neutral','Desfavorable')),
  unique (mencion_id, figura_id)
);
create index on public.mencion_figuras (campana_id);

-- ====================================================================
-- Alertas
-- ====================================================================

create table public.reglas_alerta (
  id text primary key default public.nuevo_id(),
  campana_id text not null references public.campanas(id) on delete cascade,
  nombre text not null,
  tipo text,                            -- Narrativa, Riesgo, Rival en tema propio, Sentimiento, Medios, Volumen
  descripcion text,
  condicion jsonb not null default '{}'::jsonb,   -- {metrica, operador, umbral, ventana, alcance}
  severidad text not null default 'Media',        -- Alta, Media, Baja o "Según tamaño"
  canales text[] not null default '{}',           -- En la app, Email, WhatsApp, Slack, Telegram
  destinatarios jsonb not null default '[]'::jsonb,
  activa boolean not null default true,
  narrativa_id text references public.narrativas(id) on delete cascade,
  figura_id text references public.figuras(id) on delete cascade,
  orden integer not null default 0,
  extra jsonb not null default '{}'::jsonb,
  creada_en timestamptz not null default now()
);
create index on public.reglas_alerta (campana_id);

create table public.alertas (
  id text primary key default public.nuevo_id(),
  campana_id text not null references public.campanas(id) on delete cascade,
  regla_id text references public.reglas_alerta(id) on delete set null,
  severidad text not null default 'Media' check (severidad in ('Alta','Media','Baja')),
  estado text not null default 'Nueva' check (estado in ('Nueva','En revisión','Pospuesta','Resuelta','Descartada')),
  texto text not null,
  tipo text,
  explicacion text,
  valor text,
  umbral text,
  ventana text,
  disparos integer not null default 1,
  figura_id text references public.figuras(id) on delete set null,
  narrativa_id text references public.narrativas(id) on delete set null,
  tema_id text references public.temas(id) on delete set null,
  evento_id text references public.eventos(id) on delete set null,
  responsable_id text references public.personas(id) on delete set null,
  detectada_en timestamptz not null default now(),
  pospuesta_hasta timestamptz,
  resuelta_en timestamptz,
  motivo_cierre text,
  detalle jsonb not null default '{}'::jsonb,   -- serie de la gráfica, evidencia, contexto, pasos sugeridos
  orden integer not null default 0
);
create index on public.alertas (campana_id);

create table public.alerta_actividad (
  id text primary key default public.nuevo_id(),
  campana_id text not null references public.campanas(id) on delete cascade,
  alerta_id text not null references public.alertas(id) on delete cascade,
  persona_id text references public.personas(id) on delete set null,
  texto text not null,
  creada_en timestamptz not null default now()
);
create index on public.alerta_actividad (alerta_id);

-- ====================================================================
-- Reportes
-- ====================================================================

create table public.reportes (
  id text primary key default public.nuevo_id(),
  campana_id text not null references public.campanas(id) on delete cascade,
  nombre text not null,
  tipo text not null,                   -- Corte diario, Post-evento, Semanal, A la medida
  frecuencia text,
  hora text,
  destinatarios jsonb not null default '[]'::jsonb,  -- [{persona_id}|{email}|{lista}]
  secciones jsonb not null default '[]'::jsonb,
  formato text,
  evento_id text references public.eventos(id) on delete set null,
  estado text not null default 'Activo',
  requiere_aprobacion boolean not null default false,
  ultimo_envio timestamptz,
  proximo_envio timestamptz,
  orden integer not null default 0,
  extra jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now()
);
create index on public.reportes (campana_id);

-- Cada edición de un reporte. En esta fase nada se envía por correo: estado 'Pendiente de envío'.
create table public.reporte_envios (
  id text primary key default public.nuevo_id(),
  campana_id text not null references public.campanas(id) on delete cascade,
  reporte_id text not null references public.reportes(id) on delete cascade,
  titulo text,
  generado_en timestamptz not null default now(),
  enviado_en timestamptz,
  estado text not null default 'Pendiente de envío',
  destinatarios integer,
  aprobado_por text references public.personas(id) on delete set null,
  contenido jsonb not null default '{}'::jsonb,
  extra jsonb not null default '{}'::jsonb
);
create index on public.reporte_envios (campana_id);

-- ====================================================================
-- Notas internas (nunca visibles para el rol Cliente ni incluidas en exportaciones)
-- ====================================================================

create table public.notas_internas (
  id text primary key default public.nuevo_id(),
  campana_id text not null references public.campanas(id) on delete cascade,
  entidad text not null check (entidad in ('campana','figura','evento','mencion','narrativa','alerta')),
  entidad_id text not null,
  texto text not null,
  autor_id text references public.personas(id) on delete set null,
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);
create index on public.notas_internas (campana_id, entidad, entidad_id);
