// Piezas compartidas por las secciones de la vista compacta.
import type { ReactNode } from 'react';
import { Cargando, ErrorDatos } from '../../shell/Estados';
import type { Campana, FiguraCampana } from '../../lib/tipos';

export const DIRECCION: Record<string, { texto: string; cls: string }> = {
  Favorable: { texto: 'A favor', cls: 'chip fav' },
  Desfavorable: { texto: 'En contra', cls: 'chip unf' },
  Posicionamiento: { texto: 'Posicionamiento', cls: 'chip watch' },
  'Sin dirección': { texto: 'Sin dirección', cls: 'chip watch' },
};

/** Lo que cada sección necesita de la pantalla. */
export interface Ctx {
  campana: Campana;
  base: string;
  hoy: string;
  /** Figuras de la campaña, en el orden de la campaña. */
  figuras: FiguraCampana[];
  propia: FiguraCampana | null;
  puedeEditar: boolean;
}

/** Total de la conversación de la campaña, derivado del corte de la figura propia (menciones / participación). */
export function totalConversacion(propia: FiguraCampana | null): number | null {
  if (!propia || !propia.participacion || !propia.menciones) return null;
  return Math.round((propia.menciones * 100) / propia.participacion);
}

/** Último apellido, para encabezados cortos ("Neto de Rosales"). */
export function apellido(nombre: string): string {
  const p = nombre.trim().split(/\s+/);
  return p[p.length - 1] ?? nombre;
}

export function cargoDe(f: FiguraCampana): string | null {
  const c = f.extra_campana?.cargo;
  return typeof c === 'string' && c ? c : f.cargo;
}

/** "a, b y c" */
export function enLista(xs: string[]): string {
  if (xs.length <= 1) return xs.join('');
  return `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`;
}

export function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

/** Línea de menciones por día, en el estilo de la demo. */
export function Tendencia({ serie }: { serie: number[] }) {
  if (serie.length < 2) return null;
  const max = Math.max(...serie), min = Math.min(...serie);
  const y = (v: number) => (max === min ? 28 : 46 - ((v - min) / (max - min)) * 36);
  const pts = serie.map((v, i) => `${((i / (serie.length - 1)) * 220).toFixed(1)} ${y(v).toFixed(1)}`);
  const linea = 'M' + pts.join(' L');
  return (
    <svg viewBox="0 0 220 56" height="56" preserveAspectRatio="none" role="img" aria-label={`Menciones por día en los últimos ${serie.length} días`} style={{ flex: '1 1 200px', minWidth: 0, maxWidth: 340 }}>
      <path d={`${linea} L220 56 L0 56 Z`} fill="#E7F0E8" />
      <path d={linea} fill="none" stroke="#285A32" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Como <Carga>, pero dentro de la pantalla (sin otro <main>): las secciones cargan bajo las pestañas. */
export function CargaSeccion({ estados, children }: { estados: Array<{ cargando: boolean; error: string | null }>; children: ReactNode }) {
  const error = estados.find((e) => e.error)?.error;
  if (error) return <ErrorDatos error={error} />;
  if (estados.some((e) => e.cargando)) return <Cargando />;
  return <>{children}</>;
}
