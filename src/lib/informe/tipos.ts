// Contrato del Informe: la forma exacta del JSON que devuelve public.informe_datos(p_reporte_id)
// (supabase/migrations/860_informe.sql) y de la configuración que lee de reportes.extra.informe.
// El renderer, la edición congelada (reporte_envios.contenido.datos) y los generadores de semilla usan estos tipos.
// Si cambias la función, cambia este archivo en el mismo cambio.
//
// Convenciones:
//   * Instantes: ISO 8601 con desplazamiento, tal como los serializa Postgres ("2027-05-11T13:40:00+00:00").
//     Para mostrarlos usa `zona` (Intl.DateTimeFormat con timeZone). Fechas de día: 'AAAA-MM-DD' en la zona.
//   * Series por día: arreglos alineados con `dias` (posición i ↔ dias[i]). Series por hora: 24 posiciones (0–23, hora local).
//   * `por_canal` es un objeto por canal; el orden para mostrar lo da `canales` (o `canales_comentarios`), nunca las claves.
//   * Porcentajes: números de 0 a 100 con un decimal (31.4), o null cuando no hay base. Se redondean al mostrar (formato.ts).
//   * Canales: el vocabulario de menciones.canal. 'Medio digital' se rotula "Noticias" en el Informe.
//   * "En el tema": en_tema = true y otro_pais = false. Conversación, foco, comparación y ejes cuentan solo filas en el tema.
//   * Regla de publicación (aplicada en SQL): el usuario de una cuenta solo sale si seguidores >= 100.000 o es una organización.
//     Si no, la cuenta es "Cuenta personal" (visible = false) sin autor_id, usuario, nombre ni enlaces, y la publicación sale sin url.
//   * Sentimiento: Favorable, Neutral ("Neutral u otro" en el Informe), Desfavorable ("Crítico" en el Informe).

/** Canal de una publicación o comentario (vocabulario de menciones.canal). */
export type Canal = 'X' | 'Facebook' | 'TikTok' | 'Instagram' | 'Medio digital' | 'YouTube' | 'Radio' | 'Televisión' | (string & {});
type N<T> = T | null;
/** Instante ISO con desplazamiento. */
export type Instante = string;
/** Fecha 'AAAA-MM-DD' en la zona del informe. */
export type Fecha = string;

// ====================================================================
// Configuración: reportes.extra.informe (la escribe la pantalla del Informe)
// ====================================================================

export type ModoInforme = 'evento' | 'tema';
/** agrupar: las cuentas personales quedan como filas "Cuenta personal". omitir: se quitan y se devuelve cuántas salieron. */
export type ModoEnmascarar = 'agrupar' | 'omitir';
export type AmbitoRankings = 'foco' | 'conversacion' | 'ejes';

export interface InformeConfig {
  modo?: ModoInforme;                       // por defecto 'evento'
  /** Inicio del periodo: instante con desplazamiento ("2027-05-10T00:00:00-04:00") o fecha sola (00:00 en la zona). */
  periodo_inicio?: string;
  /** Fin del periodo, excluido: instante, o fecha sola (= hasta el final de ese día). Máximo 93 días. */
  periodo_fin?: string;
  /** Zona horaria; si falta o no es válida se usa campanas.zona_horaria. */
  zona?: string;
  /** Modo evento: día base (antes del evento). */
  dia_base?: Fecha;
  /** Modo evento: día del evento. Si falta: fecha de ventana_evento.inicio, del evento, o dia_base + 1. */
  dia_evento?: Fecha;
  evento_id?: string;
  ventana_evento?: { inicio: Instante; fin: Instante; estimada?: boolean };
  /** Eje "sobre la figura o el evento" (conversación). Si falta, se usa eje_foco. */
  eje_conversacion?: string;
  /** Eje "sobre el evento" (foco). */
  eje_foco?: string;
  /** Ejes del tema (sección Ejes). Modo tema sin ejes: todos los de la campaña, por orden. */
  ejes?: string[];
  comparacion?: { eje_id: string; etiqueta?: string };
  /** Muestras a mostrar, en orden. Vacío: todas las de la campaña. */
  muestras?: string[];
  /** Libro de códigos a listar en `codigos`. Vacío: todos. */
  libro?: string;
  /** Solo estos canales (y en este orden). Vacío: los que tienen filas en el periodo, en orden fijo. */
  canales?: Canal[];
  /** Ámbito de rankings, titulares, cuentas de medios y concentración de comentarios. Por defecto: foco (evento) o ejes (tema). */
  ambito_rankings?: AmbitoRankings;
  limites?: { publicaciones?: number; cuentas?: number; titulares?: number; medios?: number; comentarios?: number };
  enmascarar?: { top_publicaciones?: ModoEnmascarar; top_cuentas?: ModoEnmascarar; destacadas?: ModoEnmascarar };
  /** Publicaciones elegidas por quien analiza. grupo 'propias' = fila de la tabla de cuentas propias, con resumen como "Qué es". */
  destacadas?: { mencion_id: string; eje_id?: string; resumen?: string; etiqueta?: string; grupo?: 'destacadas' | 'propias' | (string & {}) }[];
  /** Autores cuyas publicaciones forman la tabla de cuentas propias (la emisora, el medio anfitrión…). */
  cuentas_propias?: string[];
  // Portada
  titulo?: string;
  subtitulo?: string;
  nota_portada?: string;
  nota_version?: string;
  fecha_informe?: Fecha;
  /** Secciones: activa y texto del analista. La función las devuelve tal cual. */
  secciones?: SeccionConfig[];
}
export type SeccionId = 'resumen' | 'volumen' | 'alcance' | 'reparto' | 'ejes' | 'sentimiento' | 'publicaciones' | 'medios' | 'comparacion' | 'metodologia' | (string & {});
export interface SeccionConfig { id: SeccionId; activa: boolean; texto?: string; titulo?: string }

