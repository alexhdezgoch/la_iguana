// Derivados de Panorama: todo se calcula al leer, a partir de las filas de la base. Nada se guarda.
import { diasEntre } from '../../lib/formato';
import type { Alerta, Campana, CampanaResumen, FiguraCampana, Nivel, Relacion } from '../../lib/tipos';

/** La campaña con su resumen (cifras de la figura propia y pendientes). */
export interface CampanaPanorama { c: Campana; r: CampanaResumen | null }

/** La campaña se llama como su figura propia (presidenciales): se nombra por la contienda. */
function llevaNombreDeFigura({ c, r }: CampanaPanorama): boolean {
  return !!r?.figura_propia && r.figura_propia === c.nombre;
}
/** Nombre largo para listas: "Presidenciales 2027", "Gobernación del Zulia". */
export function etiqueta(x: CampanaPanorama): string {
  return llevaNombreDeFigura(x) ? x.c.contienda ?? x.c.nombre : x.c.nombre;
}
/** Nombre corto para filtros y chips: "Presidenciales", "Zulia", "Chacao". */
export function corto(x: CampanaPanorama): string {
  if (llevaNombreDeFigura(x)) return x.c.ambito ?? x.c.contienda ?? x.c.nombre;
  return x.c.territorio?.split(',')[0].trim() || x.c.nombre;
}
/** Subtítulo de la tarjeta: "Regionales 2027 · figura propia: Manuel Rosales". */
export function contienda(x: CampanaPanorama): string {
  const partes = [x.c.contienda];
  if (x.r?.figura_propia && !llevaNombreDeFigura(x)) partes.push(`figura propia: ${x.r.figura_propia}`);
  return partes.filter(Boolean).join(' · ');
}

/** Avance de la fase (0–100) y texto del reloj electoral. */
export function reloj(c: Campana, hoy: string): { avance: number | null; texto: string } {
  const faltan = c.jornada ? diasEntre(hoy, c.jornada) : null;
  const jornada = faltan != null && faltan >= 0 ? `faltan ${faltan} ${faltan === 1 ? 'día' : 'días'} para la jornada electoral` : null;
  if (c.fase === 'Campaña' && c.inicio_campana && c.fin_campana) {
    const dia = (diasEntre(c.inicio_campana, hoy) ?? 0) + 1;
    const dias = (diasEntre(c.inicio_campana, c.fin_campana) ?? 0) + 1;
    if (dia >= 1 && dia <= dias) {
      return { avance: (dia / dias) * 100, texto: `Día ${dia} de ${dias}${jornada ? ` · ${jornada}` : ''}` };
    }
  }
  const avance = typeof c.extra?.avance_fase === 'number' ? Math.min(100, Math.max(0, c.extra.avance_fase)) : null;
  return { avance, texto: jornada ? jornada.replace(/^./, (l) => l.toUpperCase()) : 'Sin fecha oficial de jornada electoral' };
}

const RANGO_REL: Record<Relacion, number> = { Propia: 0, Aliada: 1, Rival: 2, 'A observar': 3 };

/** Una figura del equipo con sus vínculos a las campañas visibles. */
export interface FiguraPanorama {
  figura_id: string; nombre: string; iniciales: string | null; partido: string | null;
  menciones: number; neto: number | null; riesgo: number | null; riesgo_nivel: Nivel | null;
  vinculos: Array<{ campana_id: string; relacion: Relacion }>;
}

/**
 * Figuras compartidas (docs/semilla.md): una fila por figura.
 * Menciones = suma de los cortes de cada campaña; neto = promedio ponderado por menciones; riesgo = el máximo.
 */
export function agruparFiguras(filas: FiguraCampana[], ordenCampana: Map<string, number>): FiguraPanorama[] {
  const grupos = new Map<string, FiguraCampana[]>();
  for (const f of filas) {
    if (!ordenCampana.has(f.campana_id)) continue;
    const g = grupos.get(f.figura_id) ?? [];
    g.push(f);
    grupos.set(f.figura_id, g);
  }
  const salida: FiguraPanorama[] = [];
  for (const [figura_id, g] of grupos) {
    const menciones = g.reduce((n, f) => n + (f.menciones ?? 0), 0);
    const conNeto = g.filter((f) => f.neto != null);
    const pesos = conNeto.reduce((n, f) => n + (f.menciones ?? 0), 0);
    const neto = !conNeto.length ? null
      : pesos > 0 ? Math.round(conNeto.reduce((n, f) => n + f.neto! * (f.menciones ?? 0), 0) / pesos)
      : Math.round(conNeto.reduce((n, f) => n + f.neto!, 0) / conNeto.length);
    const peor = g.filter((f) => f.riesgo != null).sort((a, b) => b.riesgo! - a.riesgo!)[0] ?? null;
    const vinculos = g
      .map((f) => ({ campana_id: f.campana_id, relacion: f.relacion }))
      .sort((a, b) => RANGO_REL[a.relacion] - RANGO_REL[b.relacion] || (ordenCampana.get(a.campana_id)! - ordenCampana.get(b.campana_id)!));
    salida.push({
      figura_id, nombre: g[0].nombre, iniciales: g[0].iniciales, partido: g[0].partido,
      menciones, neto, riesgo: peor?.riesgo ?? null, riesgo_nivel: peor?.riesgo_nivel ?? null, vinculos,
    });
  }
  return salida.sort((a, b) => b.menciones - a.menciones || a.nombre.localeCompare(b.nombre));
}

const RANGO_SEV: Record<string, number> = { Alta: 0, Media: 1, Baja: 2 };

/** Alerta de la lista "para hoy": las repetidas en varias campañas se juntan. */
export interface AlertaPanorama { alerta: Alerta; campanas: string[] }

/**
 * Regla de docs/semilla.md: alertas abiertas de todas las campañas, sin repetidas por texto + figura_id,
 * ordenadas por severidad y luego por detectada_en desc.
 */
export function alertasParaHoy(alertas: Alerta[], ordenCampana: Map<string, number>, tope = 5): AlertaPanorama[] {
  const orden = [...alertas]
    .filter((a) => ordenCampana.has(a.campana_id))
    .sort((a, b) => (RANGO_SEV[a.severidad] ?? 9) - (RANGO_SEV[b.severidad] ?? 9) || b.detectada_en.localeCompare(a.detectada_en));
  const vistas = new Map<string, AlertaPanorama>();
  for (const a of orden) {
    const clave = `${a.texto}\u0000${a.figura_id ?? ''}`;
    const ya = vistas.get(clave);
    if (ya) { if (!ya.campanas.includes(a.campana_id)) ya.campanas.push(a.campana_id); }
    else vistas.set(clave, { alerta: a, campanas: [a.campana_id] });
  }
  const lista = [...vistas.values()];
  lista.forEach((x) => x.campanas.sort((a, b) => ordenCampana.get(a)! - ordenCampana.get(b)!));
  return lista.slice(0, tope);
}

/** "1 en campaña · 2 en precampaña". */
export function porFase(campanas: Campana[]): string {
  const cuenta = new Map<string, number>();
  for (const c of campanas) cuenta.set(c.fase, (cuenta.get(c.fase) ?? 0) + 1);
  return [...cuenta].map(([fase, n]) => `${n} en ${fase.toLowerCase()}`).join(' · ');
}

const PALABRAS = ['cero', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'];
/** "las tres campañas" · "la campaña" · "las 12 campañas". */
export function lasCampanas(n: number): string {
  if (n === 1) return 'la campaña';
  return `las ${PALABRAS[n] ?? n} campañas`;
}
