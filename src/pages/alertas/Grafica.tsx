// Gráfica "Por qué se disparó": serie, umbral, rango habitual y punto de disparo (detalle.grafica de la alerta).
import { num } from '../../lib/formato';
import type { Campana, Json } from '../../lib/tipos';
import { momento } from './comun';

export function Grafica({ g, disparo, campana }: { g: Json; disparo: string; campana: Campana }) {
  const s: number[] = Array.isArray(g.serie) ? g.serie.filter((v: unknown) => typeof v === 'number') : [];
  if (s.length < 2) return null;
  const th: number | null = typeof g.umbral === 'number' ? g.umbral : null;
  const rg: [number, number] | null = Array.isArray(g.rango) && g.rango.length === 2 ? [g.rango[0], g.rango[1]] : null;
  const t = Math.min(Math.max(0, Number(g.indice_disparo ?? s.length - 1)), s.length - 1);
  const todos = [...s, ...(th != null ? [th] : []), ...(rg ?? [])];
  const lo = Math.min(...todos), hi = Math.max(...todos);
  const Y = (v: number) => +(132 - (hi === lo ? 0.5 : (v - lo) / (hi - lo)) * 116).toFixed(1);
  const X = (k: number) => +(44 + (k * 504) / (s.length - 1)).toFixed(1);
  const lab = (v: number) => (g.signo && v > 0 ? '+' : '') + (Math.abs(v) >= 10000 ? Math.round(v / 1000) + ' mil' : num(v));
  const mx = Math.max(...s), mn = Math.min(...s);
  const lejos = (v: number) => th == null || Math.abs(Y(v) - Y(th)) > 13;
  const metrica: string = g.metrica ?? 'Serie de la regla';
  const aria = `${metrica}: de ${lab(s[0])} a ${lab(s[s.length - 1])}${th != null ? `, umbral ${lab(th)}` : ''}, disparo ${disparo}`;
  const etiqueta = (v: number, txt: string, fuerte = false) => (
    <text x="38" y={Y(v) + 4} textAnchor="end" fontSize="11" fontWeight={fuerte ? 600 : undefined} fill={fuerte ? '#8F4A0B' : '#636C66'}>{txt}</text>
  );
  return (
    <>
      <div>
        <div role="img" aria-label={aria}>
          <svg viewBox="0 0 560 150" style={{ display: 'block', width: '100%', height: 'auto' }} aria-hidden="true">
            {rg ? <rect x="44" y={Y(rg[1])} width="504" height={(Y(rg[0]) - Y(rg[1])).toFixed(1)} rx="3" fill="#ECEFEA" /> : null}
            <path d="M44 138H548" stroke="rgb(22 32 25/.12)" />
            {th != null ? <path d={`M44 ${Y(th)}H548`} stroke="#8F4A0B" strokeWidth="1.25" strokeDasharray="5 4" /> : null}
            <path d={`M${X(t)} 10V138`} stroke="rgb(22 32 25/.25)" strokeDasharray="2 3" />
            <path d={s.map((v, k) => `${k ? 'L' : 'M'}${X(k)} ${Y(v)}`).join('')} fill="none" stroke="#285A32" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={X(t)} cy={Y(s[t])} r="5.5" fill="#D07A2D" stroke="#fff" strokeWidth="2" />
            {th != null ? etiqueta(th, lab(th), true) : null}
            {lejos(mx) ? etiqueta(mx, lab(mx)) : null}
            {lejos(mn) && mn !== mx ? etiqueta(mn, lab(mn)) : null}
          </svg>
        </div>
        <div className="mu" style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '8%' }}>
          <span>{momento(g.desde, campana)}</span><span>{momento(g.hasta, campana)}</span>
        </div>
      </div>
      <div className="mm mu">
        <span className="lg"><i style={{ background: '#285A32', height: 2 }} />{metrica}</span>
        {th != null ? <span className="lg"><i style={{ borderTop: '2px dashed #8F4A0B' }} />Umbral de la regla</span> : null}
        {rg ? <span className="lg"><i style={{ background: '#ECEFEA', height: 10 }} />Rango habitual</span> : null}
        <span className="lg"><i className="d du" style={{ width: 9, height: 9 }} />Disparo · {disparo}</span>
      </div>
    </>
  );
}
