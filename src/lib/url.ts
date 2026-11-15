// Enlaces que vienen de los datos (menciones.url, cuentas de figuras, evidencia): solo http(s).
// La base ya rechaza menciones.url que no empiecen por http(s):// (900_acceso.sql); esto cubre lo demás
// y cualquier dato viejo. Uso: const href = urlSegura(m.url); {href ? <a href={href} …> : texto}

/** Devuelve la URL normalizada si es http o https; si no (javascript:, data:, relativa, vacía), null. */
export function urlSegura(url: string | null | undefined): string | null {
  const s = String(url ?? '').trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}