// ====================================================================
// Piezas comunes
// ====================================================================

/** Serie por canal. Largo de cada arreglo = dias.length (por día) o 24 (por hora). */
export interface SerieCanal {
  por_canal: Record<string, number[]>;
  total: number[];
}

/** Cuenta tal como se puede publicar. */
export interface CuentaVisible {
  /** null si la cuenta está enmascarada o si es una noticia sin autor. */
  autor_id: N<string>;
  /** false = "Cuenta personal": todo lo demás viene vacío. */
  visible: boolean;
  /** Lo que se muestra: el usuario ('@medio_digital_4'), el nombre, la fuente de la noticia o "Cuenta personal". */
  etiqueta: string;
  handle: N<string>;
  nombre: N<string>;
  /** autores.tipo; 'Medio' para noticias sin autor; null si está enmascarada. */
  tipo: N<string>;
  descriptor: N<string>;
  seguidores: N<number>;
  es_organizacion: boolean;
  /** Cuenta oficial de una figura en seguimiento (autores.figura_id). */
  figura: boolean;
  url: N<string>;
}

/** Una publicación con sus métricas (las cifras son las del momento de la recolección; null = la plataforma no la informa). */
export interface PublicacionInforme {
  mencion_id: string;
  canal: Canal;
  publicada_en: N<Instante>;
  fuente: N<string>;
  titulo: N<string>;
  /** Hasta 280 caracteres de menciones.texto (o resumen). */
  texto: N<string>;
  /** null si la cuenta está enmascarada. */
  url: N<string>;
  formato: N<'Texto' | 'Foto' | 'Video' | 'Reel' | 'Artículo' | 'En vivo'>;
  tipo_pub: 'Original' | 'Respuesta' | 'Cita' | 'Repost';
  vistas: N<number>;
  me_gusta: N<number>;
  respuestas: N<number>;
  compartidos: N<number>;
  /** interacciones guardadas, o me_gusta + respuestas + compartidos si alguna existe; null si ninguna. */
  interaccion: N<number>;
  cuenta: CuentaVisible;
}

/** Métricas sumadas de una cuenta dentro de un ranking o lista. */
export interface CuentaConMetricas extends CuentaVisible {
  publicaciones: number;
  vistas: number;
  me_gusta: number;
  respuestas: number;
  compartidos: number;
  interaccion: number;
  /** Primera publicación de la cuenta en el ámbito. */
  primera: Instante;
}

export interface ConteoPct { n: number; pct: N<number> }
export interface SentimientoConteo { favorable: ConteoPct; neutral: ConteoPct; desfavorable: ConteoPct }

// ====================================================================
// Bloques
// ====================================================================

export interface DiaInforme {
  fecha: Fecha;
  es_base: boolean;
  es_evento: boolean;
  /** Primer día empezado después de las 00:00, o último día cortado antes de las 24:00. */
  parcial: boolean;
  /** 'HH:MM' si el primer día empieza después de las 00:00. */
  desde: N<string>;
  /** 'HH:MM' si el último día termina antes (fin excluido): "jue 12 (hasta 11:00)". */
  hasta: N<string>;
}

