// Acceso a datos. Única puerta a Supabase para las pantallas.
//
//   const figuras = await db.listar<FiguraCampana>('v_figuras_campana', { eq: { campana_id }, orden: 'orden' });
//   const evento  = await db.uno<Evento>('eventos', id);
//   await db.crear('eventos', { campana_id, nombre, tipo });
//   await db.cambiar('alertas', id, { estado: 'Resuelta' });
//   const id = await db.rpc<string>('crear_campana', { p: {...} });
//
// En componentes usa los hooks de ./hooks (useTabla, useFila): se recargan solos cuando la tabla cambia.
// Las reglas de acceso viven en la base: si el rol no puede escribir, la llamada lanza un Error con el motivo.
import { supabase } from './supabase';

export type Valor = string | number | boolean | null;
export type Orden = string | Array<[string, 'asc' | 'desc']>;
export interface Opciones {
  /** Igualdad por columna. Un arreglo significa "cualquiera de estos valores"; null busca nulos. */
  eq?: Record<string, Valor | Valor[]>;
  /** Distinto de. */
  neq?: Record<string, Valor>;
  /** Texto contenido, sin distinguir mayúsculas: { nombre: 'mach' }. */
  buscar?: Record<string, string>;
  /** Mayor o igual / menor o igual (fechas, números). */
  desde?: Record<string, string | number>;
  hasta?: Record<string, string | number>;
  /** Columnas de arreglo que contienen todos estos valores: { hashtags: ['#Debate'] }. */
  contiene?: Record<string, string[]>;
  /** 'columna' (ascendente) o [['columna','desc'], ...]. Los nulos van siempre al final. */
  orden?: Orden;
  /** Tope de filas. Sin tope, la API devuelve como máximo 1000. */
  limite?: number;
}
type Fila = Record<string, unknown>;

// ---------- avisos de cambio (para recargar hooks) ----------
const oyentes = new Map<string, Set<() => void>>();
export function alCambiar(tabla: string, fn: () => void): () => void {
  if (!oyentes.has(tabla)) oyentes.set(tabla, new Set());
  oyentes.get(tabla)!.add(fn);
  return () => { oyentes.get(tabla)?.delete(fn); };
}
/** Las vistas dependen de varias tablas: un cambio en cualquiera las recarga. */
const VISTAS: Record<string, string[]> = {
  v_figuras_campana: ['campana_figuras', 'figuras', 'figura_metricas'],
  v_campanas_resumen: ['campanas', 'campana_figuras', 'alertas', 'menciones', 'figura_metricas'],
  v_personas_campana: ['personas', 'miembros_campana'],
};
/** Avisa a los hooks que una tabla cambió. db.* lo hace solo; llámalo a mano después de un db.rpc. */
export function avisar(...tablas: string[]) {
  const todas = new Set(tablas);
  for (const [vista, bases] of Object.entries(VISTAS)) if (bases.some((b) => todas.has(b))) todas.add(vista);
  todas.forEach((t) => oyentes.get(t)?.forEach((fn) => fn()));
}

function ordenes(o?: Orden): Array<[string, 'asc' | 'desc']> {
  if (!o) return [];
  return typeof o === 'string' ? [[o, 'asc']] : o;
}
function falla(donde: string, e: { message: string; code?: string }): never {
  const sinPermiso = e.code === '42501' || /row-level security|permission denied/i.test(e.message);
  throw new Error(sinPermiso ? 'Tu rol en esta campaña no permite hacer este cambio.' : `${donde}: ${e.message}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function filtrar(q: any, o: Opciones) {
  for (const [k, v] of Object.entries(o.eq ?? {})) {
    if (Array.isArray(v)) q = q.in(k, v);
    else if (v === null) q = q.is(k, null);
    else q = q.eq(k, v);
  }
  for (const [k, v] of Object.entries(o.neq ?? {})) q = q.neq(k, v);
  for (const [k, v] of Object.entries(o.buscar ?? {})) q = q.ilike(k, `%${v.replace(/[%*,()]/g, ' ')}%`);
  for (const [k, v] of Object.entries(o.desde ?? {})) q = q.gte(k, v);
  for (const [k, v] of Object.entries(o.hasta ?? {})) q = q.lte(k, v);
  for (const [k, v] of Object.entries(o.contiene ?? {})) q = q.contains(k, v);
  return q;
}

export const db = {
  /** Filas de una tabla o vista. */
  async listar<T = Fila>(tabla: string, o: Opciones = {}): Promise<T[]> {
    let q = filtrar(supabase.from(tabla).select('*'), o);
    for (const [col, dir] of ordenes(o.orden)) q = q.order(col, { ascending: dir !== 'desc', nullsFirst: false });
    if (o.limite != null) q = q.limit(o.limite);
    const { data, error } = await q;
    if (error) falla(tabla, error);
    return (data ?? []) as T[];
  },
  /** Cuántas filas cumplen el filtro, sin traerlas. */
  async contar(tabla: string, o: Opciones = {}): Promise<number> {
    const { count, error } = await filtrar(supabase.from(tabla).select('*', { count: 'exact', head: true }), o);
    if (error) falla(tabla, error);
    return count ?? 0;
  },
  /** Una fila por id, o null. */
  async uno<T = Fila>(tabla: string, id: string): Promise<T | null> {
    const { data, error } = await supabase.from(tabla).select('*').eq('id', id).limit(1);
    if (error) falla(tabla, error);
    return ((data ?? [])[0] as T | undefined) ?? null;
  },
  async crear<T = Fila>(tabla: string, fila: Partial<T>): Promise<T> {
    const { data, error } = await supabase.from(tabla).insert(fila as Fila).select('*').single();
    if (error) falla(tabla, error);
    avisar(tabla);
    return data as T;
  },
  /** Crea varias filas de la misma tabla en una sola llamada (todas o ninguna). */
  async crearVarias<T = Fila>(tabla: string, filas: Partial<T>[]): Promise<T[]> {
    if (!filas.length) return [];
    const { data, error } = await supabase.from(tabla).insert(filas as Fila[]).select('*');
    if (error) falla(tabla, error);
    avisar(tabla);
    return (data ?? []) as T[];
  },
  async cambiar<T = Fila>(tabla: string, id: string, cambios: Partial<T>): Promise<T> {
    const { data, error } = await supabase.from(tabla).update(cambios as Fila).eq('id', id).select('*');
    if (error) falla(tabla, error);
    // Sin filas: el id no existe o las reglas de acceso no dejan cambiarlo.
    if (!data || !data.length) throw new Error('Tu rol en esta campaña no permite hacer este cambio.');
    avisar(tabla);
    return data[0] as T;
  },
  async borrar(tabla: string, id: string): Promise<void> {
    const { data, error } = await supabase.from(tabla).delete().eq('id', id).select('id');
    if (error) falla(tabla, error);
    if (!data || !data.length) throw new Error('Tu rol en esta campaña no permite hacer este cambio.');
    avisar(tabla);
  },
  /** Llama una función de la base (supabase/migrations/850_funciones.sql). Después llama avisar(...) con las tablas que tocó. */
  async rpc<T = unknown>(nombre: string, args: Record<string, unknown> = {}): Promise<T> {
    const { data, error } = await supabase.rpc(nombre, args);
    if (error) falla(nombre, error);
    return data as T;
  },
};
