import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { db } from '../lib/db';
import type { Organizacion, Persona } from '../lib/tipos';

export interface Sesion {
  cargando: boolean;
  /** Cuenta con la que se entró. null = sin sesión. */
  usuario: { id: string; email: string } | null;
  /** Persona del equipo ligada a la cuenta. null con sesión = la cuenta no está en ningún equipo. */
  persona: Persona | null;
  org: Organizacion | null;
  salir: () => Promise<void>;
}

const Ctx = createContext<Sesion | null>(null);
export function useSesion(): Sesion {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSesion fuera de <ProveedorSesion>');
  return s;
}

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Sesion['usuario']>(null);
  const [listo, setListo] = useState(false);
  const [contexto, setContexto] = useState<{ persona: Persona; org: Organizacion } | null>(null);
  const [contextoListo, setContextoListo] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      setUsuario(u ? { id: u.id, email: u.email ?? '' } : null);
      setListo(true);
    }).catch(() => setListo(true));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      const u = s?.user;
      setUsuario((prev) => (u ? (prev?.id === u.id ? prev : { id: u.id, email: u.email ?? '' }) : null));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const uid = usuario?.id;
  useEffect(() => {
    setContextoListo(false);
    if (!uid) { setContexto(null); return; }
    let vivo = true;
    db.rpc<{ persona: Persona; org: Organizacion } | null>('mi_contexto')
      .then((c) => { if (vivo) { setContexto(c?.persona ? c : null); setContextoListo(true); } })
      .catch(() => { if (vivo) { setContexto(null); setContextoListo(true); } });
    return () => { vivo = false; };
  }, [uid]);

  const valor = useMemo<Sesion>(() => ({
    cargando: !listo || (!!usuario && !contextoListo),
    usuario,
    persona: contexto?.persona ?? null,
    org: contexto?.org ?? null,
    salir: async () => { await supabase.auth.signOut(); },
  }), [listo, usuario, contexto, contextoListo]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
