// Tablas del Informe. Cada tabla es un dato (TablaDatos) antes de ser HTML: el mismo objeto se pinta en el documento
// y se exporta al CSV ("una tabla, un bloque"). Las celdas numéricas se guardan crudas y se formatean al pintar.
import { num } from '../formato';
import { urlSegura } from '../url';
import { colorCanal } from './util';

export interface Columna { titulo: string; num?: boolean; ancho?: string }
export interface CeldaRica {
  texto: string;
  /** Punto de color del canal antes del texto. */
  canal?: string;
  enlace?: string | null;
  /** Segunda línea en gris. */
  nota?: string;
  fuerte?: boolean;
  /** Texto para el CSV si es distinto (p. ej. el número crudo). */
  csv?: string | number;
}
export type Celda = string | number | null | CeldaRica;
export interface TablaDatos {
  id: string;
  titulo: string;
  columnas: Columna[];
  filas: Celda[][];
  /** Fila de total, en negrita. */
  total?: Celda[];
  nota?: string;
  /** Texto cuando no hay filas. */
  vacio?: string;
}

const esRica = (c: Celda): c is CeldaRica => c != null && typeof c === 'object';
export function textoCelda(c: Celda): string {
  if (c == null) return '';
  if (typeof c === 'number') return num(c);
  if (typeof c === 'string') return c;
  return c.texto;
}
export function csvCelda(c: Celda): string {
  if (c == null) return '';
  if (typeof c === 'number') return String(c);
  if (typeof c === 'string') return c;
  return c.csv != null ? String(c.csv) : [c.texto, c.nota].filter(Boolean).join(' · ');
}

function Td({ c, col, th }: { c: Celda; col: Columna; th?: boolean }) {
  const cls = col.num ? 'n' : undefined;
  // Enlaces de los datos (o de una edición congelada vieja): solo http(s); javascript:, data: o relativos salen sin enlace.
  const href = esRica(c) ? urlSegura(c.enlace) : null;
  const cont = esRica(c) ? (
    <>
      <span className={c.canal && !c.nota && c.texto.length < 24 ? 'inf-c1 inf-nw' : 'inf-c1'}>
        {c.canal ? <i className="inf-dot" style={{ background: colorCanal(c.canal) }} aria-hidden="true" /> : null}
        {c.fuerte ? <b>{c.texto}</b> : c.texto}
        {href ? <> <a href={href} target="_blank" rel="noopener noreferrer">ver</a></> : null}
      </span>
      {c.nota ? <span className="inf-c2">{c.nota}</span> : null}
    </>
  ) : textoCelda(c);
  return th ? <th scope="row" className={cls}>{cont}</th> : <td className={cls}>{cont}</td>;
}

export function Tabla({ t }: { t: TablaDatos }) {
  return (
    <figure className={t.filas.length > 22 ? 'inf-tabla inf-larga' : 'inf-tabla'}>
      <figcaption className="inf-ft">{t.titulo}</figcaption>
      {t.filas.length ? (
        <div className="inf-tw">
          <table>
            <thead><tr>{t.columnas.map((c, i) => <th key={i} scope="col" className={c.num ? 'n' : undefined} style={c.ancho ? { width: c.ancho } : undefined}>{c.titulo}</th>)}</tr></thead>
            <tbody>
              {t.filas.map((f, i) => <tr key={i}>{f.map((c, j) => <Td key={j} c={c} col={t.columnas[j] ?? {}} th={j === 0} />)}</tr>)}
              {t.total ? <tr className="inf-tot">{t.total.map((c, j) => <Td key={j} c={c} col={t.columnas[j] ?? {}} th={j === 0} />)}</tr> : null}
            </tbody>
          </table>
        </div>
      ) : <p className="inf-vacio">{t.vacio ?? 'Sin filas en el periodo.'}</p>}
      {t.nota ? <p className="inf-nota">{t.nota}</p> : null}
    </figure>
  );
}

/** Celda de CSV sin inyección de fórmulas: lo que empieza con = + - @ tabulador o retorno lleva un apóstrofo delante.
 *  Excepción: un número negativo puro ("-12", "-3.5") queda como número. */
export function csvSeguro(s: string): string {
  if (/^-\d+(\.\d+)?$/.test(s)) return s;
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}
/** Todas las tablas como CSV: un bloque por tabla (título, encabezados, filas, total) separado por una línea vacía. */
export function tablasCsv(tablas: { seccion: string; tabla: TablaDatos }[], aviso?: string): string {
  const q = (s0: string) => { const s = csvSeguro(s0); return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lineas: string[] = [];
  if (aviso) lineas.push(q(aviso), '');
  for (const { seccion, tabla } of tablas) {
    lineas.push(q(`${seccion} · ${tabla.titulo}`));
    lineas.push(tabla.columnas.map((c) => q(c.titulo)).join(','));
    for (const f of tabla.filas) lineas.push(f.map((c) => q(csvCelda(c))).join(','));
    if (tabla.total) lineas.push(tabla.total.map((c) => q(csvCelda(c))).join(','));
    if (!tabla.filas.length) lineas.push(q(tabla.vacio ?? 'Sin filas'));
    lineas.push('');
  }
  return '﻿' + lineas.join('\r\n');
}
