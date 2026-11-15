// Iconos de trazo de la demo. <Icono n="figuras" /> o <Icono d="M..." /> para un trazo propio.
export const TRAZOS = {
  resumen: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  figuras: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  eventos: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  menciones: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  temas: 'M4 9h16M4 15h16M10 3 8 21M16 3l-2 18',
  alertas: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  reportes: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7zM14 2v5h6M16 13H8M16 17H8',
  buscar: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  cuadricula: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  mas: 'M12 5v14M5 12h14',
  ok: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18M6 6l12 12',
  sig: 'm9 18 6-6-6-6',
  ant: 'm15 18-6-6 6-6',
  selector: 'm7 15 5 5 5-5M7 9l5-5 5 5',
  ir: 'M5 12h14m-6-6 6 6-6 6',
  salir: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  info: 'M12 16v-5M12 8h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
} as const;
export type NombreIcono = keyof typeof TRAZOS;

export function Icono({ n, d, t = 16, g = 1.75 }: { n?: NombreIcono; d?: string; t?: number; g?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={t} height={t} fill="none" stroke="currentColor" strokeWidth={g} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d ?? (n ? TRAZOS[n] : '')} />
    </svg>
  );
}

export function Logo({ t = 22 }: { t?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={t} height={t} fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M2 15 12 8h5a5 5 0 0 1 5 5v1a5 5 0 0 1-5 5H2zM16.5 11.5a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5z" />
      <path d="M11 6.5 12.75 2l1.75 4.5zM15.5 6.5 17.25 2 19 6.5z" />
    </svg>
  );
}
