-- Informe: filas crudas para el informe de impacto o de conversación (tipo de reporte 'Informe').
-- A diferencia del resto de la app, el Informe no lee cortes guardados: calcula cada cifra al vuelo desde estas filas
-- (menciones, comentarios, codificaciones, recolecciones) con public.informe_datos() (860_informe.sql).
-- Solo agrega: nada se borra ni se renombra, y toda columna nueva tiene valor por defecto o admite nulos,
-- así que las filas y altas existentes siguen funcionando. Se puede correr más de una vez.
-- Corre antes de 900_acceso.sql: las reglas de acceso y la revisión de referencias entre campañas cubren estas tablas.
-- Vocabulario de canal: el mismo de menciones.canal (X, Facebook, TikTok, Instagram, Medio digital, YouTube, Radio, Televisión).
-- El Informe rotula "Medio digital" como "Noticias".

-- ---------- autores: cuentas que publican (nunca autores de comentarios) ----------
-- Regla de publicación (la aplica informe_datos): el usuario se muestra solo si seguidores >= 100.000 o es_organizacion.
create table if not exists public.autores (
  id text primary key default public.nuevo_id(),
  campana_id text not null references public.campanas(id) on delete cascade,
  canal text not null,
  handle text,                          -- como se muestra: '@medio_digital_4', 'Canal de ejemplo'
  nombre text,
  tipo text not null default 'Tipo no confirmado' check (tipo in ('Medio','Periodista','Partido u organización','Campaña política',
    'Cuenta de opinión con gran audiencia','Analista','Emisora','Cuenta personal','Tipo no confirmado')),
  descriptor text,                      -- precisión del tipo: 'rama en Chile', 'página de Facebook', 'periodista y analista político'
  es_organizacion boolean not null default false,
  seguidores bigint,
  figura_id text references public.figuras(id) on delete set null,   -- cuenta oficial de una figura en seguimiento
  url text check (url is null or url ~* '^https?://[^[:space:]]+$'),
  extra jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now()
);
create unique index if not exists autores_campana_canal_handle on public.autores (campana_id, canal, handle);
create index if not exists autores_figura on public.autores (figura_id);

-- ---------- ejes: ejes del tema o marcas con una regla (sobre la figura, sobre el evento, nombra a la emisora…) ----------
-- terminos es jsonb a propósito: la tabla `terminos` son los términos de búsqueda de la campaña, otro propósito.
create table if not exists public.ejes (
  id text primary key default public.nuevo_id(),
  campana_id text not null references public.campanas(id) on delete cascade,
  nombre text not null,
  regla text,                           -- texto para Metodología: "el texto nombra … junto a una palabra de cárcel"
  terminos jsonb not null default '[]'::jsonb,
  color text,
  orden integer not null default 0,
  extra jsonb not null default '{}'::jsonb
);
create index if not exists ejes_campana on public.ejes (campana_id, orden);

-- ---------- recolecciones: bitácora de cada corrida de recolección (alimenta Metodología y los topes) ----------
create table if not exists public.recolecciones (
  id text primary key default public.nuevo_id(),
  campana_id text not null references public.campanas(id) on delete cascade,
  canal text not null,
  metodo text not null default 'Búsqueda avanzada' check (metodo in ('Búsqueda avanzada','Cuentas','Etiquetas','RSS','Búsqueda por palabras','Páginas')),
  descripcion text,
  consulta text,
  eje_id text references public.ejes(id) on delete set null,       -- búsqueda por eje (tope por eje y día)
  dia date,                                                         -- día de la búsqueda, hora local de la campaña
  periodo_inicio timestamptz,
  periodo_fin timestamptz,
  cubre_desde timestamptz,              -- lo más antiguo que alcanzó (cuentas que llegaron al límite de publicaciones)
  ejecutada_en timestamptz,
  filas integer,
  tope integer,
  llego_al_tope boolean not null default false,
  estimado integer,                     -- estimado del día completo cuando llegó al tope (ritmo parejo)
  pedidas integer,                      -- cuentas o páginas pedidas
  leidas integer,                       -- cuentas o páginas que devolvieron datos
  faltantes jsonb not null default '[]'::jsonb,   -- [{cuenta, motivo, desde}]
  limites text[] not null default '{}',
  extra jsonb not null default '{}'::jsonb
);
create index if not exists recolecciones_campana on public.recolecciones (campana_id, canal, dia);

-- ---------- menciones: columnas nuevas (todas con defecto o nulas) ----------
alter table public.menciones add column if not exists autor_id text references public.autores(id) on delete set null;
alter table public.menciones add column if not exists id_externo text;
alter table public.menciones add column if not exists texto text;
alter table public.menciones add column if not exists formato text check (formato in ('Texto','Foto','Video','Reel','Artículo','En vivo'));
alter table public.menciones add column if not exists vistas bigint;
alter table public.menciones add column if not exists me_gusta bigint;
alter table public.menciones add column if not exists respuestas bigint;       -- comentarios o respuestas que muestra la publicación
alter table public.menciones add column if not exists compartidos bigint;      -- compartidos o reposts
alter table public.menciones add column if not exists tipo_pub text not null default 'Original' check (tipo_pub in ('Original','Respuesta','Cita','Repost'));
alter table public.menciones add column if not exists otro_pais boolean not null default false;  -- de otro país: fuera de los ejes y los totales
alter table public.menciones add column if not exists en_tema boolean not null default true;     -- false: fila recolectada que no trata el tema
create index if not exists menciones_autor on public.menciones (autor_id);
create unique index if not exists menciones_id_externo on public.menciones (campana_id, canal, id_externo) where id_externo is not null;
-- interacciones (ya existía) = me_gusta + respuestas + compartidos cuando las partes existen; informe_datos lo suma si viene vacío.

