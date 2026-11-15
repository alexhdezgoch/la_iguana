// Tipos y derivados propios de la ficha de evento. Nada de datos aquí: solo forma de `eventos.resultados` y textos de interfaz.
import { diasEntre } from '../../lib/formato';
import type { Evento, EstadoEvento, Relacion } from '../../lib/tipos';

export interface Resultados {
  pico?: { por_minuto?: number | null; en?: string | null; contexto?: string | null; tema_id?: string | null };
  otros?: { menciones?: number | null; participacion?: number | null };
  sin_mensaje?: { menciones?: number | null; porcentaje?: number | null };
  cobertura?: { digitales?: number | null; radio?: number | null; television?: number | null; favorables?: number | null; neutrales?: number | null; desfavorables?: number | null };
  reacciones?: Array<{ figura_id: string; publicaciones?: number | null; narrativa_id?: string | null; menciones?: number | null }>;
  hashtags?: Array<{ hashtag: string; menciones?: number | null; lado?: string | null; nota?: string | null }>;
  publicaciones?: Array<{ titulo: string; canal?: string | null; origen?: string | null; metrica?: string | null; valor?: number | null }>;
}
export function resultadosDe(e: Evento): Resultados {
  return (e.resultados ?? {}) as Resultados;
}

export const TABS = [
  ['ficha', 'Ficha'],
  ['participantes', 'Participantes'],
  ['resultados', 'Resultados'],
] as const;
export type Tab = (typeof TABS)[number][0];

/** Estados en los que ya hay (o puede haber) medición. */
export function midiendo(estado: EstadoEvento): boolean {
  return estado === 'En curso' || estado === 'En análisis' || estado === 'Cerrado';
}

/** Siguiente paso natural de cada estado: [nuevo estado, texto del botón]. */
export const SIGUIENTE: Record<EstadoEvento, [EstadoEvento, string] | null> = {
  Borrador: ['Programado', 'Programar evento'],
  Programado: ['En curso', 'Marcar en curso'],
  'En curso': ['En análisis', 'Pasar a análisis'],
  'En análisis': ['Cerrado', 'Cerrar evento'],
  Cerrado: ['En análisis', 'Reabrir análisis'],
  Cancelado: ['Programado', 'Reprogramar'],
};
/** Lo que se guarda en nota_estado al pasar a cada estado (el listado de eventos lo muestra). */
export function notaPara(estado: EstadoEvento, actual: string | null): string | null {
  switch (estado) {
    case 'En análisis': return 'Resultados preliminares';
    case 'Cerrado': return 'Resultados finales';
    case 'Borrador': return actual;
    default: return null;
  }
}

/** "del debate", "de la gira": para frases como "antes del debate". */
export function delTipo(tipo: string | null | undefined): string {
  if (!tipo) return 'del evento';
  const t = tipo.toLowerCase();
  const fem = ['gira', 'conferencia de prensa', 'entrevista', 'crisis'].includes(t);
  return `${fem ? 'de la' : 'del'} ${t}`;
}

export function origenTexto(o: Evento['origen']): string {
  return o === 'De rival' ? 'de rival' : o.toLowerCase();
}

/** Día X de Y para un evento de varios días, contra el "hoy" de la campaña. */
export function diaDe(e: Evento, hoy: string): { dia: number; dias: number } | null {
  if (!e.fecha_inicio) return null;
  const dias = (diasEntre(e.fecha_inicio, e.fecha_fin ?? e.fecha_inicio) ?? 0) + 1;
  const dia = (diasEntre(e.fecha_inicio, hoy) ?? 0) + 1;
  if (dia < 1 || dia > dias) return null;
  return { dia, dias };
}

export const COLOR_REL: Record<Relacion, string> = { Propia: '#285A32', Aliada: '#3A76C4', Rival: '#D07A2D', 'A observar': '#8A928C' };
export const COLOR_LADO: Record<string, string> = { propio: '#285A32', rival: '#D07A2D', neutral: '#454E48' };
export const ESTADO_MENSAJE: Record<string, string> = { 'Aterrizó': 'chip fav', Parcial: 'chip warn', 'No aterrizó': 'chip unf', 'Sin mensaje': 'chip watch' };
export const ROLES = ['Protagonista', 'Oradora/or', 'Invitada/o', 'Adversaria/o', 'Moderadora/or'];

export function errorTexto(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
