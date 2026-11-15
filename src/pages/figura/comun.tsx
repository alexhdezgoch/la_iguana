// Piezas pequeñas de la ficha de figura: tipos derivados, helpers de texto y gráficas sin datos propios.
import type { Evento, FiguraCampana, Narrativa, Sentimiento } from '../../lib/tipos';
import { fecha, aFecha } from '../../lib/formato';

export const DIRECCION: Record<string, { texto: string; cls: string }> = {
  Favorable: { texto: 'A favor', cls: 'chip fav' },
  Desfavorable: { texto: 'En contra', cls: 'chip unf' },
  Posicionamiento: { texto: 'Posicionamiento', cls: 'chip watch' },
  'Sin dirección': { texto: 'Sin dirección', cls: 'chip watch' },
};

export const SENTIMIENTO: Record<Sentimiento, string> = { Favorable: 'chip fav', Neutral: 'chip watch', Desfavorable: 'chip unf' };

/** Un evento ligado a la figura: como participante (neto propio del evento) o como evento propio de la figura propia. */
export interface EventoFigura { evento: Evento; neto: number | null; rol: string | null }

export function cargoDe(f: FiguraCampana): string | null {
  const c = f.extra_campana?.cargo;
  return typeof c === 'string' && c.trim() ? c : f.cargo;
}

/** Responsable de la figura en la campaña: la persona (responsable_id) o, si no hay, el equipo de extra_campana.responsable_equipo. */
export function responsableDe(f: FiguraCampana, nombres: Map<string, { nombre_corto: string }>): string | null {
  if (f.responsable_id) return nombres.get(f.responsable_id)?.nombre_corto ?? 'Equipo de la campaña';
  const r = f.extra_campana?.responsable_equipo;
  return typeof r === 'string' && r.trim() ? r.trim() : null;
}

export function narrativasDe(todas: Narrativa[], figuraId: string): Narrativa[] {
  return todas
    .filter((n) => n.figura_id === figuraId || (Array.isArray(n.detalle?.figura_ids) && n.detalle.figura_ids.includes(figuraId)))
    .sort((a, b) => b.menciones - a.menciones);
}

const MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** "4 abr" · "10 a 14 may" · "28 abr a 2 may". */
export function fechaCorta(a: string | null, b: string | null): string {
  const x = aFecha(a), y = aFecha(b);
  if (!x) return 'Sin fecha';
  if (!y || x.getTime() === y.getTime()) return fecha(x, 'corto');
  if (x.getMonth() === y.getMonth() && x.getFullYear() === y.getFullYear()) return `${x.getDate()} a ${y.getDate()} ${MES3[y.getMonth()]}`;
  return `${fecha(x, 'corto')} a ${fecha(y, 'corto')}`;
}

/** Menciones por día: área con ejes mínimos. */
export function SerieDia({ puntos }: { puntos: Array<{ fecha: string; menciones: number }> }) {
  const n = puntos.length;
  const max = Math.max(1, ...puntos.map((p) => p.menciones));
  const W = 600, H = 160;
  const x = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => H - 8 - (v / max) * (H - 24);
  const linea = 'M' + puntos.map((p, i) => `${x(i).toFixed(1)} ${y(p.menciones).toFixed(1)}`).join(' L');
  const pico = puntos.reduce((m, p, i) => (p.menciones > puntos[m].menciones ? i : m), 0);
  return (
    <div className="fg-serie">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Menciones por día, ${n} días. Máximo ${max.toLocaleString('en-US')} el ${fecha(puntos[pico]?.fecha)}`}>
        <line x1="0" x2={W} y1={y(max)} y2={y(max)} stroke="rgb(22 32 25 / .08)" />
        <line x1="0" x2={W} y1={y(max / 2)} y2={y(max / 2)} stroke="rgb(22 32 25 / .08)" />
        <path d={`${linea} L${W} ${H} L0 ${H} Z`} fill="#E7F0E8" />
        <path d={linea} fill="none" stroke="#285A32" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="fg-eje mu">
        <span>{fecha(puntos[0]?.fecha, 'corto')}</span>
        <span>Pico: {puntos[pico]?.menciones.toLocaleString('en-US')} el {fecha(puntos[pico]?.fecha, 'corto')}</span>
        <span>{fecha(puntos[n - 1]?.fecha, 'corto')}</span>
      </div>
    </div>
  );
}
