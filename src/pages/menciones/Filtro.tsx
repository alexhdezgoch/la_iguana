// Botón de filtro con su menú de opciones (selección múltiple). El menú se monta en <body> para no quedar recortado.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icono } from '../../shell/Iconos';

export interface Opcion { valor: string; texto: string; cuenta: number }

export function Filtro({ nombre, todos, opciones, elegidos, cambiar, ancho = 280 }: {
  nombre: string;
  /** Texto cuando no hay nada elegido: "Todos" / "Todas". */
  todos: string;
  opciones: Opcion[];
  elegidos: string[];
  cambiar: (v: string[]) => void;
  ancho?: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);
  const caja = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; maxHeight: number } | null>(null);

  const nombres = opciones.filter((o) => elegidos.includes(o.valor)).map((o) => o.texto);
  const valor = !elegidos.length ? todos : elegidos.length === 1 ? (nombres[0] ?? '1 elegido') : `${elegidos.length} elegidos`;

  useLayoutEffect(() => {
    if (!abierto || !boton.current) return;
    const r = boton.current.getBoundingClientRect();
    const w = Math.min(ancho, window.innerWidth - 16);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    const top = r.bottom + 6;
    setPos({ left, top, maxHeight: Math.max(160, window.innerHeight - top - 8) });
  }, [abierto, ancho]);

  useEffect(() => {
    if (!abierto) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setAbierto(false); boton.current?.focus(); }
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && caja.current) {
        const os = Array.from(caja.current.querySelectorAll<HTMLButtonElement>('.fo'));
        const i = os.indexOf(document.activeElement as HTMLButtonElement);
        if (!os.length) return;
        e.preventDefault();
        os[(i + (e.key === 'ArrowDown' ? 1 : os.length - 1) + os.length) % os.length].focus();
      }
    };
    const cerrar = () => setAbierto(false);
    document.addEventListener('keydown', tecla);
    window.addEventListener('resize', cerrar);
    return () => { document.removeEventListener('keydown', tecla); window.removeEventListener('resize', cerrar); };
  }, [abierto]);

  useEffect(() => {
    if (abierto && pos) caja.current?.querySelector<HTMLButtonElement>('.fo')?.focus({ preventScroll: true });
  }, [abierto, pos]);

  const alternar = (v: string) => cambiar(elegidos.includes(v) ? elegidos.filter((x) => x !== v) : [...elegidos, v]);

  return (
    <>
      <button ref={boton} type="button" className="btn bg" style={{ fontWeight: 500 }} aria-haspopup="true" aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}>
        <span style={{ color: '#636C66' }}>{nombre}</span>{valor}<Icono d="m6 9 6 6 6-6" t={14} g={2} />
      </button>
      {abierto ? createPortal(
        <div className="pg-menciones-pop" onMouseDown={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); setAbierto(false); } }}>
          <div ref={caja} className="fp" role="dialog" aria-label={`Filtrar por ${nombre.toLowerCase()}`} style={{ width: ancho, ...(pos ?? { visibility: 'hidden' }) }}>
            <div className="fps">{nombre}{elegidos.length ? ` · ${elegidos.length} ${elegidos.length === 1 ? 'elegido' : 'elegidos'}` : ' · sin filtro'}</div>
            {opciones.length ? opciones.map((o) => (
              <button key={o.valor} type="button" className="fo" role="menuitemcheckbox" aria-checked={elegidos.includes(o.valor)} onClick={() => alternar(o.valor)}>
                <span className="fbx"><Icono n="ok" t={12} g={3} /></span>
                <span className="ft">{o.texto}</span>
                <span className="mu">{o.cuenta}</span>
              </button>
            )) : <div className="fvac mu">Sin opciones en esta campaña.</div>}
            <div className="fpf">
              <button type="button" className="enlace-btn" style={elegidos.length ? undefined : { visibility: 'hidden' }} onClick={() => cambiar([])}>Limpiar</button>
              <button type="button" className="enlace-btn" onClick={() => { setAbierto(false); boton.current?.focus(); }}>Listo</button>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
