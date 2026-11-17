// Datos, configuración por defecto y ediciones congeladas del Informe.
// Una edición guarda en reporte_envios.contenido el JSON de informe_datos y los textos tal como salieron, así el
// documento enviado no cambia aunque cambien los datos. Queda 'Pendiente de envío': el correo es de la fase 2.
import { db } from '../db';
import type { Campana, Evento, Reporte, ReporteEnvio } from '../tipos';
import { seccionesDe, textosDe } from './Informe';
import type { InformeConfig, InformeDatos } from './tipos';

export interface ContenidoInforme { tipo_doc: 'Informe'; titulo: string; datos: InformeDatos; textos: Record<string, string> }
const esObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
/** El contenido dice ser una edición de Informe (tipo_doc 'Informe'), se pueda mostrar o no. */
export function esDocInforme(c: unknown): boolean {
  return esObj(c) && c.tipo_doc === 'Informe';
}
/** Edición de Informe que este código sabe mostrar: datos con version 1 y las claves que el documento necesita. */
export function esEdicionInforme(c: unknown): c is ContenidoInforme {
  if (!esDocInforme(c)) return false;
  const { datos: d, textos } = c as { datos?: unknown; textos?: unknown };
  if (!esObj(d) || d.version !== 1) return false;
  if (textos != null && !esObj(textos)) return false;
  return esObj(d.campana) && esObj(d.portada) && Array.isArray(d.dias) && esObj(d.series) && Array.isArray(d.canales)
    && (d.secciones == null || Array.isArray(d.secciones));
}
/** Texto del estado cuando una edición guardada no se puede mostrar (versión desconocida o datos incompletos). */
export const EDICION_ILEGIBLE = 'Esta edición no se puede mostrar';

export const cargarInforme = (reporteId: string) => db.rpc<InformeDatos | null>('informe_datos', { p_reporte_id: reporteId });

function sumar(dia: string, n: number): string {
  const [y, m, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
/** Configuración de un informe nuevo: modo tema, los últimos 7 días hasta "hoy" de la campaña, todos los ejes y muestras. */
export function configPorDefecto(hoy: string): InformeConfig {
  return { modo: 'tema', periodo_inicio: sumar(hoy, -6), periodo_fin: hoy, ejes: [], muestras: [] };
}
/** Modo evento para un evento: día base = el anterior, periodo del día base al día siguiente del evento. */
export function configEvento(cfg: InformeConfig, ev: Evento): InformeConfig {
  const dia = ev.fecha_inicio?.slice(0, 10);
  if (!dia) return { ...cfg, modo: 'evento', evento_id: ev.id };
  return { ...cfg, modo: 'evento', evento_id: ev.id, dia_evento: dia, dia_base: sumar(dia, -1), periodo_inicio: sumar(dia, -1), periodo_fin: sumar(dia, 1) };
}

export async function crearInforme(o: { campana: Campana; hoy: string; orden: number; nombre?: string }): Promise<Reporte> {
  return db.crear<Reporte>('reportes', {
    campana_id: o.campana.id, nombre: o.nombre ?? 'Informe de conversación', tipo: 'Informe', frecuencia: 'Una vez', hora: null,
    destinatarios: [], secciones: [], formato: 'PDF', estado: 'Activo', requiere_aprobacion: true, orden: o.orden,
    extra: { informe: configPorDefecto(o.hoy), descripcion: 'Informe a pedido: se arma con los datos crudos del periodo.' },
  });
}

/** Congela una edición: vuelve a pedir los datos, resuelve los textos y crea la fila 'Pendiente de envío'. */
export async function generarEdicion(o: { reporte: Reporte; personaId: string | null; destinatarios?: number }): Promise<ReporteEnvio> {
  const datos = await cargarInforme(o.reporte.id);
  if (!datos) throw new Error('No se pudieron leer los datos del informe.');
  const activas = seccionesDe(datos);
  const contenido: ContenidoInforme = { tipo_doc: 'Informe', titulo: datos.portada.titulo, datos: { ...datos, secciones: activas }, textos: textosDe(datos) };
  return db.crear<ReporteEnvio>('reporte_envios', {
    campana_id: o.reporte.campana_id, reporte_id: o.reporte.id,
    titulo: `${datos.portada.titulo} · edición`,
    periodo_inicio: datos.periodo.inicio, periodo_fin: datos.periodo.fin,
    estado: 'Pendiente de envío', destinatarios: o.destinatarios ?? 0, entregados: 0,
    // Igual que ponerEnCola (src/pages/reportes/util.ts): si el reporte requiere aprobación, quien la genera la aprueba.
    aprobado_por: o.reporte.requiere_aprobacion ? o.personaId : null,
    contenido: contenido as unknown as ReporteEnvio['contenido'],
    extra: { nota: 'Edición congelada. En cola, sin enviar: el envío por correo todavía no está conectado.', origen: 'manual', pedido_por: o.personaId, tipo_doc: 'Informe' },
  });
}