export interface PeriodoInforme {
  inicio: Instante;
  /** Fin excluido. */
  fin: Instante;
  /** 'AAAA-MM-DDTHH:MM' en la zona. */
  inicio_local: string;
  fin_local: string;
  dia_base: N<Fecha>;
  /** Día del evento (modo evento); null en modo tema. */
  dia_evento: N<Fecha>;
  ventana_evento: N<{ inicio: Instante; fin: N<Instante>; hora_inicio: string; hora_fin: N<string>; estimada: boolean }>;
}

/**
 * Series por canal y día. Nombres de métrica:
 *   filas                     todo lo recolectado del periodo (incluye otro país y fuera de tema) — "Filas recolectadas"
 *   conversacion              en el tema con el eje de conversación
 *   foco                      en el tema con el eje foco
 *   comparacion               conversación que además tiene el eje de comparación ("nombra a la emisora")
 *   otro_pais                 marcadas de otro país (aparte)
 *   sin_duplicados            en el tema con al menos uno de config.ejes ("Total sin duplicados")
 *   sin_eje                   filas − otro_pais − sin_duplicados ("Sin grupo")
 *   solo_busqueda             en el ámbito solo por Búsqueda: fuera de los rankings
 *   vistas_*                  suma de vistas de esas filas (0 si no hay)
 *   interaccion_*             suma de interacción de esas filas
 *   comentarios               comentarios por día del comentario (por_canal con `canales_comentarios`)
 */
export type MetricaSerie =
  | 'filas' | 'conversacion' | 'foco' | 'comparacion' | 'otro_pais' | 'sin_duplicados' | 'sin_eje' | 'solo_busqueda'
  | 'vistas_filas' | 'vistas_conversacion' | 'vistas_foco' | 'vistas_comparacion' | 'vistas_solo_busqueda'
  | 'interaccion_conversacion' | 'interaccion_foco' | 'comentarios';
export type SeriesInforme = Record<MetricaSerie, SerieCanal>;

export interface PicoHora { hora: number; n: number; /** n ÷ promedio horario de la conversación del día base; null sin base. */ veces_base: N<number> }
export interface PorHoraInforme {
  dia: Fecha;
  conversacion: SerieCanal;
  foco: SerieCanal;
  /** Promedio horario de la conversación del día base (n del día ÷ 24, un decimal). null sin dia_base. */
  promedio_base: N<{ por_canal: Record<string, number>; total: number; n_por_canal: Record<string, number>; n_total: number }>;
  /** Hora con más publicaciones de conversación el día del evento (empate: la más temprana). total: null si no hay filas. */
  pico: { por_canal: Record<string, PicoHora>; total: N<PicoHora> };
  pico_foco: { por_canal: Record<string, PicoHora>; total: N<PicoHora> };
}

export interface FilaDesglose {
  canal: Canal;
  publicaciones: number;
  /** Publicaciones que informan vistas / interacción. 0 = "sin datos" (noticias). */
  con_vistas: number;
  con_interaccion: number;
  vistas: number;
  me_gusta: number;
  respuestas: number;
  compartidos: number;
  interaccion: number;
  pct_publicaciones: N<number>;
  /** null si el canal no informa vistas (con_vistas = 0). */
  pct_vistas: N<number>;
  pct_interaccion: N<number>;
}
export interface Desglose {
  /** Una fila por canal, en el orden de `canales`. */
  filas: FilaDesglose[];
  total: Omit<FilaDesglose, 'canal' | 'pct_publicaciones' | 'pct_vistas' | 'pct_interaccion'>;
}

export interface EjeDefinicion { id: string; nombre: string; regla: N<string>; terminos: unknown[]; color: N<string>; orden: number }
export interface EjeCanal {
  por_dia: number[];
  total: number;
  /** La recolección de ese eje, canal y día llegó al tope (el conteo es un mínimo). */
  tope: boolean[];
  /** Estimado del día completo cuando hubo tope (recolecciones.estimado); null si no. */
  estimado: N<number>[];
}
export interface EjeInforme {
  eje_id: string;
  nombre: string;
  /** Suma de canales (un ítem puede estar en varios ejes). */
  total: number;
  por_canal: Record<string, EjeCanal>;
}

