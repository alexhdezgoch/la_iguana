// Marca y pie del documento de reporte: de la consultora (organizacion) o del cliente (campanas.extra.marca_cliente).
import type { Campana, Organizacion } from '../tipos';
import type { Marca } from './Documento';

export function marcaDe(m: string | undefined, c: Campana, org: Organizacion | null): Marca {
  const cli = c.extra?.marca_cliente;
  if (m === 'Cliente') return { iniciales: cli?.iniciales ?? c.iniciales ?? '', nombre: cli?.nombre ?? c.nombre };
  return { iniciales: org?.iniciales ?? '', nombre: org?.nombre ?? 'Equipo' };
}
export function pieDe(m: string | undefined, confidencial: boolean, c: Campana, org: Organizacion | null): string {
  const quien = m === 'Cliente' ? marcaDe('Cliente', c, org).nombre : `Preparado por ${org?.nombre ?? 'el equipo'}`;
  return [confidencial ? 'Confidencial' : null, quien, c.es_demo ? 'cifras ilustrativas' : null].filter(Boolean).join(' · ');
}
