// Acciones compartidas de la consola: avisos, buscador (Ctrl K), periodo, agregar URL y descargar reporte.
// Las pantallas solo usan useAcciones(); los paneles viven en src/shell/acciones/ y se montan una vez en <ProveedorAcciones>.
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Paneles } from './acciones/Paneles';
import { useCampanaDeRuta } from './acciones/Buscador';
import { nombrePeriodo } from './acciones/Periodo';
import { useCampanas } from './Campana';

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
  /**
   * Periodo de la barra superior. Por defecto, el periodo guardado de la campaña actual (nombrePeriodo: "Últimos 30 días");
   * en las vistas del equipo, el de las campañas si todas comparten corte. Solo hay datos de ese periodo por ahora.
   */
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
  // Lo elegido vale para la campaña en la que se eligió; al cambiar de campaña vuelve a su periodo guardado.
  const actual = useCampanaDeRuta();
  const { campanas } = useCampanas();
  const clave = actual?.id ?? '';
  const [elegido, setElegido] = useState<{ clave: string; texto: string } | null>(null);
  const defecto = useMemo(() => {
    if (actual) return nombrePeriodo(actual) ?? 'Sin periodo con datos';
    const nombres = [...new Set(campanas.map((c) => nombrePeriodo(c)).filter((t): t is string => !!t))];
    return nombres.length === 1 ? nombres[0] : nombres.length ? 'Periodo de cada campaña' : 'Sin periodo con datos';
  }, [actual, campanas]);
  const periodo = elegido && elegido.clave === clave ? elegido.texto : defecto;
  const setPeriodo = useCallback((texto: string) => setElegido({ clave, texto }), [clave]);
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
  }), [aviso, panel, periodo, setPeriodo]);

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
