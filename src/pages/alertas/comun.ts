// Constantes y ayudas de la pantalla Alertas. Todo lo que aquí hay es texto fijo de la interfaz
// (catálogos de opciones, clases de chip); ningún dato de campaña.
import { cuando, diaEn, diasEntre, horaEn } from '../../lib/formato';
import { hoyDe } from '../../shell/Campana';
import type { Alerta, AlertaActividad, Campana, EstadoAlerta, Persona } from '../../lib/tipos';

export const CLASE_ESTADO: Record<EstadoAlerta, string> = {
  Nueva: 'chip live', 'En revisión': 'chip fav', Pospuesta: 'chip warn', Resuelta: 'chip ring', Descartada: 'chip watch',
};
export const CLASE_REL: Record<string, string> = { Propia: 'chip own', Aliada: 'chip ally', Rival: 'chip rival', 'A observar': 'chip watch' };
export const CLASE_TONO: Record<string, string> = { Favorable: 'chip fav', Neutral: 'chip watch', Desfavorable: 'chip unf' };
const PESO_SEV: Record<string, number> = { Alta: 0, Media: 1, Baja: 2 };

export type Filtro = 'Abiertas' | 'Nuevas' | 'En revisión' | 'Pospuestas' | 'Cerradas';
export const FILTROS: Filtro[] = ['Abiertas', 'Nuevas', 'En revisión', 'Pospuestas', 'Cerradas'];
export const CUMPLE: Record<Filtro, (a: Alerta) => boolean> = {
  Abiertas: (a) => a.estado === 'Nueva' || a.estado === 'En revisión' || a.estado === 'Pospuesta',
  Nuevas: (a) => a.estado === 'Nueva',
  'En revisión': (a) => a.estado === 'En revisión',
  Pospuestas: (a) => a.estado === 'Pospuesta',
  Cerradas: (a) => a.estado === 'Resuelta' || a.estado === 'Descartada',
};
export const MOTIVOS_DESCARTE = ['Falso positivo', 'Ya atendida', 'No relevante'];

/** Severidad (Alta, Media, Baja) y luego la más reciente primero. */
export function ordenarAlertas(l: Alerta[]): Alerta[] {
  return [...l].sort((a, b) => (PESO_SEV[a.severidad] ?? 9) - (PESO_SEV[b.severidad] ?? 9) || Date.parse(b.detectada_en) - Date.parse(a.detectada_en) || a.orden - b.orden);
}

export function plural(n: number, uno: string, varios: string) { return `${n} ${n === 1 ? uno : varios}`; }
export function nombreDe(p: Persona | undefined | null): string { return p ? p.nombre : ''; }
export function inicialesDe(p: Persona | undefined | null): string {
  if (!p) return '–';
  if (p.iniciales) return p.iniciales;
  return p.nombre.split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
}

// ---------- reloj de la campaña ----------
// Las campañas de ejemplo viven en su fecha de corte (hoyDe). Las acciones se fechan en ese día, con la hora
// real del reloj en la zona de la campaña, para que la actividad quede en orden con la que ya existe.
// En una campaña sin fecha de corte esto es exactamente "ahora".
export function zonaDe(c: Campana): string { return c.zona_horaria || 'America/Caracas'; }

function desfase(zona: string, d: Date): string {
  try {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: zona, timeZoneName: 'longOffset' }).formatToParts(d).find((x) => x.type === 'timeZoneName')?.value ?? '';
    const m = /GMT([+-]\d{2}:\d{2})/.exec(p);
    return m ? m[1] : '+00:00';
  } catch { return '-04:00'; }
}
function sumarDias(dia: string, n: number): string {
  const [y, m, d] = dia.split('-').map(Number);
  const f = new Date(Date.UTC(y, m - 1, d + n));
  return f.toISOString().slice(0, 10);
}
/** Instante actual en el reloj de la campaña, ISO con desfase. */
export function ahoraEn(c: Campana): string {
  const zona = zonaDe(c);
  const real = new Date();
  const dia = c.fecha_corte ? hoyDe(c) : (diaEn(real, zona) ?? hoyDe(c));
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: zona, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(real);
  const hms = f.replace(/^24/, '00');
  return `${dia}T${hms}${desfase(zona, real)}`;
}
export function masHoras(iso: string, h: number): string { return new Date(Date.parse(iso) + h * 3_600_000).toISOString(); }
/** Día `dias` después de hoy, a las 7:00 en la zona de la campaña. */
export function alas7(c: Campana, dias: number): string {
  return `${sumarDias(hoyDe(c), dias)}T07:00:00${desfase(zonaDe(c), new Date())}`;
}
/** Días hasta el próximo lunes (1 a 7). */
export function diasAlLunes(c: Campana): number {
  const [y, m, d] = hoyDe(c).split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return ((8 - dow) % 7) || 7;
}
/** "hoy, 7:12"; si la hora es 0:00, solo el día ("hoy", "6 may"). */
export function momento(ts: string | null | undefined, c: Campana): string {
  if (!ts) return '';
  const t = cuando(ts, hoyDe(c), zonaDe(c));
  return horaEn(ts, zonaDe(c)) === '0:00' ? t.replace(/, 0:00$/, '') : t;
}
export function vencida(a: Alerta, c: Campana): boolean {
  return a.estado === 'Pospuesta' && !!a.pospuesta_hasta && Date.parse(a.pospuesta_hasta) <= Date.parse(ahoraEn(c));
}
export function diasDesde(c: Campana, ts: string): number | null { return diasEntre(diaEn(ts, zonaDe(c)), hoyDe(c)); }

/** Texto de la actividad con el nombre de quien la hizo al inicio. */
export function textoActividad(l: AlertaActividad, personas: Map<string, Persona>): string {
  if (!l.persona_id) return l.texto;
  const p = personas.get(l.persona_id);
  return `${p ? p.nombre : 'Alguien del equipo'} ${l.texto}`;
}
export const PREFIJO_PASO = 'aplicó la sugerencia · ';
