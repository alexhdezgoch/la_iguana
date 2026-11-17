// Gráficos del Informe en SVG escrito a mano (sin bibliotecas): barras verticales, múltiplos pequeños por canal con su
// propia escala, barras por hora con franja del evento y líneas encima, barras horizontales, barras pareadas o agrupadas
// y barras apiladas al 100%. Cada gráfico lleva <title> y <desc> para lectores de pantalla.
// Las medidas están en unidades del viewBox (ancho 640) y el SVG ocupa el ancho de la columna.
import { useId, type ReactNode } from 'react';
import { num } from '../formato';
import { TINTA, pc } from './util';

const AN = 640;
const GRIS = '#6A737B', REJ = '#E3E7EA', EJE = '#9AA3AA';
const F = { fontFamily: 'inherit' } as const;

/** Escala "redonda": máximo y paso de las marcas del eje. */
export function escala(max: number, marcas = 4): { tope: number; paso: number } {
  if (!(max > 0)) return { tope: 1, paso: 1 };
  const bruto = max / marcas;
  const p10 = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * p10).find((p) => p >= bruto) ?? 10 * p10;
  return { tope: Math.ceil(max / paso) * paso, paso: Math.max(paso, 1e-9) };
}
const corto = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)} M` : num(n));

function Svg({ alto, titulo, desc, children }: { alto: number; titulo: string; desc?: string; children: ReactNode }) {
  const id = useId();
  return (
    <svg className="inf-svg" viewBox={`0 0 ${AN} ${alto}`} role="img" aria-labelledby={`${id}t ${id}d`} preserveAspectRatio="xMidYMid meet" style={F}>
      <title id={`${id}t`}>{titulo}</title>
      <desc id={`${id}d`}>{desc ?? titulo}</desc>
      {children}
    </svg>
  );
}

export function Leyenda({ items }: { items: { nombre: string; color: string; linea?: boolean }[] }) {
  return (
    <div className="inf-ley" aria-hidden="true">
      {items.map((i) => <span key={i.nombre}><i style={{ background: i.color, height: i.linea ? 3 : undefined }} />{i.nombre}</span>)}
    </div>
  );
}

function EjeY({ x0, x1, y, alto, tope, paso, rotulo }: { x0: number; x1: number; y: (v: number) => number; alto: number; tope: number; paso: number; rotulo?: string }) {
  const ms: number[] = [];
  for (let v = 0; v <= tope + paso / 2; v += paso) ms.push(v);
  return (
    <g>
      {ms.map((v) => (
        <g key={v}>
          <line x1={x0} x2={x1} y1={y(v)} y2={y(v)} stroke={v === 0 ? EJE : REJ} strokeWidth={1} />
          <text x={x0 - 6} y={y(v) + 4} fontSize={11} textAnchor="end" fill={GRIS}>{corto(v)}</text>
        </g>
      ))}
      {rotulo ? <text transform={`translate(12 ${alto / 2}) rotate(-90)`} fontSize={11} textAnchor="middle" fill={GRIS}>{rotulo}</text> : null}
    </g>
  );
}

/** Barras verticales de una serie (por día). `marcas`: sufijo por barra (p. ej. "*" si la recolección llegó al tope). */
export function Barras({ titulo, etiquetas, valores, color = TINTA, alto = 200, ejeY, ejeX, marcas }: {
  titulo: string; etiquetas: string[]; valores: number[]; color?: string; alto?: number; ejeY?: string; ejeX?: string; marcas?: string[];
}) {
  const izq = ejeY ? 64 : 48, der = 12, arr = 22, abj = ejeX ? 44 : 26;
  const { tope, paso } = escala(Math.max(0, ...valores));
  const y = (v: number) => arr + (alto - arr - abj) * (1 - v / tope);
  const n = Math.max(1, valores.length), ancho = (AN - izq - der) / n, b = Math.min(ancho * 0.62, 110);
  return (
    <Svg alto={alto} titulo={titulo} desc={etiquetas.map((e, i) => `${e}: ${num(valores[i])}`).join('; ')}>
      <EjeY x0={izq} x1={AN - der} y={y} alto={alto} tope={tope} paso={paso} rotulo={ejeY} />
      {valores.map((v, i) => {
        const cx = izq + ancho * i + ancho / 2;
        return (
          <g key={i}>
            <rect x={cx - b / 2} y={y(v)} width={b} height={Math.max(0, y(0) - y(v))} fill={color} />
            <text x={cx} y={y(v) - 6} fontSize={12} textAnchor="middle" fill="#1B2125">{num(v)}{marcas?.[i] ?? ''}</text>
            <text x={cx} y={alto - abj + 16} fontSize={11} textAnchor="middle" fill={GRIS}>{etiquetas[i]}</text>
          </g>
        );
      })}
      {ejeX ? <text x={(izq + AN - der) / 2} y={alto - 6} fontSize={11} textAnchor="middle" fill={GRIS}>{ejeX}</text> : null}
    </Svg>
  );
}

/** Un panel pequeño (barras sin eje, con el valor encima y su propia escala). */
function Mini({ titulo, etiquetas, valores, color, marcas }: { titulo: string; etiquetas: string[]; valores: number[]; color: string; marcas?: string[] }) {
  const W = 200, H = 96, arr = 16, abj = 18;
  const max = Math.max(1, ...valores);
  const n = Math.max(1, valores.length), ancho = W / n, b = Math.min(ancho * 0.6, 34);
  const y = (v: number) => arr + (H - arr - abj) * (1 - v / max);
  const id = useId();
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={id} className="inf-svg" style={F}>
      <title id={id}>{`${titulo}: ${etiquetas.map((e, i) => `${e} ${num(valores[i])}`).join(', ')}`}</title>
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke={EJE} />
      {valores.map((v, i) => {
        const cx = ancho * i + ancho / 2;
        return (
          <g key={i}>
            <rect x={cx - b / 2} y={y(v)} width={b} height={Math.max(v > 0 ? 1 : 0, y(0) - y(v))} fill={color} />
            <text x={cx} y={y(v) - 4} fontSize={10} textAnchor="middle" fill="#1B2125">{num(v)}{marcas?.[i] ?? ''}</text>
            <text x={cx} y={H - 4} fontSize={9} textAnchor="middle" fill={GRIS}>{etiquetas[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Múltiplos pequeños: un panel por canal, cada uno con su propia escala. */
export function Multiples({ paneles, etiquetas }: { paneles: { titulo: string; color: string; valores: number[]; marcas?: string[] }[]; etiquetas: string[] }) {
  return (
    <div className="inf-mult">
      {paneles.map((p) => (
        <div key={p.titulo}>
          <div className="inf-mult-t"><i style={{ background: p.color }} />{p.titulo}</div>
          <Mini titulo={p.titulo} etiquetas={etiquetas} valores={p.valores} color={p.color} marcas={p.marcas} />
        </div>
      ))}
    </div>
  );
}

/**
 * Por hora (0–23): barras (opcional) con franja sombreada del evento y líneas encima (una o varias series).
 * `banda` en horas decimales (8.5 = 08:30).
 */
export function PorHora({ titulo, barras, lineas = [], banda, bandaRotulo, colorBarras = TINTA_BARRA, alto = 250, ejeY = 'Publicaciones', ejeX }: {
  titulo: string; barras?: number[]; lineas?: { nombre: string; valores: number[]; color: string }[];
  banda?: { desde: number; hasta: number } | null; bandaRotulo?: string; colorBarras?: string; alto?: number; ejeY?: string; ejeX?: string;
}) {
  const izq = 64, der = 12, arr = 22, abj = 40;
  const max = Math.max(0, ...(barras ?? []), ...lineas.flatMap((l) => l.valores));
  const { tope, paso } = escala(max);
  const y = (v: number) => arr + (alto - arr - abj) * (1 - v / tope);
  const ancho = (AN - izq - der) / 24;
  const x = (h: number) => izq + ancho * h;
  const desc = barras ? barras.map((v, h) => `${h}h: ${num(v)}`).join('; ') : lineas.map((l) => `${l.nombre}: pico ${num(Math.max(...l.valores))}`).join('; ');
  return (
    <Svg alto={alto} titulo={titulo} desc={desc}>
      {banda ? <rect x={x(banda.desde)} y={arr} width={Math.max(3, x(banda.hasta) - x(banda.desde))} height={alto - arr - abj} fill="#DCE4EA" /> : null}
      {banda && bandaRotulo ? <text x={x(banda.desde) + 3} y={arr - 6} fontSize={11} fill={GRIS}>{bandaRotulo}</text> : null}
      <EjeY x0={izq} x1={AN - der} y={y} alto={alto} tope={tope} paso={paso} rotulo={ejeY} />
      {barras?.map((v, h) => (
        <g key={h}>
          <rect x={x(h) + ancho * 0.14} y={y(v)} width={ancho * 0.72} height={Math.max(0, y(0) - y(v))} fill={colorBarras} />
          {v === Math.max(...barras) && v > 0 ? <text x={x(h) + ancho / 2} y={y(v) - 5} fontSize={11} textAnchor="middle" fill="#1B2125">{num(v)}</text> : null}
        </g>
      ))}
      {lineas.map((l) => (
        <polyline key={l.nombre} fill="none" stroke={l.color} strokeWidth={2} strokeLinejoin="round"
          points={l.valores.map((v, h) => `${x(h) + ancho / 2},${y(v)}`).join(' ')} />
      ))}
      {Array.from({ length: 24 }, (_, h) => <text key={h} x={x(h) + ancho / 2} y={alto - abj + 15} fontSize={10} textAnchor="middle" fill={GRIS}>{h}</text>)}
      {ejeX ? <text x={(izq + AN - der) / 2} y={alto - 6} fontSize={11} textAnchor="middle" fill={GRIS}>{ejeX}</text> : null}
    </Svg>
  );
}
const TINTA_BARRA = '#B9C2C9';

/** Barras horizontales: una fila por categoría, valor al final de la barra. */
export function BarrasH({ titulo, filas, formato = num, color = TINTA, ejeX, izq = 170 }: {
  titulo: string; filas: { etiqueta: string; valor: number; color?: string; texto?: string }[]; formato?: (n: number) => string; color?: string; ejeX?: string; izq?: number;
}) {
  const fila = 24, arr = 6, abj = ejeX ? 26 : 8;
  const alto = arr + filas.length * fila + abj;
  const max = Math.max(1, ...filas.map((f) => f.valor));
  const w = (v: number) => ((AN - izq - 80) * v) / max;
  return (
    <Svg alto={alto} titulo={titulo} desc={filas.map((f) => `${f.etiqueta}: ${f.texto ?? formato(f.valor)}`).join('; ')}>
      <line x1={izq} x2={izq} y1={arr} y2={alto - abj} stroke={EJE} />
      {filas.map((f, i) => {
        const yy = arr + i * fila;
        return (
          <g key={i}>
            <text x={izq - 8} y={yy + fila / 2 + 4} fontSize={11.5} textAnchor="end" fill="#3A4247">{recorta(f.etiqueta, Math.floor(izq / 6.2))}</text>
            <rect x={izq} y={yy + 4} width={Math.max(f.valor > 0 ? 1.5 : 0, w(f.valor))} height={fila - 8} fill={f.color ?? color} />
            <text x={izq + w(f.valor) + 6} y={yy + fila / 2 + 4} fontSize={11.5} fill="#1B2125">{f.texto ?? formato(f.valor)}</text>
          </g>
        );
      })}
      {ejeX ? <text x={(izq + AN) / 2} y={alto - 6} fontSize={11} textAnchor="middle" fill={GRIS}>{ejeX}</text> : null}
    </Svg>
  );
}
const recorta = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/** Barras horizontales agrupadas: varias series por categoría (base frente a evento, % por red). */
export function BarrasPareadas({ titulo, filas, series, formato = num, izq = 120 }: {
  titulo: string; filas: { etiqueta: string; valores: (number | null)[] }[]; series: { nombre: string; color: string }[]; formato?: (n: number) => string; izq?: number;
}) {
  const barra = 11, gap = 3, sep = 10;
  const bloque = series.length * (barra + gap) + sep;
  const alto = filas.length * bloque + 8;
  const max = Math.max(1, ...filas.flatMap((f) => f.valores.map((v) => v ?? 0)));
  const w = (v: number) => ((AN - izq - 90) * v) / max;
  return (
    <>
      <Leyenda items={series} />
      <Svg alto={alto} titulo={titulo} desc={filas.map((f) => `${f.etiqueta}: ${f.valores.map((v, i) => `${series[i].nombre} ${v == null ? 'sin datos' : formato(v)}`).join(', ')}`).join('; ')}>
        <line x1={izq} x2={izq} y1={0} y2={alto - 4} stroke={EJE} />
        {filas.map((f, i) => {
          const y0 = 4 + i * bloque;
          return (
            <g key={i}>
              <text x={izq - 8} y={y0 + (series.length * (barra + gap)) / 2 + 4} fontSize={11.5} textAnchor="end" fill="#3A4247">{recorta(f.etiqueta, 22)}</text>
              {f.valores.map((v, j) => (
                <g key={j}>
                  <rect x={izq} y={y0 + j * (barra + gap)} width={v ? Math.max(1.5, w(v)) : 0} height={barra} fill={series[j].color} />
                  <text x={izq + (v ? w(v) : 0) + 5} y={y0 + j * (barra + gap) + barra - 1.5} fontSize={10.5} fill="#1B2125">{v == null ? 'sin datos' : formato(v)}</text>
                </g>
              ))}
            </g>
          );
        })}
      </Svg>
    </>
  );
}

/** Barras apiladas al 100% (favorable / crítico / neutral, o el peso de cada eje). Rótulo dentro si cabe. */
export function Apiladas({ titulo, filas, series, izq = 180 }: {
  titulo: string; filas: { etiqueta: string; partes: (number | null)[] }[]; series: { nombre: string; color: string; claro?: boolean }[]; izq?: number;
}) {
  const fila = 26, alto = filas.length * fila + 6;
  const util = AN - izq - 10;
  return (
    <>
      <Svg alto={alto} titulo={titulo} desc={filas.map((f) => { const t = f.partes.reduce<number>((s, p) => s + (p ?? 0), 0) || 1; return `${f.etiqueta}: ${f.partes.map((p, i) => `${series[i].nombre} ${pc(((p ?? 0) / t) * 100)}`).join(', ')}`; }).join('; ')}>
        {filas.map((f, i) => {
          const tot = f.partes.reduce<number>((s, p) => s + (p ?? 0), 0) || 1;
          let acc = 0;
          const y0 = 3 + i * fila;
          return (
            <g key={i}>
              <text x={izq - 8} y={y0 + fila / 2 + 3} fontSize={11.5} textAnchor="end" fill="#3A4247">{recorta(f.etiqueta, Math.floor(izq / 6.2))}</text>
              {f.partes.map((p, j) => {
                const ancho = ((p ?? 0) / tot) * util;
                const x = izq + acc;
                acc += ancho;
                const s = series[j];
                return (
                  <g key={j}>
                    <rect x={x} y={y0 + 2} width={ancho} height={fila - 6} fill={s.color} />
                    {ancho > 30 ? <text x={x + ancho / 2} y={y0 + fila / 2 + 3} fontSize={11} textAnchor="middle" fill={s.claro ? '#1B2125' : '#fff'}>{pc(((p ?? 0) / tot) * 100)}</text> : null}
                  </g>
                );
              })}
            </g>
          );
        })}
      </Svg>
      <Leyenda items={series} />
    </>
  );
}
