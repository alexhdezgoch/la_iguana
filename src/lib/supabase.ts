import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const clave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Falta configuración: la app muestra un aviso en vez de fallar en blanco. */
export const sinConfigurar = !url || !clave;

export const supabase = createClient(url || 'http://sin-configurar.invalid', clave || 'sin-configurar', {
  auth: { persistSession: true, autoRefreshToken: true },
});
