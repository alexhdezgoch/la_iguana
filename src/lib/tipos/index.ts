// Tipos de fila, uno por tabla o vista (ver supabase/migrations/001_base.sql y 800_vistas.sql).
// Archivo congelado: si a una pantalla le falta un campo, va en su propio archivo de tipos.
export type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export type Relacion = 'Propia' | 'Aliada' | 'Rival' | 'A observar';
export type Sentimiento = 'Favorable' | 'Neutral' | 'Desfavorable';
export type Nivel = 'Bajo' | 'Medio' | 'Alto';
export type Severidad = 'Alta' | 'Media' | 'Baja';
export type RolCampana = 'Administración' | 'Análisis' | 'Solo lectura' | 'Cliente';
type N<T> = T | null;

export interface Organizacion { id: string; nombre: string; iniciales: N<string> }
export interface Persona {
  id: string; org_id: string; nombre: string; nombre_corto: N<string>; iniciales: N<string>; email: N<string>; puesto: N<string>;
  rol_org: 'admin' | 'miembro' | 'externo'; activa: boolean; extra: Json;
}
export interface Borrador { id: string; org_id: string; persona_id: string; tipo: string; datos: Json; actualizado_en: string }

export interface Campana {
  id: string; org_id: string; nombre: string; contienda: N<string>; titulo_largo: N<string>; iniciales: N<string>; ambito: N<string>;
  pais: N<string>; territorio: N<string>; fase: string; inicio_campana: N<string>; fin_campana: N<string>; veda_inicio: N<string>;
  veda_fin: N<string>; jornada: N<string>; fecha_corte: N<string>; zona_horaria: string; periodo_inicio: N<string>; periodo_fin: N<string>;
  figura_propia_id: N<string>; vista: 'completa' | 'compacta'; es_demo: boolean; estado: string; orden: number; extra: Json;
}
/** Vista v_campanas_resumen: la campaña más las cifras de su figura propia y sus pendientes. */
export interface CampanaResumen {
  id: string; campana_id: string; org_id: string; nombre: string; contienda: N<string>; titulo_largo: N<string>; iniciales: N<string>;
  ambito: N<string>; fase: string; vista: 'completa' | 'compacta'; es_demo: boolean; orden: number;
  inicio_campana: N<string>; fin_campana: N<string>; veda_inicio: N<string>; veda_fin: N<string>; jornada: N<string>; fecha_corte: N<string>; zona_horaria: string;
  figura_propia_id: N<string>; figura_propia: N<string>;
  menciones: N<number>; participacion: N<number>; neto: N<number>; riesgo: N<number>; riesgo_nivel: N<Nivel>;
  figuras: number; alertas_abiertas: number; alertas_altas: number; menciones_por_revisar: number;
}
export interface MiembroCampana { id: string; campana_id: string; persona_id: string; rol: RolCampana }
export interface CampanaFase { id: string; campana_id: string; nombre: string; inicio: N<string>; fin: N<string>; orden: number; extra: Json }

