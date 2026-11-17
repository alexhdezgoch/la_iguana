// Ayudas del Informe: colores fijos por canal, rótulos de días y horas, porcentajes y lectura de las series.
// Regla de porcentajes del Informe: enteros ("38%"), y "<1%" cuando hay algo pero redondea a 0. Las tablas y los
// gráficos usan la misma regla. Las cifras salen de formato.ts (62,000).
import { diaEn, fecha, horaEn, num } from '../formato';
import { rotuloCanal, type DiaInforme, type InformeDatos, type SerieCanal } from './tipos';

/** Colores fijos por canal: los mismos en todos los gráficos, tablas y leyendas. */
export const COLOR_CANAL: Record<string, string> = {
  'Medio digital': '#4B8E7E',
  X: '#2B3038',
  Instagram: '#8E3B5D',
  TikTok: '#7566A6',
  YouTube: '#AFB487',
  Facebook: '#8DA8D6',
  Radio: '#C48A3E',
  'Televisión': '#5D7C95',
};
export const colorCanal = (c: string) => COLOR_CANAL[c] ?? '#6B7A86';
/** Tono principal del documento (encabezados, barras de una sola serie). */
export const TINTA = '#1F5C7A';
export const TINTA_SUAVE = '#A9C3D1';
export const SENT = { favorable: '#2F7D4F', desfavorable: '#B03B3B', neutral: '#C9CED3' } as const;
export const TONO_CODIGO: Record<string, string> = { apoyo: SENT.favorable, critica: SENT.desfavorable, neutro: '#8A949C' };

export const canalTxt = rotuloCanal;

/** Porcentaje del Informe: entero, "<1%" si es mayor que 0 y redondea a 0. */
export function pc(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return 'Sin datos';
  if (n > 0 && n < 0.5) return '<1%';
  return `${Math.round(n)}%`;
}
/** Parte de un total en porcentaje (0–100), o null sin base. */
export function parte(n: number, total: number): number | null {
  return total > 0 ? (n / total) * 100 : null;
}
/** "1.3" veces. */
export function veces(n: number | null | undefined): string {
  return n == null || !isFinite(n) ? 'Sin datos' : (Math.round(n * 10) / 10).toFixed(1);
}
export const suma = (a: number[] | undefined) => (a ?? []).reduce((s, x) => s + (x || 0), 0);

const DSEM = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
function dsem(f: string): string {
  const [y, m, d] = f.split('-').map(Number);
  return DSEM[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}
/** Encabezado de columna de un día: "mar 10 (base)" · "mié 11 (evento)" · "jue 12 (hasta 11:00)". */
export function diaColumna(d: DiaInforme): string {
  const base = `${dsem(d.fecha)} ${Number(d.fecha.slice(8))}`;
  const extra = [d.es_base ? 'base' : null, d.es_evento ? 'evento' : null, d.desde ? `desde ${d.desde}` : null, d.hasta ? `hasta ${d.hasta}` : null].filter(Boolean);
  return extra.length ? `${base} (${extra.join(', ')})` : base;
}
/** Etiqueta corta de eje X: "10 may". */
export const diaEje = (f: string) => fecha(f, 'corto');
/** "martes 10 de mayo" */
export const diaLargo = (f: string | null | undefined) => (f ? fecha(f, 'dia') : 'Sin fecha');
/** Momento de una publicación en la zona del informe: "11 may 9:33". */
export function momentoInf(ts: string | null | undefined, zona: string): string {
  if (!ts) return 'Sin hora';
  return `${fecha(diaEn(ts, zona), 'corto')} ${horaEn(ts, zona)}`;
}
export const horaInf = (ts: string | null | undefined, zona: string) => (ts ? horaEn(ts, zona) : '');
export const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

/** Serie vacía alineada con los días (o 24 horas). */
export function serieVacia(n: number): SerieCanal { return { por_canal: {}, total: Array(n).fill(0) }; }
export const totalSerie = (s: SerieCanal | undefined) => suma(s?.total);
export const totalCanal = (s: SerieCanal | undefined, c: string) => suma(s?.por_canal?.[c]);

/** Serie principal: conversación en modo evento, ítems con algún eje (sin duplicados) en modo tema. */
export function principal(d: InformeDatos): { serie: SerieCanal; vistas: SerieCanal; nombre: string } {
  const S = d.series;
  if (d.modo === 'tema') return { serie: S.sin_duplicados, vistas: S.vistas_filas, nombre: 'ítems con algún eje' };
  return { serie: S.conversacion, vistas: S.vistas_conversacion, nombre: `publicaciones ${sobre(d, d.ejes_usados.conversacion)}` };
}
export function ejeNombre(d: InformeDatos, id: string | null | undefined): string | null {
  if (!id) return null;
  return d.ejes.definiciones.find((e) => e.id === id)?.nombre ?? null;
}
/** "sobre el evento" a partir del nombre del eje: "Sobre el evento" → "sobre el evento". Sin eje: "en el periodo". */
export function sobre(d: InformeDatos, id: string | null | undefined): string {
  const n = ejeNombre(d, id);
  if (!n) return 'en el periodo';
  const m = n.charAt(0).toLowerCase() + n.slice(1);
  return /^(sobre|con|que|del|de|en)\b/.test(m) ? m : `del eje "${n}"`;
}
/** Índice de un día en d.dias. */
export const iDia = (d: InformeDatos, f: string | null | undefined) => (f ? d.dias.findIndex((x) => x.fecha === f) : -1);

/** Lista en español: "a, b y c". */
export function enLista(xs: string[]): string {
  const l = xs.filter(Boolean);
  if (l.length <= 1) return l[0] ?? '';
  return `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}`;
}
/** "X: 1,345" para listas cortas por canal (orden de d.canales, sin ceros). */
export function porCanalTxt(d: InformeDatos, valor: (c: string) => number, unidad = ''): string {
  return enLista(d.canales.map((c) => [c, valor(c)] as const).filter(([, v]) => v > 0).map(([c, v]) => `${num(v)}${unidad} en ${canalTxt(c)}`));
}
/** Fragmento de texto: recortado; con comillas solo fuera de demo (en demo los fragmentos van sin comillas). */
export function fragmento(t: string | null | undefined, demo: boolean, max = 140): string {
  if (!t) return '';
  const s = t.replace(/\s+/g, ' ').trim();
  const r = s.length > max ? s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : s;
  return demo ? r : `“${r}”`;
}
export function nombrePeriodo(d: InformeDatos): string {
  const p = d.periodo;
  if (!p?.inicio_local) return 'Sin periodo';
  const [a, ha] = p.inicio_local.split('T'), [b, hb] = p.fin_local.split('T');
  // Fin excluido: si termina a las 00:00, el último día es el anterior y se muestra hasta las 23:59.
  const ultimo = d.dias.length ? d.dias[d.dias.length - 1].fecha : b;
  const [fd, fh] = hb === '00:00' ? [ultimo, '23:59'] : [b, hb];
  return `${diaLargo(a)}, ${ha}, al ${diaLargo(fd)} de ${fd.slice(0, 4)}, ${fh}`;
}
