// Tipos, clases y helpers de la pantalla Menciones. Solo vocabulario fijo de la interfaz: los datos vienen de la base.
import type { Mencion, Sentimiento } from '../../lib/tipos';

/** La tabla tiene creada_en aunque el tipo compartido no lo declare. */
export type MencionFila = Mencion & { creada_en?: string };

export const SENTIMIENTOS: Sentimiento[] = ['Favorable', 'Neutral', 'Desfavorable'];
export const PUNTO: Record<Sentimiento, string> = { Favorable: 'd df', Neutral: 'd', Desfavorable: 'd du' };
export const CHIP_SENT: Record<Sentimiento, string> = { Favorable: 'chip fav', Neutral: 'chip watch', Desfavorable: 'chip unf' };

export type Importancia = 'alto' | 'medio' | 'bajo';
export const IMPORTANCIAS: Importancia[] = ['alto', 'medio', 'bajo'];
export const CHIP_IMP: Record<Importancia, string> = { alto: 'chip unf', medio: 'chip warn', bajo: 'chip watch' };
export const TEXTO_IMP: Record<Importancia, string> = { alto: 'Alta', medio: 'Media', bajo: 'Baja' };

export type Vista = 'Todas' | 'Pendientes' | 'Revisadas' | 'Descartadas';
export const VISTAS: Vista[] = ['Todas', 'Pendientes', 'Revisadas', 'Descartadas'];

/** Valor de filtro para "sin tema / sin narrativa / sin evento". */
export const SIN = '-';

export function sentimientoDe(m: Mencion): Sentimiento | null {
  return m.sentimiento_manual ?? m.sentimiento;
}
/** Por revisar = misma regla que la barra lateral (docs/semilla.md). */
export function pendiente(m: Mencion): boolean {
  return m.requiere_revision && !m.revisada && m.estado !== 'Descartada';
}
export function enVista(m: Mencion, v: Vista): boolean {
  if (v === 'Descartadas') return m.estado === 'Descartada';
  if (m.estado === 'Descartada') return false;
  if (v === 'Pendientes') return pendiente(m);
  if (v === 'Revisadas') return m.revisada;
  return true;
}
/** Estado visible de una mención y su clase. */
export function estadoDe(m: Mencion, sinGuardar = false): { texto: string; cls: string } {
  if (m.estado === 'Descartada') return { texto: 'Descartada', cls: 'chip watch' };
  if (sinGuardar) return { texto: 'Cambio sin guardar', cls: 'chip warn' };
  if (m.estado === 'Por procesar') return { texto: 'Por procesar', cls: 'chip ring' };
  if (m.revisada) return { texto: m.sentimiento && m.sentimiento_manual && m.sentimiento_manual !== m.sentimiento ? 'Corregida a mano' : 'Revisada', cls: 'mu' };
  if (m.requiere_revision) return { texto: 'Pendiente', cls: 'chip warn' };
  return { texto: 'Sin revisión', cls: 'mu' };
}
/** Momento para ordenar: publicada_en, o la fecha de alta si la mención todavía no se procesó. */
export function momento(m: MencionFila): string {
  return m.publicada_en ?? m.creada_en ?? '';
}
export function lista(v: string | null): string[] {
  return v ? v.split(',').filter(Boolean) : [];
}