export interface Cuenta { red: string; usuario: string; seguidores?: number | null; verificada?: boolean }
/** La persona pública, una vez por equipo. */
export interface Figura {
  id: string; org_id: string; nombre: string; iniciales: N<string>; cargo: N<string>; partido: N<string>; coalicion: N<string>;
  territorio: N<string>; tipo: N<string>; cuentas: Cuenta[]; trayectoria: N<string>; extra: Json;
}
/** Vínculo figura–campaña. */
export interface CampanaFigura {
  id: string; campana_id: string; figura_id: string; relacion: Relacion; responsable_id: N<string>; orden: number; extra: Json;
}
/** Vista v_figuras_campana: figura + relación en la campaña + corte de 30 días. Es lo que casi todas las pantallas necesitan. */
export interface FiguraCampana {
  id: string; campana_id: string; figura_id: string; relacion: Relacion; orden: number; responsable_id: N<string>; extra_campana: Json;
  org_id: string; nombre: string; iniciales: N<string>; cargo: N<string>; partido: N<string>; coalicion: N<string>; territorio: N<string>;
  tipo: N<string>; cuentas: Cuenta[]; trayectoria: N<string>; extra: Json;
  periodo: N<string>; menciones: number; participacion: N<number>; favorable: N<number>; neutral: N<number>; desfavorable: N<number>;
  neto: N<number>; alcance: N<number>; seguidores: N<number>; interaccion: N<number>; notas_medios: N<number>; riesgo: N<number>;
  riesgo_nivel: N<Nivel>; detalle: Json;
}
export interface FiguraMetricas {
  id: string; campana_id: string; figura_id: string; periodo: string; menciones: number; participacion: N<number>; favorable: N<number>;
  neutral: N<number>; desfavorable: N<number>; neto: N<number>; alcance: N<number>; seguidores: N<number>; interaccion: N<number>;
  notas_medios: N<number>; riesgo: N<number>; riesgo_nivel: N<Nivel>; detalle: Json;
}
export interface Termino { id: string; campana_id: string; figura_id: N<string>; evento_id: N<string>; texto: string; tipo: string; activo: boolean; orden: number }
export interface SerieDiaria {
  id: string; campana_id: string; entidad: 'campana' | 'figura' | 'tema' | 'narrativa' | 'evento'; entidad_id: string; fecha: string;
  menciones: number; favorable: N<number>; neutral: N<number>; desfavorable: N<number>; alcance: N<number>;
}

export interface Tema {
  id: string; campana_id: string; nombre: string; menciones: number; porcentaje: N<number>; cambio: N<number>; tendencia: N<string>;
  es_propio: boolean; orden: number; detalle: Json;
}
export interface TemaFigura { id: string; campana_id: string; tema_id: string; figura_id: string; menciones: number; porcentaje: N<number>;
  porcentaje_propias: N<number>; porcentaje_hace_7d: N<number>; porcentaje_propias_hace_7d: N<number>;
  favorable: N<number>; neutral: N<number>; desfavorable: N<number>; neto: N<number>;
}
export type Direccion = 'Favorable' | 'Desfavorable' | 'Sin dirección' | 'Posicionamiento';
export interface Narrativa {
  id: string; campana_id: string; figura_id: N<string>; tema_id: N<string>; nombre: string; direccion: Direccion; menciones: number;
  menciones_24h: N<number>; tendencia: N<string>; cambio_24h: N<number>; cambio_7d: N<number>; veces_promedio: N<number>;
  detectada_el: N<string>; alcance: N<number>; cuentas_unicas: N<number>; neto: N<number>;
  estado: string; seguida: boolean; descripcion: N<string>; resumen: N<string>; resumen_aprobado: boolean; orden: number; detalle: Json;
}

export type EstadoEvento = 'Borrador' | 'Programado' | 'En curso' | 'En análisis' | 'Cerrado' | 'Cancelado';
export interface Evento {
  id: string; campana_id: string; nombre: string; tipo: string; es_crisis: boolean; origen: 'Propio' | 'De rival' | 'Institucional';
  estado: EstadoEvento; fecha_inicio: N<string>; fecha_fin: N<string>; hora: N<string>; sede: N<string>; ciudad: N<string>;
  objetivos: N<string>; narrativa_id: N<string>; hashtags: string[]; ventana_horas: number; asistencia: N<number>; responsable_id: N<string>;
  nota_estado: N<string>; menciones: N<number>; menciones_antes: N<number>; menciones_durante: N<number>; menciones_despues: N<number>;
  alcance: N<number>; neto: N<number>; neto_antes: N<number>; notas_medios: N<number>; veredicto: N<string>; resultados: Json;
  aprendizajes: N<string>; extra: Json;
}
export interface EventoParticipante {
  id: string; campana_id: string; evento_id: string; figura_id: string; rol: string; menciones: N<number>; participacion: N<number>;
  favorable: N<number>; neutral: N<number>; desfavorable: N<number>; neto: N<number>; orden: number; extra: Json;
}
export interface EventoMensaje {
  id: string; campana_id: string; evento_id: string; texto: string; terminos: string[]; menciones: N<number>; porcentaje: N<number>;
  estado: N<string>; orden: number;
}

