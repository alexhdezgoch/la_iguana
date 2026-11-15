// Permiso para las pantallas de alta (Agregar figura, Crear evento).
// useRol() no dice si sigue cargando; aquí sí, para no mostrar "sin permiso" mientras llega el rol.
import { Link } from 'react-router-dom';
import { db } from '../../lib/db';
import { useConsulta } from '../../lib/hooks';
import type { RolCampana } from '../../lib/tipos';

export interface Permiso { rol: RolCampana | null; puedeEditar: boolean; puedeAdministrar: boolean; cargando: boolean; error: string | null }

export function usePermiso(campanaId: string): Permiso {
  const r = useConsulta<RolCampana | null>(() => db.rpc<RolCampana | null>('mi_rol', { p_campana: campanaId }), [campanaId], null);
  return {
    rol: r.datos,
    puedeEditar: r.datos === 'Administración' || r.datos === 'Análisis',
    puedeAdministrar: r.datos === 'Administración',
    cargando: r.cargando,
    error: r.error,
  };
}

/** Tarjeta para los roles que no pueden escribir: dice por qué y lleva de vuelta a la lista. */
export function SinPermiso({ rol, accion, volver, volverTexto }: { rol: RolCampana | null; accion: string; volver: string; volverTexto: string }) {
  return (
    <section className="card vacio" role="status">
      <h2>No puedes {accion} en esta campaña</h2>
      <p className="mu">
        {rol ? `Tu rol es ${rol}: puedes consultar, pero no crear ni cambiar datos.` : 'No tienes un rol asignado en esta campaña.'}{' '}
        Pide a Administración el rol de Análisis si necesitas hacerlo.
      </p>
      <div style={{ paddingTop: 6 }}><Link className="btn bg" to={volver}>{volverTexto}</Link></div>
    </section>
  );
}

/** Texto sin acentos, en minúsculas y sin @ inicial, para comparar nombres y cuentas. */
export function normal(s: string | null | undefined): string {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^@/, '').trim();
}
