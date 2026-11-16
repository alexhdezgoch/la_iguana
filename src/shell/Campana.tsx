import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../lib/db';
import { useConsulta, useTabla } from '../lib/hooks';
import type { Campana, CampanaResumen, RolCampana } from '../lib/tipos';

// ---------- todas las campañas que la persona puede ver ----------
interface CtxCampanas { campanas: Campana[]; resumenes: CampanaResumen[]; cargando: boolean; error: string | null }
const CampanasCtx = createContext<CtxCampanas>({ campanas: [], resumenes: [], cargando: true, error: null });
/** Campañas visibles y su resumen (figura propia, alertas abiertas, menciones por revisar). */
export function useCampanas(): CtxCampanas { return useContext(CampanasCtx); }

export function ProveedorCampanas({ children }: { children: ReactNode }) {
  const c = useTabla<Campana>('campanas', { orden: 'orden' });
  const r = useTabla<CampanaResumen>('v_campanas_resumen', { orden: 'orden' });
  const valor = useMemo(() => ({ campanas: c.datos, resumenes: r.datos, cargando: c.cargando, error: c.error }), [c.datos, r.datos, c.cargando, c.error]);
  return <CampanasCtx.Provider value={valor}>{children}</CampanasCtx.Provider>;
}

// ---------- campaña actual (rutas /c/:campanaId/...) ----------
/** Campaña de la ruta actual, o null fuera de /c/:campanaId (Panorama, Nueva campaña). */
export function useCampanaOpcional(): Campana | null {
  const { campanaId } = useParams();
  const { campanas } = useCampanas();
  return campanas.find((c) => c.id === campanaId) ?? null;
}
/** Campaña de la ruta actual. Solo en pantallas bajo /c/:campanaId: el Layout no las pinta hasta que la campaña cargó. */
export function useCampana(): Campana {
  const c = useCampanaOpcional();
  if (!c) throw new Error('useCampana fuera de una ruta de campaña');
  return c;
}
/** "Hoy" para los datos: la fecha de corte de la campaña de ejemplo, o la fecha real. Formato AAAA-MM-DD. */
export function hoyDe(c: { fecha_corte: string | null } | null): string {
  if (c?.fecha_corte) return c.fecha_corte;
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Rol de la persona en la campaña actual. `puedeEditar` es false para Solo lectura y Cliente:
 * úsalo para deshabilitar o esconder los controles que escriben. La base rechaza el cambio de todos modos.
 */
export function useRol(): { rol: RolCampana | null; puedeEditar: boolean; puedeAdministrar: boolean; esCliente: boolean } {
  const c = useCampanaOpcional();
  const { datos } = useConsulta<RolCampana | null>(() => (c ? db.rpc<RolCampana | null>('mi_rol', { p_campana: c.id }) : Promise.resolve(null)), [c?.id], null);
  return { rol: datos, puedeEditar: datos === 'Administración' || datos === 'Análisis', puedeAdministrar: datos === 'Administración', esCliente: datos === 'Cliente' };
}

// ---------- título y migas de la pantalla ----------
export interface Miga { texto: string; a?: string }
interface CtxPagina { titulo: string; migas: Miga[]; fijar: (titulo: string, migas: Miga[]) => void }
const PaginaCtx = createContext<CtxPagina>({ titulo: '', migas: [], fijar: () => {} });
export function usePaginaActual() { return useContext(PaginaCtx); }

export function ProveedorPagina({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<{ titulo: string; migas: Miga[] }>({ titulo: '', migas: [] });
  const valor = useMemo<CtxPagina>(() => ({
    ...estado,
    fijar: (titulo, migas) => setEstado((p) => (p.titulo === titulo && JSON.stringify(p.migas) === JSON.stringify(migas) ? p : { titulo, migas })),
  }), [estado]);
  return <PaginaCtx.Provider value={valor}>{children}</PaginaCtx.Provider>;
}

/**
 * Cada pantalla lo llama una vez: fija el título de la pestaña y la última miga de la barra superior.
 * `migas` son migas intermedias opcionales, p. ej. usePagina('Primer debate', [{ texto: 'Eventos', a: `/c/${id}/eventos` }]).
 */
export function usePagina(titulo: string, migas: Miga[] = []) {
  const { fijar } = useContext(PaginaCtx);
  const clave = JSON.stringify(migas);
  useEffect(() => {
    fijar(titulo, migas);
    document.title = titulo ? `Wana · ${titulo}` : 'Wana';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titulo, clave, fijar]);
}