-- ---------- mencion_ejes: en qué ejes cae cada mención y por qué ----------
-- metodo: Regla (el texto cumple la regla del eje), Búsqueda (la devolvió la búsqueda del eje, sin cumplir la regla), Manual.
-- Los rankings del Informe usan solo Regla y Manual.
create table if not exists public.mencion_ejes (
  id text primary key default public.nuevo_id(),
  campana_id text not null references public.campanas(id) on delete cascade,
  mencion_id text not null references public.menciones(id) on delete cascade,
  eje_id text not null references public.ejes(id) on delete cascade,
  metodo text not null default 'Regla' check (metodo in ('Regla','Búsqueda','Manual')),
  recoleccion_id text references public.recolecciones(id) on delete set null,
  unique (mencion_id, eje_id)
);
create index if not exists mencion_ejes_eje on public.mencion_ejes (eje_id);
create index if not exists mencion_ejes_campana on public.mencion_ejes (campana_id);

-- ---------- comentarios: sin autor (los autores de comentarios nunca se guardan) ----------
create table if not exists public.comentarios (
  id text primary key default public.nuevo_id(),
  campana_id text not null references public.campanas(id) on delete cascade,
  mencion_id text references public.menciones(id) on delete cascade,   -- publicación donde está el comentario
  canal text not null,
  publicada_en timestamptz,
  texto text,
  me_gusta bigint,
  recoleccion_id text references public.recolecciones(id) on delete set null,
  solo_emojis boolean not null default false,
  duplicado boolean not null default false,     -- repite un texto que ya está en la recolección
  extra jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now()
);
create index if not exists comentarios_campana_fecha on public.comentarios (campana_id, publicada_en);
create index if not exists comentarios_mencion on public.comentarios (mencion_id);

-- ---------- codigos: libro de códigos (temas principales) ----------
create table if not exists public.codigos (
  id text primary key default public.nuevo_id(),
  campana_id text not null references public.campanas(id) on delete cascade,
  libro text not null default 'General',
  nombre text not null,
  tono text not null default 'neutro' check (tono in ('apoyo','critica','neutro')),
  orden integer not null default 0
);
create unique index if not exists codigos_libro_nombre on public.codigos (campana_id, libro, nombre);

-- ---------- muestras: de dónde salen los ítems codificados y cómo se ponderan ----------
-- estratos: [{canal, universo}] (universo = ítems recolectados de ese canal). Con ponderacion 'por volumen',
-- el % ponderado = suma por estrato de (universo / universo total) × % del estrato.
create table if not exists public.muestras (
  id text primary key default public.nuevo_id(),
  campana_id text not null references public.campanas(id) on delete cascade,
  nombre text not null,
  objeto text not null default 'comentarios' check (objeto in ('comentarios','menciones')),
  canal text,                           -- null: varios canales (ver estratos)
  universo integer,
  tamano integer,
  semilla text,
  metodo text,
  ponderacion text not null default 'ninguna' check (ponderacion in ('ninguna','por volumen')),
  estratos jsonb not null default '[]'::jsonb,
  orden integer not null default 0,
  extra jsonb not null default '{}'::jsonb,
  creada_en timestamptz not null default now()
);
create index if not exists muestras_campana on public.muestras (campana_id);

-- ---------- codificaciones: un ítem de una muestra leído por una persona o un modelo ----------
create table if not exists public.codificaciones (
  id text primary key default public.nuevo_id(),
  campana_id text not null references public.campanas(id) on delete cascade,
  muestra_id text not null references public.muestras(id) on delete cascade,
  mencion_id text references public.menciones(id) on delete cascade,
  comentario_id text references public.comentarios(id) on delete cascade,
  sentimiento text check (sentimiento in ('Favorable','Neutral','Desfavorable')),   -- el Informe: Desfavorable = "Crítico", Neutral = "Neutral u otro"
  codigo_id text references public.codigos(id) on delete set null,
  codificado_por text not null default 'Persona' check (codificado_por in ('Persona','Modelo')),
  revisado boolean not null default false,
  creada_en timestamptz not null default now(),
  constraint codificaciones_un_item check (num_nonnulls(mencion_id, comentario_id) = 1)
);
create index if not exists codificaciones_muestra on public.codificaciones (muestra_id);
create unique index if not exists codificaciones_muestra_mencion on public.codificaciones (muestra_id, mencion_id) where mencion_id is not null;
create unique index if not exists codificaciones_muestra_comentario on public.codificaciones (muestra_id, comentario_id) where comentario_id is not null;

-- Cerradas hasta que corra 900_acceso.sql (sin políticas nadie fuera del dueño las lee).
alter table public.autores enable row level security;
alter table public.ejes enable row level security;
alter table public.recolecciones enable row level security;
alter table public.mencion_ejes enable row level security;
alter table public.comentarios enable row level security;
alter table public.codigos enable row level security;
alter table public.muestras enable row level security;
alter table public.codificaciones enable row level security;
-- reportes.tipo no tiene restricción: 'Informe' se suma al vocabulario (docs/semilla.md).
