// Cálculos de calendario para Crear evento. Los instantes son milisegundos "de pared" en la zona de la campaña
// (Date.UTC con la fecha y hora tal como se escriben), así las cuentas no dependen de la zona del navegador.
export const H = 3_600_000;
export const D = 24 * H;
const MC = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const ML = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const p2 = (n: number) => String(n).padStart(2, '0');

/** 'AAAA-MM-DD' + 'HH:MM' → instante de pared, o NaN si falta la fecha. Sin hora, mediodía. */
export function instante(fecha: string | null | undefined, hora?: string | null): number {
  const a = String(fecha ?? '').slice(0, 10).split('-');
  if (a.length < 3 || !a[2]) return NaN;
  const b = String(hora || '12:00').split(':');
  return Date.UTC(+a[0], +a[1] - 1, +a[2], +b[0] || 0, +b[1] || 0);
}
export function diaCorto(t: number): string { const d = new Date(t); return `${d.getUTCDate()} ${MC[d.getUTCMonth()]}`; }
export function mesCorto(t: number): string { return MC[new Date(t).getUTCMonth()]; }
export function diaMedio(t: number): string { const d = new Date(t); return `${d.getUTCDate()} de ${ML[d.getUTCMonth()]}`; }
export function diaLargo(t: number, conHora = true): string {
  const d = new Date(t);
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${ML[d.getUTCMonth()]}${conHora ? ` a las ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}` : ''}`;
}
export function aIso(t: number): string { const d = new Date(t); return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`; }
/** "18 h" o "3 días". */
export function duracion(horas: number): string { return horas >= 48 ? `${Math.round(horas / 24)} días` : `${horas} h`; }