export interface Mencion {
  id: string; campana_id: string; canal: string; fuente: N<string>; fuente_tipo: N<string>; titulo: N<string>; resumen: N<string>;
  url: N<string>; publicada_en: N<string>; figura_id: N<string>; tema_id: N<string>; narrativa_id: N<string>; evento_id: N<string>;
  sentimiento: N<Sentimiento>; sentimiento_manual: N<Sentimiento>; importancia: N<'alto' | 'medio' | 'bajo'>; alcance: N<number>;
  interacciones: N<number>; requiere_revision: boolean; revisada: boolean; revisada_por: N<string>; revisada_en: N<string>;
  estado: 'Por procesar' | 'Procesada' | 'Descartada'; origen: 'Ingesta' | 'Manual'; extra: Json;
}
export interface MencionFigura {
  id: string; campana_id: string; mencion_id: string; figura_id: string; sentimiento: N<Sentimiento>; sentimiento_manual: N<Sentimiento>;
}

export interface ReglaAlerta {
  id: string; campana_id: string; nombre: string; tipo: N<string>; descripcion: N<string>; condicion: Json; severidad: string;
  canales: string[]; destinatarios: Json[]; activa: boolean; narrativa_id: N<string>; figura_id: N<string>;
  disparos_30d: number; ultimo_disparo: N<string>; orden: number; extra: Json;
}
export type EstadoAlerta = 'Nueva' | 'En revisión' | 'Pospuesta' | 'Resuelta' | 'Descartada';
/** Abiertas = las que siguen en la bandeja. */
export const ALERTAS_ABIERTAS: EstadoAlerta[] = ['Nueva', 'En revisión', 'Pospuesta'];
export interface Alerta {
  id: string; campana_id: string; regla_id: N<string>; severidad: Severidad; estado: EstadoAlerta; texto: string; tipo: N<string>;
  explicacion: N<string>; valor: N<string>; umbral: N<string>; ventana: N<string>; disparos: number; figura_id: N<string>;
  narrativa_id: N<string>; tema_id: N<string>; evento_id: N<string>; responsable_id: N<string>; detectada_en: string;
  pospuesta_hasta: N<string>; resuelta_en: N<string>; motivo_cierre: N<string>; detalle: Json; orden: number;
}
export interface AlertaActividad { id: string; campana_id: string; alerta_id: string; persona_id: N<string>; texto: string; creada_en: string }

export interface ReportePlantilla {
  id: string; campana_id: string; nombre: string; etiqueta: N<string>; descripcion: N<string>; tipo: string; secciones: Json[];
  marca: 'Consultora' | 'Cliente'; usos: number; orden: number; extra: Json; creada_en: string;
}
export interface Reporte {
  id: string; campana_id: string; nombre: string; tipo: string; frecuencia: N<string>; hora: N<string>; destinatarios: Json[];
  secciones: Json[]; formato: N<string>; evento_id: N<string>; plantilla_id: N<string>; estado: string; requiere_aprobacion: boolean; ultimo_envio: N<string>;
  proximo_envio: N<string>; orden: number; extra: Json;
}
export interface ReporteEnvio {
  id: string; campana_id: string; reporte_id: string; titulo: N<string>; periodo_inicio: N<string>; periodo_fin: N<string>; generado_en: string; enviado_en: N<string>; estado: string;
  destinatarios: N<number>; entregados: N<number>; aprobado_por: N<string>; contenido: Json; extra: Json;
}
export interface NotaInterna {
  id: string; campana_id: string; entidad: 'campana' | 'figura' | 'evento' | 'mencion' | 'narrativa' | 'alerta'; entidad_id: string;
  texto: string; autor_id: N<string>; creada_en: string; actualizada_en: string;
}
