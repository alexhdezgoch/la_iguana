// Formato de cifras y fechas, igual que en la demo: 62,000 · 31.0% · +17 · 4.8 M · 412 mil.

export function num(n: number | null | undefined): string {
  return n == null ? 'Sin datos' : Math.round(n).toLocaleString('en-US');
}
export function pct(n: number | null | undefined, decimales = 1): string {
  return n == null ? 'Sin datos' : n.toFixed(decimales) + '%';
}
export function neto(n: number | null | undefined): string {
  return n == null ? 'Sin datos' : (n > 0 ? '+' : '') + n;
}
/** 4800000 → "4.8 M", 412000 → "412 mil", 950 → "950". */
export function compacto(n: number | null | undefined): string {
  if (n == null) return 'Sin datos';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' M';
  if (n >= 10_000) return Math.round(n / 1000) + ' mil';
  return num(n);
}
export function nivelRiesgo(n: number | null | undefined): 'Bajo' | 'Medio' | 'Alto' | null {
  if (n == null) return null;
  return n <= 33 ? 'Bajo' : n <= 66 ? 'Medio' : 'Alto';
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Convierte 'AAAA-MM-DD' (o ISO con hora) a Date en hora local, sin corrimiento de zona. */
export function aFecha(s: string | Date | null | undefined): Date | null {
  if (!s) return null;
  if (s instanceof Date) return s;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function may(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

/**
 * estilo 'corto' → "13 may" · 'medio' → "13 de mayo" · 'largo' → "13 de mayo de 2027"
 * 'dia' → "jueves 13 de mayo" · 'completo' → "Jueves 13 de mayo de 2027"
 */
export function fecha(s: string | Date | null | undefined, estilo: 'corto' | 'medio' | 'largo' | 'dia' | 'completo' = 'medio'): string {
  const d = aFecha(s);
  if (!d) return 'Sin fecha';
  const dia = d.getDate(), mes = MESES[d.getMonth()];
  switch (estilo) {
    case 'corto': return `${dia} ${mes.slice(0, 3)}`;
    case 'largo': return `${dia} de ${mes} de ${d.getFullYear()}`;
    case 'dia': return `${DIAS[d.getDay()]} ${dia} de ${mes}`;
    case 'completo': return `${may(DIAS[d.getDay()])} ${dia} de ${mes} de ${d.getFullYear()}`;
    default: return `${dia} de ${mes}`;
  }
}
/** "14 de abril a 13 de mayo" · "10 a 14 de mayo" si es el mismo mes. */
export function rango(a: string | null | undefined, b: string | null | undefined): string {
  const x = aFecha(a), y = aFecha(b);
  if (!x) return 'Sin fecha';
  if (!y || x.getTime() === y.getTime()) return fecha(x);
  if (x.getMonth() === y.getMonth() && x.getFullYear() === y.getFullYear()) return `${x.getDate()} a ${y.getDate()} de ${MESES[y.getMonth()]}`;
  return `${fecha(x)} a ${fecha(y)}`;
}
export function hora(s: string | Date | null | undefined): string {
  const d = aFecha(s);
  if (!d) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
/** Días enteros de a hasta b (b - a). */
export function diasEntre(a: string | Date | null | undefined, b: string | Date | null | undefined): number | null {
  const x = aFecha(a), y = aFecha(b);
  if (!x || !y) return null;
  const ux = Date.UTC(x.getFullYear(), x.getMonth(), x.getDate());
  const uy = Date.UTC(y.getFullYear(), y.getMonth(), y.getDate());
  return Math.round((uy - ux) / 86_400_000);
}
export function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/).filter((w) => !/^(de|del|la|las|los|y)$/i.test(w));
  if (!p.length) return '';
  const a = p[0][0] ?? '';
  const b = p.length > 2 ? p[p.length - 2][0] : p.length > 1 ? p[1][0] : '';
  return (a + b).toUpperCase();
}

// ---------- clases de la interfaz ----------
export type Relacion = 'Propia' | 'Aliada' | 'Rival' | 'A observar';
export const REL: Record<Relacion, { cls: string; color: string }> = {
  Propia: { cls: 'own', color: '#285A32' },
  Aliada: { cls: 'ally', color: '#3A76C4' },
  Rival: { cls: 'rival', color: '#D07A2D' },
  'A observar': { cls: 'watch', color: '#8A928C' },
};
export const SEVERIDAD: Record<string, string> = { Alta: 'chip unf', Media: 'chip warn', Baja: 'chip watch' };
export const RIESGO_PUNTO: Record<string, string> = { Bajo: 'd', Medio: 'd dw', Alto: 'd du' };
export const ESTADO_EVENTO: Record<string, string> = {
  'En curso': 'chip live', 'En análisis': 'chip ally', Programado: 'chip ring', Borrador: 'chip watch', Cerrado: 'chip watch', Cancelado: 'chip watch',
};

// ---------- horas en la zona de la campaña ----------
function partes(ts: string | Date, zona: string): { dia: string; hora: string } {
  const d = typeof ts === 'string' ? new Date(ts) : ts;
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
  const v = (t: string) => f.find((p) => p.type === t)?.value ?? '';
  return { dia: `${v('year')}-${v('month')}-${v('day')}`, hora: `${Number(v('hour')) % 24}:${v('minute')}` };
}
/** Hora "7:12" de un instante, en la zona horaria de la campaña. */
export function horaEn(ts: string | Date | null | undefined, zona = 'America/Caracas'): string {
  return ts ? partes(ts, zona).hora : '';
}
/** Día 'AAAA-MM-DD' de un instante, en la zona horaria de la campaña. */
export function diaEn(ts: string | Date | null | undefined, zona = 'America/Caracas'): string | null {
  return ts ? partes(ts, zona).dia : null;
}
/**
 * Momento relativo al "hoy" de la campaña (hoyDe(campana)): "hoy, 7:12" · "ayer, 18:40" · "25 abr, 20:10".
 * Pasa campana.zona_horaria como zona.
 */
export function cuando(ts: string | Date | null | undefined, hoy: string, zona = 'America/Caracas'): string {
  if (!ts) return '';
  const p = partes(ts, zona);
  const dif = diasEntre(p.dia, hoy);
  const dia = dif === 0 ? 'hoy' : dif === 1 ? 'ayer' : dif === -1 ? 'mañana' : fecha(p.dia, 'corto');
  return `${dia}, ${p.hora}`;
}
