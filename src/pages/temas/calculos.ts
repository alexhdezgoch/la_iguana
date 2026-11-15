// Derivados de Temas y narrativas: ventanas de días, conteos por ventana y canal, nombres cortos.
// Nada de datos aquí: todo sale de las filas que recibe.
import { aFecha, corto, diasEntre, num } from '../../lib/formato';
import type { Evento, FiguraCampana, Json, Narrativa, SerieDiaria } from '../../lib/tipos';

export interface Canal { canal: string; porcentaje: number }

/** Los días del periodo, del más antiguo a hoy (AAAA-MM-DD). */
export function diasDelPeriodo(inicio: string | null, fin: string): string[] {
  const f = aFecha(fin)!;
  let n = inicio ? (diasEntre(inicio, fin) ?? 29) + 1 : 30;
  if (n < 1 || n > 400) n = 30;
  const out: string[] = [];
  for (let k = n - 1; k >= 0; k--) {
    const d = new Date(f.getFullYear(), f.getMonth(), f.getDate() - k);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return out;
}

/** entidad_id → menciones por día alineadas a `dias` (0 si falta el día). Solo entidades con alguna fila. */
export function seriesPorEntidad(filas: SerieDiaria[], dias: string[]): Map<string, number[]> {
  const idx = new Map(dias.map((d, i) => [d, i]));
  const m = new Map<string, number[]>();
  for (const f of filas) {
    const i = idx.get(f.fecha.slice(0, 10));
    if (i == null) continue;
    if (!m.has(f.entidad_id)) m.set(f.entidad_id, dias.map(() => 0));
    m.get(f.entidad_id)![i] += f.menciones;
  }
  return m;
}

export interface Ventana { desde: number; hasta: number; completa: boolean; texto: string }

/** Redondeo de la demo para cifras estimadas por ventana o canal. */
export function redondear(n: number): number {
  return n >= 1000 ? Math.round(n / 100) * 100 : Math.round(n / 10) * 10;
}
export function suma(a: number[], desde: number, hasta: number): number {
  let s = 0;
  for (let j = Math.max(desde, 0); j <= hasta && j < a.length; j++) s += a[j];
  return s;
}

/** Fracción que corresponde al canal elegido según detalle.canales. null si no hay reparto. */
export function factorCanal(canal: string, detalle: Json | null | undefined): number | null {
  if (canal === 'all') return 1;
  const cs = (detalle?.canales ?? []) as Canal[];
  if (!cs.length) return null;
  if (canal === 'redes') return cs.filter((c) => c.canal !== 'Medios').reduce((s, c) => s + c.porcentaje, 0) / 100;
  const c = cs.find((x) => x.canal === canal);
  return c ? c.porcentaje / 100 : 0;
}

/**
 * Menciones de una entidad en la ventana y canal elegidos.
 * Ventana completa y todos los canales: el total guardado. Si no, se deriva de la serie diaria y del reparto por canal.
 */
export function conteo(total: number, serie: number[] | undefined, v: Ventana, canal: string, detalle: Json | null | undefined): number | null {
  const f = factorCanal(canal, detalle);
  if (f == null) return null;
  if (v.completa && canal === 'all') return total;
  const base = v.completa ? total : serie ? suma(serie, v.desde, v.hasta) : null;
  if (base == null) return null;
  return redondear(base * f);
}

/** Cambio de la ventana contra la ventana anterior del mismo largo, en %. null si no hay con qué comparar. */
export function cambioVentana(serie: number[] | undefined, v: Ventana): number | null {
  if (!serie) return null;
  const largo = v.hasta - v.desde + 1;
  if (v.desde - largo < 0) return null;
  const antes = suma(serie, v.desde - largo, v.desde - 1);
  if (!antes) return null;
  return Math.round((suma(serie, v.desde, v.hasta) / antes - 1) * 100);
}

export function signoPct(n: number | null | undefined): string {
  if (n == null) return '—';
  return (n > 0 ? '+' : '') + Math.round(n) + '%';
}

/** Ventana de un evento: del día de inicio al de fin, con al menos 7 días si caben, sin pasar de hoy. */
export function ventanaEvento(e: Evento, dias: string[]): { desde: number; hasta: number } | null {
  if (!e.fecha_inicio) return null;
  const ini = diasEntre(dias[0], e.fecha_inicio);
  if (ini == null) return null;
  const fin = e.fecha_fin ? diasEntre(dias[0], e.fecha_fin) ?? ini : ini;
  const desde = Math.max(ini, 0);
  const hasta = Math.min(Math.max(fin, ini + 6), dias.length - 1);
  if (desde > dias.length - 1 || hasta < 0) return null;
  return { desde, hasta };
}

/** Nombre corto para encabezados: figuras.nombre_corto ("González U."); si la figura no tiene, su nombre. */
export function nombresCortos(figs: Array<Pick<FiguraCampana, 'figura_id' | 'nombre' | 'nombre_corto'>>): Map<string, string> {
  return new Map(figs.map((f) => [f.figura_id, corto(f)]));
}

export const ORDEN_REL: Record<string, number> = { Propia: 0, Aliada: 1, Rival: 2, 'A observar': 3 };

/** Figura de una narrativa, como la muestra la demo. */
export function figuraDeNarrativa(n: Narrativa, figs: Map<string, FiguraCampana>): { nombre: string; corto: string; rel: string; relCls: string | null } {
  const f = n.figura_id ? figs.get(n.figura_id) : undefined;
  const REL_CLS: Record<string, string> = { Propia: 'chip own', Aliada: 'chip ally', Rival: 'chip rival', 'A observar': 'chip watch' };
  if (f) return { nombre: f.nombre, corto: f.nombre, rel: f.relacion, relCls: REL_CLS[f.relacion] ?? 'chip' };
  if (n.figura_id) return { nombre: 'Figura fuera de la campaña', corto: 'Otra figura', rel: '', relCls: null };
  const ids = (n.detalle?.figura_ids ?? []) as string[];
  if (ids.length) {
    const rels = [...new Set(ids.map((id) => figs.get(id)?.relacion).filter(Boolean) as string[])]
      .sort((a, b) => (ORDEN_REL[a] ?? 9) - (ORDEN_REL[b] ?? 9));
    const PLURAL: Record<string, string> = { Propia: 'propia', Aliada: 'aliadas', Rival: 'rivales', 'A observar': 'a observar' };
    const txt = rels.map((r, i) => (i === 0 && r === 'Propia' ? 'Propia' : PLURAL[r] ?? r)).join(' y ');
    return { nombre: 'Varias figuras', corto: 'Varias figuras', rel: txt ? txt.charAt(0).toUpperCase() + txt.slice(1) : 'Varias figuras', relCls: null };
  }
  return { nombre: 'Sin figura, solo tema', corto: 'Sin figura', rel: 'Solo tema', relCls: null };
}

/** % de las menciones de la figura que caen en la narrativa (derivado de los cortes de 30 días). */
export function pctDeFigura(n: Narrativa, figs: Map<string, FiguraCampana>): number | null {
  const f = n.figura_id ? figs.get(n.figura_id) : undefined;
  if (!f || !f.menciones) return null;
  return (n.menciones / f.menciones) * 100;
}

export const DIR: Record<string, { texto: string; cls: string }> = {
  Favorable: { texto: 'Favorable', cls: 'chip fav' },
  Desfavorable: { texto: 'Desfavorable', cls: 'chip unf' },
  'Sin dirección': { texto: 'Sin dirección', cls: 'chip watch' },
  Posicionamiento: { texto: 'Posicionamiento', cls: 'chip ring' },
};
export const TEND: Record<string, string> = { Emergente: 'chip warn', 'En aumento': 'chip ring', Estable: 'chip watch', 'A la baja': 'chip watch' };

export const numO = (n: number | null) => (n == null ? 'Sin datos' : num(n));
