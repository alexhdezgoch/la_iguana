// Estados comunes de una pantalla: cargando, error y vacío.
import type { ReactNode } from 'react';

export function Cargando() {
  return <div className="cargando" aria-busy="true">Cargando…</div>;
}
export function ErrorDatos({ error }: { error: string }) {
  return <div className="card"><h2>No se pudieron cargar los datos</h2><p className="mu">{error}</p></div>;
}
/** Tarjeta para listas sin datos (campañas nuevas, filtros sin resultados). */
export function Vacio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return <div className="card vacio"><h2>{titulo}</h2>{children ? <div className="mu">{children}</div> : null}</div>;
}
/** Envuelve una pantalla: muestra cargando o error antes que el contenido. */
export function Carga({ estados, children }: { estados: Array<{ cargando: boolean; error: string | null }>; children: ReactNode }) {
  const error = estados.find((e) => e.error)?.error;
  if (error) return <main className="page"><ErrorDatos error={error} /></main>;
  if (estados.some((e) => e.cargando)) return <main className="page"><Cargando /></main>;
  return <>{children}</>;
}
