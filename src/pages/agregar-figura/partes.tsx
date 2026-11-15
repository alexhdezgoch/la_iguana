// Piezas pequeñas de los formularios de alta: grupos de opciones, etiquetas con botón de quitar y casilla.
import type { CSSProperties, ReactNode } from 'react';

export function Opciones<T extends string>({ etiqueta, opciones, valor, alElegir, deshabilitado }: {
  etiqueta: string; opciones: readonly T[]; valor: T | null; alElegir: (v: T) => void; deshabilitado?: boolean;
}) {
  return (
    <div className="ops" role="group" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button key={o} type="button" className="op" aria-pressed={o === valor} disabled={deshabilitado} onClick={() => alElegir(o)}>{o}</button>
      ))}
    </div>
  );
}

export function Etiqueta({ children, alQuitar, quitar, estilo }: { children: ReactNode; alQuitar: () => void; quitar: string; estilo?: CSSProperties }) {
  return (
    <span className="tg" style={estilo}>
      {children}
      <button type="button" className="x" aria-label={quitar} onClick={alQuitar}>×</button>
    </span>
  );
}

export function Casilla({ marcada, alCambiar, children }: { marcada: boolean; alCambiar: () => void; children: ReactNode }) {
  return (
    <button type="button" className="ck" role="checkbox" aria-checked={marcada} onClick={alCambiar}>
      <span className="bx"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg></span>
      <span>{children}</span>
    </button>
  );
}

export function Aviso({ children }: { children: ReactNode }) {
  return (
    <div className="wn fade" role="status">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
      {children}
    </div>
  );
}

/** Equipos que pueden llevar una figura o un evento. Texto fijo de la interfaz (ver docs/semilla.md). */
export const EQUIPOS = ['Equipo de análisis', 'Equipo de comunicaciones', 'Dirección de campaña', 'Enlace regional'] as const;
export type Equipo = (typeof EQUIPOS)[number];