export interface RankingPublicaciones {
  por_vistas: PublicacionInforme[];
  por_interaccion: PublicacionInforme[];
  /** Con modo 'omitir': cuentas personales que estaban entre las N primeras y se quitaron. 0 con 'agrupar'. */
  omitidas: { por_vistas: number; por_interaccion: number };
}
export interface RankingCuentas {
  por_vistas: CuentaConMetricas[];
  por_interaccion: CuentaConMetricas[];
  por_publicaciones: CuentaConMetricas[];
  por_me_gusta: CuentaConMetricas[];
  /** Por comentarios o respuestas que muestran sus publicaciones. */
  por_respuestas: CuentaConMetricas[];
  /** Cuentas distintas en el ámbito de ese canal. */
  cuentas: number;
  omitidas: { por_vistas: number; por_interaccion: number; por_publicaciones: number; por_me_gusta: number; por_respuestas: number };
}

export interface Titular { mencion_id: string; fuente: N<string>; titulo: N<string>; publicada_en: N<Instante>; url: N<string> }
export interface CuentaMedio extends CuentaVisible {
  publicaciones: number;
  primera: Instante;
  vistas: number;
  con_vistas: number;
  me_gusta: number;
  interaccion: number;
}

export interface ComentariosCanal {
  comentarios: number;
  /** Publicaciones distintas con comentarios. */
  publicaciones: number;
  /** En publicaciones del ámbito (foco en modo evento, ejes en modo tema) que tratan el tema. */
  en_ambito: number;
  /** En publicaciones de cuentas propias (config.cuentas_propias) o cuentas oficiales de figuras. */
  de_cuentas_propias: number;
  duplicados: number;
  solo_emojis: number;
  pct_en_ambito: N<number>;
  pct_de_cuentas_propias: N<number>;
  /** Publicaciones con más comentarios recolectados (limites.comentarios, 3 por defecto). */
  top: (PublicacionInforme & { comentarios: number; pct: N<number> })[];
}

export interface EstratoMuestra extends SentimientoConteo {
  canal: Canal;
  /** muestras.estratos[].universo; null si el canal no está en estratos. */
  universo: N<number>;
  n: number;
  margen_max: N<number>;
  /** Peso en el ponderado (universo / universo de los estratos con ítems); null si la muestra no pondera. */
  peso: N<number>;
}
export interface TemaMuestra {
  codigo_id: string;
  n: number;
  /** % de la muestra. */
  pct: N<number>;
  /** % ponderado por volumen (= pct si la muestra no pondera). */
  pct_ponderado: N<number>;
  /** Conteo y % dentro de cada canal de la muestra. */
  por_estrato: Record<string, ConteoPct>;
}
export interface MuestraInforme {
  id: string;
  nombre: string;
  objeto: 'comentarios' | 'menciones';
  canal: N<Canal>;
  universo: N<number>;
  tamano: N<number>;
  semilla: N<string>;
  metodo: N<string>;
  ponderacion: 'ninguna' | 'por volumen';
  extra: Record<string, unknown>;
  /** Ítems codificados. */
  n: number;
  con_sentimiento: number;
  /** ± puntos: round(1.96 · √(0.25 / n) · 100). null si n = 0. */
  margen_max: N<number>;
  sentimiento: SentimientoConteo;
  /** Solo con ponderacion 'por volumen' y estratos: Σ (universo_s / Σ universo) × % del estrato. Sin margen. */
  ponderado: N<{ favorable: number; neutral: number; desfavorable: number; universo: number }>;
  /** Un estrato por canal: primero los de muestras.estratos, en su orden. */
  estratos: EstratoMuestra[];
  /** Temas principales (codigo_id → `codigos`), de más a menos frecuente. */
  temas: TemaMuestra[];
  /** Ítems sin código asignado. */
  sin_codigo: number;
}
export interface CodigoInforme { id: string; libro: string; nombre: string; tono: 'apoyo' | 'critica' | 'neutro'; orden: number }

/** Fila de recolecciones (sin campana_id) más el nombre del eje. Lo que se muestra en Metodología. */
export interface RecoleccionInforme {
  id: string;
  canal: Canal;
  metodo: 'Búsqueda avanzada' | 'Cuentas' | 'Etiquetas' | 'RSS' | 'Búsqueda por palabras' | 'Páginas';
  descripcion: N<string>;
  consulta: N<string>;
  eje_id: N<string>;
  eje_nombre: N<string>;
  dia: N<Fecha>;
  periodo_inicio: N<Instante>;
  periodo_fin: N<Instante>;
  cubre_desde: N<Instante>;
  ejecutada_en: N<Instante>;
  filas: N<number>;
  tope: N<number>;
  llego_al_tope: boolean;
  estimado: N<number>;
  pedidas: N<number>;
  leidas: N<number>;
  faltantes: { cuenta: string; motivo?: string; desde?: Instante }[];
  limites: string[];
  extra: Record<string, unknown>;
}

