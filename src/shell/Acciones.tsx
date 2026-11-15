// Acciones compartidas de la consola: avisos, buscador (Ctrl K), periodo, agregar URL y descargar reporte.
// Las pantallas solo usan useAcciones(); los paneles viven en src/shell/acciones/ y se montan una vez en <ProveedorAcciones>.
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Paneles } from './acciones/Paneles';

export interface Aviso { id: number; texto: string; enlace?: { texto: string; a: string } }
export type Panel =
  | { tipo: 'buscador' }
  | { tipo: 'periodo'; ancla: HTMLElement | null }
  | { tipo: 'url' }
  | { tipo: 'descarga'; reporte?: string };

export interface Acciones {
  /** Aviso breve abajo de la pantalla. Úsalo para confirmar que algo se guardó. */
  aviso: (texto: string, enlace?: { texto: string; a: string }) => void;
  abrirBuscador: () => void;
  abrirPeriodo: (ancla: HTMLElement | null) => void;
  /** Panel "Agregar URL": registra una mención a mano. */
  abrirAgregarUrl: () => void;
  /** Panel "Descargar reporte". `reporte` preselecciona el tipo. */
  abrirDescarga: (reporte?: string) => void;
  cerrarPanel: () => void;
  panel: Panel | null;
  /** Periodo elegido en la barra superior. Solo hay datos del periodo de la campaña por ahora. */
  periodo: string;
  setPeriodo: (p: string) => void;
}

const Ctx = createContext<Acciones | null>(null);
export function useAcciones(): Acciones {
  const a = useContext(Ctx);
  if (!a) throw new Error('useAcciones fuera de <ProveedorAcciones>');
  return a;
}

export function ProveedorAcciones({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [periodo, setPeriodo] = useState('Últimos 30 días');
  const sig = useRef(1);

  const aviso = useCallback((texto: string, enlace?: { texto: string; a: string }) => {
    const id = sig.current++;
    setAvisos((l) => [...l.slice(-2), { id, texto, enlace }]);
    window.setTimeout(() => setAvisos((l) => l.filter((x) => x.id !== id)), 4200);
  }, []);

  const valor = useMemo<Acciones>(() => ({
    aviso,
    abrirBuscador: () => setPanel({ tipo: 'buscador' }),
    abrirPeriodo: (ancla) => setPanel({ tipo: 'periodo', ancla }),
    abrirAgregarUrl: () => setPanel({ tipo: 'url' }),
    abrirDescarga: (reporte) => setPanel({ tipo: 'descarga', reporte }),
    cerrarPanel: () => setPanel(null),
    panel,
    periodo,
    setPeriodo,
  }), [aviso, panel, periodo]);

  return (
    <Ctx.Provider value={valor}>
      {children}
      <Paneles />
      <div className="avisos" role="status" aria-live="polite">
        {avisos.map((a) => (
          <div key={a.id} className="aviso">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>
            <span>{a.texto}{a.enlace ? <> <Link to={a.enlace.a}>{a.enlace.texto}</Link></> : null}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
