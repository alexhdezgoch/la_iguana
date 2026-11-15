// Gráficos de la demo: polígonos en clip-path sobre un lienzo de ancho w y alto H.
// Solo geometría: los valores llegan de series_diarias.

type Punto = [number, number];

function pts(a: number[], w: number, h: number, top: number, mx: number): Punto[] {
  const n = Math.max(a.length - 1, 1);
  const m = mx || 1;
  return a.map((v, j) => [(j * w) / n, top + h - (v * h) / m]);
}
function poly(p: Punto[], w: number, H: number): string {
  return 'polygon(' + p.map((q) => `${((q[0] / w) * 100).toFixed(1)}% ${((q[1] / H) * 100).toFixed(1)}%`).join(',') + ')';
}
export const NADA = 'polygon(0 0,0 0,0 0)';

/** Banda entre dos series (lo abajo, hi arriba). */
export function banda(lo: number[], hi: number[], w: number, h: number, top: number, mx: number, H: number): string {
  if (hi.length < 2) return NADA;
  return poly(pts(hi, w, h, top, mx).concat(pts(lo, w, h, top, mx).reverse()), w, H);
}

/** Línea de grosor sw como polígono. */
export function linea(a: number[], w: number, h: number, top: number, mx: number, H: number, sw: number): string {
  if (a.length < 2) return NADA;
  const p = pts(a, w, h, top, mx);
  const up: Punto[] = [], dn: Punto[] = [];
  const nrm = (A: Punto, B: Punto): Punto => { const dx = B[0] - A[0], dy = B[1] - A[1], l = Math.sqrt(dx * dx + dy * dy) || 1; return [-dy / l, dx / l]; };
  p.forEach((q, j) => {
    const n1 = nrm(p[Math.max(j - 1, 0)], j ? q : p[1]);
    const n2 = nrm(j < p.length - 1 ? q : p[j - 1], p[Math.min(j + 1, p.length - 1)]);
    let mx_ = n1[0] + n2[0], my = n1[1] + n2[1];
    const l = Math.sqrt(mx_ * mx_ + my * my) || 1;
    mx_ /= l; my /= l;
    const k = sw / 2 / Math.max(mx_ * n1[0] + my * n1[1], 0.4);
    up.push([q[0] + mx_ * k, q[1] + my * k]);
    dn.push([q[0] - mx_ * k, q[1] - my * k]);
  });
  return poly(up.concat(dn.reverse()), w, H);
}

export const ceros = (n: number) => Array.from({ length: n }, () => 0);
export const sumar = (a: number[], b: number[]) => a.map((v, j) => v + (b[j] ?? 0));
export const maximo = (a: number[]) => (a.length ? Math.max(...a) : 0);

export interface Marca { x: number; texto: string; anclaje: 'start' | 'middle' | 'end' }

/**
 * Marcas de eventos sobre una serie de `dias` días: prioridad por volumen, sin que dos etiquetas se encimen.
 * `items` = [{ indice del día, texto, peso }].
 */
export function marcas(items: Array<{ i: number; texto: string; peso: number }>, dias: number, w: number, separacion: number): Marca[] {
  const puestas: Marca[] = [];
  const n = Math.max(dias - 1, 1);
  [...items].sort((a, b) => b.peso - a.peso).forEach((it) => {
    const x = (it.i / n) * w;
    if (puestas.some((p) => Math.abs(p.x - x) < separacion)) return;
    const anclaje = x > w - separacion / 2 ? 'end' : x < separacion / 2 ? 'start' : 'middle';
    puestas.push({ x, texto: it.texto, anclaje });
  });
  return puestas.sort((a, b) => a.x - b.x);
}