export interface Destacada extends PublicacionInforme {
  eje_id: N<string>;
  resumen: N<string>;
  etiqueta: N<string>;
  /** 'destacadas' por defecto; 'propias' son las filas "Qué es" de la tabla de cuentas propias. */
  grupo: string;
}

// ====================================================================
// El JSON completo
// ====================================================================

export interface InformeDatos {
  version: 1;
  generado_en: Instante;
  reporte: { id: string; nombre: string; tipo: string; campana_id: string; evento_id: N<string> };
  /** es_demo: cada página lleva el aviso de escenario hipotético. */
  campana: { id: string; nombre: string; nombre_corto: N<string>; titulo_largo: N<string>; es_demo: boolean; zona_horaria: string };
  /** reportes.extra.informe tal como está guardado. */
  config: InformeConfig;
  /** titulo: config.titulo o el nombre del reporte. fecha_informe: config, fecha de corte de la campaña o hoy. */
  portada: { titulo: string; subtitulo: N<string>; nota_portada: N<string>; nota_version: N<string>; fecha_informe: Fecha };
  secciones: SeccionConfig[];
  modo: ModoInforme;
  /** Zona usada para días y horas. */
  zona: string;
  periodo: PeriodoInforme;
  dias: DiaInforme[];
  /** Canales con filas en el periodo (o config.canales), en orden: Medio digital, X, Instagram, TikTok, YouTube, Facebook, Radio, Televisión. */
  canales: Canal[];
  /** Canales con comentarios en el periodo, mismo orden. */
  canales_comentarios: Canal[];
  /** Ejes que la función usó de verdad (los de config que existen en la campaña). */
  ejes_usados: {
    conversacion: N<string>; foco: N<string>; comparacion: N<string>; ejes: string[];
    ambito_rankings: AmbitoRankings; ambito_ejes: string[];
  };
  series: SeriesInforme;
  /** Día del evento hora por hora. null en modo tema o sin día de evento. */
  por_hora: N<PorHoraInforme>;
  /** Reparto por plataforma: publicaciones, vistas e interacción con sus porcentajes. */
  desglose: { conversacion: Desglose; foco: Desglose };
  /** Cuentas distintas que publicaron (todas las filas del periodo). */
  cuentas_distintas: { por_canal: Record<string, number>; total: number };
  ejes: { definiciones: EjeDefinicion[]; lista: EjeInforme[] };
  comparacion: N<{ eje_id: string; nombre: string; etiqueta: N<string> }>;
  /** Rankings por canal (solo canales con filas en el ámbito). Solo filas del ámbito con método Regla o Manual. */
  rankings: {
    ambito: AmbitoRankings;
    modo_publicaciones: ModoEnmascarar;
    modo_cuentas: ModoEnmascarar;
    limite_publicaciones: number;
    limite_cuentas: number;
    publicaciones: Record<string, RankingPublicaciones>;
    cuentas: Record<string, RankingCuentas>;
  };
  medios: {
    /** Noticias del ámbito en orden de hora (hasta limites.titulares). */
    titulares: Titular[];
    total_titulares: number;
    /** Medios con más artículos del ámbito (hasta limites.medios). */
    por_fuente: { fuente: string; articulos: number }[];
    /** Cuentas de tipo Medio con publicaciones del ámbito, por canal, en orden de primera publicación. */
    cuentas: Record<string, CuentaMedio[]>;
  };
  comentarios: {
    por_canal: Record<string, ComentariosCanal>;
    total: Omit<ComentariosCanal, 'pct_en_ambito' | 'pct_de_cuentas_propias' | 'top'>;
  };
  codigos: CodigoInforme[];
  muestras: MuestraInforme[];
  recolecciones: RecoleccionInforme[];
  destacadas: { lista: Destacada[]; omitidas: number; modo: ModoEnmascarar };
  cuentas_propias: {
    autores: CuentaVisible[];
    /** Publicaciones de esas cuentas en el ámbito (o elegidas como 'propias'), por canal y hora. */
    publicaciones: (PublicacionInforme & { que_es: N<string> })[];
    /** Todo lo que publicaron esas cuentas en el periodo, por canal. */
    por_canal: { canal: Canal; publicaciones: number; vistas: number; en_ambito: number }[];
  };
}

/** Rótulo de un canal en el Informe. */
export const ROTULO_CANAL: Record<string, string> = { 'Medio digital': 'Noticias' };
export const rotuloCanal = (c: string): string => ROTULO_CANAL[c] ?? c;
