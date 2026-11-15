// Estados comunes de una pantalla: cargando, error y vacío. Y la confirmación en línea de las acciones que borran.
import { useEffect, useRef, type ReactNode } from 'react';

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

/**
 * Confirmación en línea para acciones que no se deshacen (borrar, quitar, cancelar). Reemplaza a window.confirm:
 * se pinta donde estaba el control, con la pregunta y dos botones. Escape o "No" la cierran.
 *   {confirmando ? <Confirmar pregunta="¿Borrar esta nota?" si="Sí, borrar" alConfirmar={borrar} alCancelar={() => setConfirmando(false)} /> : <button …>Borrar</button>}
 */
export function Confirmar({ pregunta, si, no = 'No', alConfirmar, alCancelar, ocupado = false }: {
  pregunta: string; si: string; no?: string; alConfirmar: () => void; alCancelar: () => void; ocupado?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => { ref.current?.querySelector<HTMLButtonElement>('button[data-no]')?.focus(); }, []);
  return (
    <span className="confirmar" role="group" aria-label={pregunta} ref={ref} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); alCancelar(); } }}>
      <span>{pregunta}</span>
      <button type="button" className="enlace-btn confirmar-si" disabled={ocupado} onClick={alConfirmar}>{si}</button>
      <button type="button" className="enlace-btn" data-no="" disabled={ocupado} onClick={alCancelar}>{no}</button>
    </span>
  );
}
