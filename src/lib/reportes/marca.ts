// Marca y pie del documento de reporte: de la consultora (organizacion) o del cliente (campanas.extra.marca_cliente).
import type { Campana, Organizacion } from '../tipos';
import type { Marca } from './Documento';

/** Encabezado obligatorio de todo documento (vista previa, impresión, PDF y HTML) de una campaña de demo. */
export const AVISO_DEMO = 'Escenario hipotético: personas reales, cifras y hechos inventados.';

export function marcaDe(m: string | undefined, c: Campana, org: Organizacion | null): Marca {
  const cli = c.extra?.marca_cliente;
  const aviso = c.es_demo ? AVISO_DEMO : undefined;
  if (m === 'Cliente') return { iniciales: cli?.iniciales ?? c.iniciales ?? '', nombre: cli?.nombre ?? c.nombre, aviso };
  return { iniciales: org?.iniciales ?? '', nombre: org?.nombre ?? 'Equipo', aviso };
}
export function pieDe(m: string | undefined, confidencial: boolean, c: Campana, org: Organizacion | null): string {
  const quien = m === 'Cliente' ? marcaDe('Cliente', c, org).nombre : `Preparado por ${org?.nombre ?? 'el equipo'}`;
  return [confidencial ? 'Confidencial' : null, quien, c.es_demo ? 'cifras ilustrativas' : null].filter(Boolean).join(' · ');
}
