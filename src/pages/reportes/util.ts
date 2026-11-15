// Ayudas de Reportes: destinatarios, marca, programación y fechas relativas al "hoy" de la campaña.
import { db } from '../../lib/db';
import { diaEn, diasEntre, fecha, horaEn } from '../../lib/formato';
import type { Campana, Json, Persona, Reporte, ReporteEnvio } from '../../lib/tipos';
import { DIAS_SEMANA, cargarDatos, construir, type Contenido, type SeccionCfg } from '../../lib/reportes/documento';
export { marcaDe, pieDe } from '../../lib/reportes/marca';

export const ESTADO_ENVIO: Record<string, string> = {
  Entregado: 'chip live', 'Envío parcial': 'chip warn', 'En revisión': 'chip ring', Borrador: 'chip watch', Fallido: 'chip unf', 'Pendiente de envío': 'chip ring',
};
export const COLA = 'El envío por correo todavía no está conectado: queda en cola.';


export interface Lista { id: string; nombre: string; descripcion?: string; personas?: number }
export interface Destinatario { lista?: string; persona_id?: string; email?: string; formato?: string }

export function listasDe(c: Campana): Lista[] {
  return Array.isArray(c.extra?.listas_destinatarios) ? c.extra.listas_destinatarios : [];
}
/** Personas que recibe un reporte: las de cada lista más cada persona suelta. */
export function contarDest(dest: Json[], listas: Lista[]): number {
  return (dest as Destinatario[]).reduce((n, d) => n + (d.lista ? listas.find((l) => l.id === d.lista)?.personas ?? 0 : 1), 0);
}
export function nombreDest(d: Destinatario, listas: Lista[], personas: Persona[]): { nombre: string; quien: string } {
  if (d.lista) {
    const l = listas.find((x) => x.id === d.lista);
    return { nombre: `Lista "${l?.nombre ?? d.lista}"`, quien: l?.descripcion ?? (l?.personas != null ? `${l.personas} personas` : 'Lista de la campaña') };
  }
  if (d.persona_id) {
    const p = personas.find((x) => x.id === d.persona_id);
    return { nombre: p?.nombre ?? 'Persona del equipo', quien: p?.puesto ?? 'Equipo' };
  }
  return { nombre: d.email ?? 'Sin destinatario', quien: 'Correo' };
}
/** "12 · Comando, Candidata, Cliente y Lucía G." */
export function resumenDest(dest: Json[], listas: Lista[], personas: Persona[]): string {
  if (!dest.length) return 'Sin destinatarios';
  const nombres = (dest as Destinatario[]).map((d) => (d.lista ? listas.find((l) => l.id === d.lista)?.nombre ?? d.lista : nombreDest(d, listas, personas).nombre));
  const texto = nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}` : nombres[0];
  return `${contarDest(dest, listas)} · ${texto}`;
}

// ---------- fechas ----------
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const may = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
function sumarDias(dia: string, n: number): string {
  const [y, m, d] = dia.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}
/** Desfase de la zona en esa fecha: "-04:00". */
export function desfase(zona: string, dia: string): string {
  try {
    const v = new Intl.DateTimeFormat('en-US', { timeZone: zona, timeZoneName: 'longOffset' }).formatToParts(new Date(`${dia}T12:00:00Z`)).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
    return v === 'GMT' ? '+00:00' : v.slice(3);
  } catch { return '+00:00'; }
}
export function instante(dia: string, hora: string, zona: string): string {
  return `${dia}T${hora.length === 5 ? hora + ':00' : hora}${desfase(zona, dia)}`;
}
/** Próximo envío según la programación, contado desde el "hoy" de la campaña. */
export function proximoEnvio(frecuencia: string | null, hora: string | null, dia: string | null, hoy: string, zona: string, fechaEvento?: string | null): string | null {
  const h = hora || '07:00';
  if (frecuencia === 'Diario') return instante(sumarDias(hoy, 1), h, zona);
  if (frecuencia === 'Semanal') {
    const meta = DIAS.indexOf(dia || 'lunes');
    for (let i = 1; i <= 7; i++) {
      const x = sumarDias(hoy, i);
      const [y, m, d] = x.split('-').map(Number);
      if (new Date(y, m - 1, d).getDay() === meta) return instante(x, h, zona);
    }
  }
  if (frecuencia === 'Por evento' && fechaEvento) return instante(sumarDias(fechaEvento, 3), h, zona);
  return null;
}
/** Texto de la programación: "Todos los días a las 7:00." */
export function textoProgramacion(frecuencia: string | null, hora: string | null, dia: string | null): string {
  const h = (hora || '07:00').replace(/^0(\d)/, '$1');
  switch (frecuencia) {
    case 'Diario': return `Todos los días a las ${h}.`;
    case 'Semanal': return `Todos los ${dia || 'lunes'} a las ${h}.`;
    case 'Por evento': return 'Se genera 72 horas después de cada evento propio o debate.';
    default: return 'Una sola vez, al generarlo.';
  }
}
export function descripcionDe(r: Pick<Reporte, 'frecuencia' | 'hora' | 'extra'>): string {
  return r.extra?.descripcion ?? textoProgramacion(r.frecuencia, r.hora, r.extra?.dia ?? null);
}
export { DIAS_SEMANA };

/** "hoy, 7:02" · "ayer, 18:40" · "vie 14 may, 7:00" · "15 nov 2026, 10:42". En minúscula, como cuando() en el resto de la app. */
export function momento(ts: string | null | undefined, hoy: string, zona: string): string {
  if (!ts) return '';
  const dia = diaEn(ts, zona)!;
  const h = horaEn(ts, zona);
  const dif = diasEntre(hoy, dia) ?? 0;
  if (dif === 0) return `hoy, ${h}`;
  if (dif === -1) return `ayer, ${h}`;
  const [y, m, d] = dia.split('-').map(Number);
  const corto = fecha(dia, 'corto');
  if (y !== Number(hoy.slice(0, 4))) return `${corto} ${y}, ${h}`;
  if (Math.abs(dif) < 7) return `${DIAS[new Date(y, m - 1, d).getDay()].slice(0, 3).toLowerCase()} ${corto}, ${h}`;
  return `${corto}, ${h}`;
}
/** "Se cierra hoy a las 12:00": momento en minúscula, para dentro de una frase. */
export function aLas(ts: string | null | undefined, hoy: string, zona: string): string {
  const t = momento(ts, hoy, zona);
  return t ? t.charAt(0).toLowerCase() + t.slice(1).replace(/, (\d+:\d+)$/, ' a las $1') : '';
}
/** "GMT-4" de una zona horaria. */
export function gmt(zona: string, dia: string): string {
  const d = desfase(zona, dia);
  const m = /^([+-])(\d\d):(\d\d)$/.exec(d);
  if (!m) return 'GMT';
  return `GMT${m[1]}${Number(m[2])}${m[3] !== '00' ? ':' + m[3] : ''}`;
}
/** "Mañana" · "Hoy" · "En 4 días" para un instante futuro. */
export function enDias(ts: string | null | undefined, hoy: string, zona: string): string {
  const dia = diaEn(ts, zona);
  const n = diasEntre(hoy, dia);
  if (n == null) return '';
  return n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : n > 1 ? `En ${n} días` : `Hace ${-n} días`;
}
/** Periodo cubierto por un envío: "12 may 7:00 a 13 may 7:00" o "3 a 9 may". */
export function periodoEnvio(a: string | null, b: string | null, zona: string): string {
  if (!a) return 'Sin periodo';
  const da = diaEn(a, zona)!, db = diaEn(b, zona) ?? da;
  const ha = horaEn(a, zona), hb = horaEn(b, zona);
  const enteros = (ha === '0:00') && (!b || hb === '23:59');
  if (enteros) {
    if (da === db) return fecha(da, 'corto');
    const [, ma] = da.split('-'), [, mb] = db.split('-');
    return ma === mb ? `${Number(da.slice(8))} a ${fecha(db, 'corto')}` : `${fecha(da, 'corto')} a ${fecha(db, 'corto')}`;
  }
  return `${fecha(da, 'corto')} ${ha} a ${fecha(db, 'corto')} ${hb}`;
}

/** Crea la fila "Pendiente de envío" de un reporte con una copia del documento armado con los datos de hoy. */
export async function ponerEnCola(r: Reporte, o: { campana: Campana; hoy: string; personaId: string | null; listas: Lista[]; previo: Contenido | null }) {
  const { campana, hoy } = o;
  const datos = await cargarDatos(campana, hoy, { eventoId: r.evento_id, conEvento: r.tipo === 'Post-evento' });
  const contenido = construir(datos, {
    tipo: r.tipo, nombre: r.nombre, secciones: r.secciones as SeccionCfg[], marca: r.extra?.marca,
    analisis: r.extra?.seccion_analisis && r.extra?.texto_analisis ? { id: r.extra.seccion_analisis, texto: r.extra.texto_analisis } : null, previo: o.previo,
  });
  const z = campana.zona_horaria;
  const ev = r.tipo === 'Post-evento' ? datos.evento : null;
  const ini = ev?.fecha_inicio ?? campana.periodo_inicio, fin = ev?.fecha_fin ?? ev?.fecha_inicio ?? campana.periodo_fin ?? hoy;
  return db.crear<ReporteEnvio>('reporte_envios', {
    campana_id: campana.id, reporte_id: r.id,
    titulo: `${r.nombre} · ${ev ? ev.nombre : fecha(hoy, 'corto')} · a mano`,
    periodo_inicio: ini ? instante(ini, '00:00', z) : null, periodo_fin: fin ? instante(fin, '23:59:59', z) : null,
    estado: 'Pendiente de envío', destinatarios: contarDest(r.destinatarios, o.listas), entregados: 0,
    aprobado_por: r.requiere_aprobacion ? o.personaId : null,
    contenido: contenido as Record<string, unknown>,
    extra: { nota: 'En cola, sin enviar', origen: 'manual', pedido_por: o.personaId, evento_id: ev?.id ?? undefined },
  });
}

