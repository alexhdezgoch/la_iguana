import { useCallback, useEffect, useRef, useState } from 'react';
import { alCambiar, db, type Opciones } from './db';

export interface Estado<T> {
  datos: T;
  cargando: boolean;
  error: string | null;
  recargar: () => void;
}

/** Corre una consulta asíncrona y la repite cuando cambian `deps` o alguna de las `tablas` indicadas. */
export function useConsulta<T>(fn: () => Promise<T>, deps: unknown[], inicial: T, tablas: string[] = []): Estado<T> {
  const [datos, setDatos] = useState<T>(inicial);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const ref = useRef(fn);
  ref.current = fn;
  const recargar = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let vivo = true;
    ref.current()
      .then((d) => { if (vivo) { setDatos(d); setError(null); setCargando(false); } })
      .catch((e: unknown) => { if (vivo) { setError(e instanceof Error ? e.message : String(e)); setCargando(false); } });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const clave = tablas.join(',');
  useEffect(() => {
    const bajas = clave ? clave.split(',').map((t) => alCambiar(t, recargar)) : [];
    return () => bajas.forEach((b) => b());
  }, [clave, recargar]);

  return { datos, cargando, error, recargar };
}

/** Filas de una tabla. Si `activo` es false no consulta (útil mientras falta un id). */
export function useTabla<T>(tabla: string, opciones?: Opciones, activo = true): Estado<T[]> {
  const clave = JSON.stringify(opciones ?? {});
  return useConsulta<T[]>(
    () => (activo ? db.listar<T>(tabla, opciones) : Promise.resolve([])),
    [tabla, clave, activo],
    [],
    [tabla],
  );
}

/** Una fila por id. */
export function useFila<T>(tabla: string, id: string | undefined | null): Estado<T | null> {
  return useConsulta<T | null>(() => (id ? db.uno<T>(tabla, id) : Promise.resolve(null)), [tabla, id], null, [tabla]);
}

/** Cuenta filas sin traerlas. */
export function useCuenta(tabla: string, opciones?: Opciones, activo = true): Estado<number> {
  const clave = JSON.stringify(opciones ?? {});
  return useConsulta<number>(() => (activo ? db.contar(tabla, opciones) : Promise.resolve(0)), [tabla, clave, activo], 0, [tabla]);
}
