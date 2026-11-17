// El Informe completo a partir de InformeDatos (informe_datos) y los textos de quien analiza.
// Un solo árbol para la vista previa de la app, la impresión del navegador, la descarga HTML y el PDF sin pantalla
// (rig/informe-pdf.mjs). Primero se arma un modelo (secciones con bloques: textos, tablas, figuras) y luego se pinta;
// el CSV sale de las mismas tablas del modelo.
import type { ReactNode } from 'react';
import { fecha, num } from '../formato';
import { AVISO_DEMO } from '../reportes/marca';
import { urlSegura } from '../url';
import { hallazgos, textoAuto } from './hallazgos';
import { Apiladas, Barras, BarrasH, BarrasPareadas, Leyenda, Multiples, PorHora } from './graficos';
import { Tabla, type Celda, type TablaDatos } from './Tabla';
import type { CuentaVisible, Destacada, InformeDatos, PublicacionInforme, SerieCanal, SeccionConfig, SeccionId } from './tipos';
import {
  SENT, TINTA, TINTA_SUAVE, TONO_CODIGO, canalTxt, colorCanal, diaColumna, diaEje, diaLargo, ejeNombre, enLista, fragmento, hh, iDia,
  momentoInf, nombrePeriodo, parte, pc, principal, sobre, suma, totalCanal, totalSerie,
} from './util';

export const PIE = 'Información confidencial. Para uso exclusivo de sus destinatarios.';

/** Secciones del Informe, en orden. */
export const SECCIONES: { id: SeccionId; titulo: string }[] = [
  { id: 'resumen', titulo: 'Resumen ejecutivo' },
  { id: 'volumen', titulo: 'Volumen en el tiempo' },
  { id: 'alcance', titulo: 'Alcance e interacción' },
  { id: 'reparto', titulo: 'Reparto por plataforma' },
  { id: 'ejes', titulo: 'Ejes' },
  { id: 'sentimiento', titulo: 'Sentimiento y temas' },
  { id: 'publicaciones', titulo: 'Publicaciones y voces destacadas' },
  { id: 'medios', titulo: 'Cobertura de medios' },
  { id: 'comparacion', titulo: 'Comparación' },
  { id: 'metodologia', titulo: 'Metodología y límites' },
];
/** Secciones que empiezan en página nueva al imprimir (como en los informes de muestra). */
const SALTO = new Set<string>(['resumen', 'volumen', 'ejes', 'publicaciones']);

/** Configuración de secciones con los valores por defecto: Ejes solo en modo tema, Comparación solo si hay eje de comparación. */
export function seccionesDe(d: Pick<InformeDatos, 'secciones' | 'modo' | 'comparacion'>): SeccionConfig[] {
  const guard = new Map((d.secciones ?? []).map((s) => [s.id, s]));
  // Orden: el de la configuración (las conocidas), luego las que falten en el orden por defecto.
  const ids = [...(d.secciones ?? []).map((s) => s.id).filter((id) => SECCIONES.some((x) => x.id === id)), ...SECCIONES.map((x) => x.id)];
  const orden = SECCIONES.slice().sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  return orden.map(({ id, titulo }) => {
    const g = guard.get(id);
    const porDefecto = id === 'ejes' ? d.modo === 'tema' : id === 'comparacion' ? !!d.comparacion : true;
    return { id, titulo: g?.titulo || titulo, activa: g ? g.activa !== false : porDefecto, texto: g?.texto ?? '' };
  });
}
/** Texto de una sección: el de la edición, el guardado por quien analiza o, si no hay, los hallazgos automáticos. */
export function textoDe(d: InformeDatos, id: SeccionId, textos?: Record<string, string>): string {
  const t = textos?.[id] ?? (d.secciones ?? []).find((s) => s.id === id)?.texto;
  return t && t.trim() ? t : textoAuto(d, id);
}

// ---------- modelo ----------
type Bloque =
  | { t: 'p'; texto: string; nota?: boolean }
  | { t: 'h3'; texto: string }
  | { t: 'hallazgos'; items: string[] }
  | { t: 'kpis'; items: { valor: string; etiqueta: string; color: string }[] }
  | { t: 'tabla'; tabla: TablaDatos }
  | { t: 'fig'; titulo: string; nodo: ReactNode; fuente?: string }
  | { t: 'lista'; items: ReactNode[] }
  | { t: 'vacio'; texto: string };
export interface SeccionModelo { id: SeccionId; n: number; titulo: string; salto: boolean; bloques: Bloque[] }
export interface Modelo { d: InformeDatos; secciones: SeccionModelo[] }

const sinPunto = (t: string) => t.trim().replace(/[.\s]+$/, '');
const ciudad = (z: string) => (z.split('/').pop() ?? z).replace(/_/g, ' ');
const parrafos = (t: string): Bloque[] => t.split(/\n\s*\n/).map((x) => x.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean).map((texto) => ({ t: 'p', texto }));
const lineas = (t: string) => t.split(/\n+/).map((x) => x.trim()).filter(Boolean);

function fuentesTxt(d: InformeDatos): string {
  const l = d.canales.map((c) => (c === 'Medio digital' ? 'noticias en línea' : c));
  return enLista(l);
}

/** Tabla por canal y día de una serie, con columna Total y fila Total. */
function tablaDias(d: InformeDatos, id: string, titulo: string, serie: SerieCanal, o: { canales?: string[]; nota?: string; vacio?: string; primera?: string } = {}): TablaDatos {
  const canales = (o.canales ?? d.canales).filter((c) => serie.por_canal[c]);
  const filas: Celda[][] = canales.map((c) => [{ texto: canalTxt(c), canal: c }, ...(serie.por_canal[c] ?? []).map((v) => v ?? 0), suma(serie.por_canal[c])]);
  const tot = totalSerie(serie);
  return {
    id, titulo, nota: o.nota, vacio: o.vacio,
    columnas: [{ titulo: o.primera ?? 'Fuente' }, ...d.dias.map((x) => ({ titulo: diaColumna(x), num: true })), { titulo: 'Total', num: true }],
    filas: tot ? filas : [],
    total: tot ? [{ texto: 'Total', fuerte: true }, ...serie.total, tot] : undefined,
  };
}
function cuentaCelda(c: CuentaVisible, extra?: string): Celda {
  const det = [c.tipo && c.visible ? c.tipo.toLowerCase() : null, c.descriptor, c.figura ? 'cuenta oficial de una figura en seguimiento' : null,
    c.visible && c.seguidores != null ? `${num(c.seguidores)} seguidores` : null, extra].filter(Boolean).join(', ');
  return { texto: c.etiqueta, nota: det || undefined, fuerte: c.visible };
}
function tablaPublicaciones(d: InformeDatos, id: string, titulo: string, l: PublicacionInforme[], nota?: string): TablaDatos {
  const demo = d.campana.es_demo;
  return {
    id, titulo, nota,
    columnas: [{ titulo: 'Cuenta', ancho: '24%' }, { titulo: 'Fecha y hora' }, { titulo: 'Texto (fragmento)', ancho: '38%' }, { titulo: 'Visualizaciones', num: true }, { titulo: 'Interacción', num: true }],
    filas: l.map((p) => [
      cuentaCelda(p.cuenta), momentoInf(p.publicada_en, d.zona),
      { texto: fragmento(p.titulo ?? p.texto, demo, 110) || 'Sin texto', enlace: urlSegura(p.url), csv: [fragmento(p.titulo ?? p.texto, demo, 280), urlSegura(p.url)].filter(Boolean).join(' · ') },
      p.vistas == null ? 'Sin datos' : p.vistas, p.interaccion == null ? 'Sin datos' : p.interaccion,
    ]),
  };
}
function ejemplos(d: InformeDatos, l: Destacada[]): Bloque {
  const demo = d.campana.es_demo;
  return {
    t: 'lista', items: l.map((x) => { const href = urlSegura(x.url); return (
      <>
        <b>{x.cuenta.etiqueta}, {canalTxt(x.canal)}, {momentoInf(x.publicada_en, d.zona)}:</b>{' '}
        {x.resumen ?? fragmento(x.titulo ?? x.texto, demo, 200)}
        {x.etiqueta ? <> <span className="inf-chip">{x.etiqueta}</span></> : null}
        {href ? <> <a href={href} target="_blank" rel="noopener noreferrer">ver publicación</a></> : null}
      </>
    ); }),
  };
}
const fig = (titulo: string, nodo: ReactNode, fuente?: string): Bloque => ({ t: 'fig', titulo, nodo, fuente });

/** Recolecciones de los canales que usa el informe (config.canales o los que tienen filas). */
export const recoleccionesDe = (d: InformeDatos) => d.recolecciones.filter((r) => d.canales.includes(r.canal));

// ---------- secciones ----------
function sResumen(d: InformeDatos, texto: string, nMet: number | null): Bloque[] {
  const S = d.series;
  const filas = totalSerie(S.filas);
  if (!filas) return [{ t: 'vacio', texto: 'Todavía no hay publicaciones recolectadas en el periodo del informe. Cuando la ingesta cargue filas, el resumen se arma solo.' }];
  const kp: { valor: string; etiqueta: string; color: string }[] = [];
  const fuentes = d.canales.filter((c) => totalCanal(S.filas, c) > 0).length;
  const com = d.comentarios.total.comentarios;
  if (d.modo === 'evento') {
    kp.push({ valor: num(filas), etiqueta: `Publicaciones recolectadas en ${fuentes} ${fuentes === 1 ? 'fuente' : 'fuentes'}`, color: TINTA });
    kp.push({ valor: num(totalSerie(S.conversacion)), etiqueta: `Publicaciones ${sobre(d, d.ejes_usados.conversacion)}`, color: TINTA });
    if (d.ejes_usados.foco && d.ejes_usados.foco !== d.ejes_usados.conversacion) kp.push({ valor: num(totalSerie(S.foco)), etiqueta: `Publicaciones ${sobre(d, d.ejes_usados.foco)}`, color: TINTA });
  } else {
    kp.push({ valor: num(totalSerie(S.sin_duplicados)), etiqueta: 'Ítems con algún eje, sin duplicados', color: TINTA });
    for (const c of d.canales.slice(0, 4)) {
      const v = totalCanal(S.sin_duplicados, c);
      if (v) kp.push({ valor: num(v), etiqueta: c === 'Medio digital' ? 'Artículos de noticias' : `Publicaciones en ${c}`, color: colorCanal(c) });
    }
    const v = totalSerie(S.vistas_filas);
    if (v) kp.push({ valor: num(v), etiqueta: 'Visualizaciones registradas', color: TINTA });
    if (d.cuentas_distintas.total) kp.push({ valor: num(d.cuentas_distintas.total), etiqueta: 'Cuentas que publicaron', color: TINTA });
  }
  if (com) kp.push({ valor: num(com), etiqueta: 'Comentarios recolectados', color: TINTA });
  for (const c of d.canales_comentarios) {
    if (kp.length >= 8) break;
    const n = d.comentarios.por_canal[c]?.comentarios ?? 0;
    if (n) kp.push({ valor: num(n), etiqueta: `Comentarios de ${canalTxt(c)}`, color: colorCanal(c) });
  }
  const { serie, nombre } = principal(d);
  const b: Bloque[] = [{ t: 'kpis', items: kp.slice(0, 8) }, { t: 'hallazgos', items: lineas(texto) }];
  b.push({ t: 'p', nota: true, texto: `Las cifras de visualizaciones son las que muestra cada plataforma, no personas únicas.${nMet ? ` La sección ${nMet} explica los límites de la recolección.` : ''}${d.periodo.ventana_evento?.estimada ? ' La hora de término del evento es una estimación.' : ''}` });
  const paneles = d.canales.filter((c) => totalCanal(serie, c) > 0).map((c) => ({ titulo: canalTxt(c), color: colorCanal(c), valores: serie.por_canal[c] }));
  if (paneles.length) {
    b.push(fig(`${nombre.charAt(0).toUpperCase() + nombre.slice(1)}, por día y fuente`, <Multiples paneles={paneles} etiquetas={d.dias.map((x) => diaEje(x.fecha))} />,
      `Hora de ${ciudad(d.zona)}. Cada fuente tiene su propia escala.${d.dias.some((x) => x.parcial) ? ' Los días parciales no están completos.' : ''}`));
  }
  return b;
}

function sVolumen(d: InformeDatos, texto: string): Bloque[] {
  const S = d.series;
  if (!totalSerie(S.filas)) return [{ t: 'vacio', texto: 'Sin publicaciones recolectadas en el periodo.' }];
  const b: Bloque[] = parrafos(texto);
  const et = d.dias.map((x) => diaEje(x.fecha));
  const z = `Hora de ${ciudad(d.zona)}.`;
  const { serie, nombre } = principal(d);
  b.push({ t: 'tabla', tabla: tablaDias(d, 'vol-principal', `${nombre.charAt(0).toUpperCase() + nombre.slice(1)}, por día`, serie, {
    nota: d.modo === 'tema' ? 'Un ítem cuenta una vez aunque esté en varios ejes. No incluye filas de otro país ni fuera del tema.' : 'No incluye publicaciones de otro país ni filas recolectadas que no tratan el tema.',
    vacio: 'Ninguna publicación del periodo entra en la conversación.',
  }) });
  if (totalSerie(serie)) b.push(fig(`${nombre.charAt(0).toUpperCase() + nombre.slice(1)}, por día, todas las fuentes`, <Barras titulo={`${nombre} por día`} etiquetas={et} valores={serie.total} ejeY="Publicaciones" />, `Fuente: ${fuentesTxt(d)}. ${z}`));
  if (d.modo === 'evento' && d.ejes_usados.foco && d.ejes_usados.foco !== d.ejes_usados.conversacion) {
    b.push({ t: 'tabla', tabla: tablaDias(d, 'vol-foco', `Publicaciones ${sobre(d, d.ejes_usados.foco)}, por día`, S.foco, { vacio: `Ninguna publicación ${sobre(d, d.ejes_usados.foco)}.` }) });
  }
  const filas = tablaDias(d, 'vol-filas', 'Filas recolectadas', S.filas, { nota: 'Incluye todo lo recolectado: publicaciones de otro país y filas que no tratan el tema.' });
  if (totalSerie(S.otro_pais)) filas.filas.push([{ texto: 'De otro país (aparte)', nota: 'incluidas arriba' }, ...S.otro_pais.total, totalSerie(S.otro_pais)]);
  b.push({ t: 'tabla', tabla: filas });
  if (totalSerie(S.comentarios)) b.push({ t: 'tabla', tabla: tablaDias(d, 'vol-coment', 'Comentarios recolectados', S.comentarios, { canales: d.canales_comentarios, nota: 'Comentarios por día en que se publicó el comentario.' }) });
  const ph = d.por_hora;
  if (d.modo === 'evento' && ph) {
    const v = d.periodo.ventana_evento;
    const aH = (t: string | null | undefined) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h + (m || 0) / 60; };
    const ini = aH(v?.hora_inicio), fin = aH(v?.hora_fin);
    const banda = ini != null ? { desde: ini, hasta: fin ?? ini + 0.5 } : null;
    const conFoco = d.ejes_usados.foco && d.ejes_usados.foco !== d.ejes_usados.conversacion;
    b.push({ t: 'h3', texto: `${diaLargo(ph.dia).replace(/^./, (c) => c.toUpperCase())}, hora por hora` });
    if (totalSerie(ph.conversacion)) {
      b.push(fig(`Publicaciones por hora, ${diaLargo(ph.dia)}`, (
        <>
          <PorHora titulo="Publicaciones por hora" barras={ph.conversacion.total} banda={banda} bandaRotulo={v ? `Evento${v.estimada ? ' (est.)' : ''}` : undefined}
            lineas={conFoco ? [{ nombre: 'Sobre el evento', valores: ph.foco.total, color: TINTA }] : []} ejeX={`Hora de ${ciudad(d.zona)}`} />
          <Leyenda items={[{ nombre: `Barras: ${principal(d).nombre}`, color: '#B9C2C9' }, ...(conFoco ? [{ nombre: `Línea: ${sobre(d, d.ejes_usados.foco)}`, color: TINTA, linea: true }] : []), ...(banda ? [{ nombre: `Franja: evento${v?.estimada ? ' (hora estimada)' : ''}`, color: '#DCE4EA' }] : [])]} />
        </>
      ), `Fuente: ${fuentesTxt(d)}. ${z}${ph.promedio_base ? ` Promedio horario del día base: ${String(ph.promedio_base.total)}.` : ''}`));
      // Como en las muestras: la fuente dominante (más del triple que la siguiente) va en el gráfico de barras y se deja
      // fuera de las líneas por fuente, para que las demás se lean con su escala.
      const todos = d.canales.filter((c) => suma(ph.conversacion.por_canal[c]) > 0).sort((a, b) => suma(ph.conversacion.por_canal[b]) - suma(ph.conversacion.por_canal[a]));
      const domina = todos.length >= 3 && suma(ph.conversacion.por_canal[todos[0]]) > 3 * suma(ph.conversacion.por_canal[todos[1]]);
      const canales = d.canales.filter((c) => todos.includes(c) && !(domina && c === todos[0]));
      if (canales.length > 1) {
        const nombres = enLista(canales.map(canalTxt));
        b.push(fig(`${domina ? nombres : 'Cada fuente'}: publicaciones por hora, ${diaLargo(ph.dia)}`, (
          <>
            <PorHora titulo="Publicaciones por hora en cada fuente" lineas={canales.map((c) => ({ nombre: canalTxt(c), valores: ph.conversacion.por_canal[c], color: colorCanal(c) }))} banda={banda} ejeX={`Hora de ${ciudad(d.zona)}`} />
            <Leyenda items={canales.map((c) => ({ nombre: canalTxt(c), color: colorCanal(c), linea: true }))} />
          </>
        ), `Fuente: ${nombres}. ${z}${canales.includes('Medio digital') ? ' La hora de las noticias es la que informa el buscador; puede ser posterior a la publicación original.' : ''}`));
      }
    } else b.push({ t: 'vacio', texto: 'Sin publicaciones el día del evento.' });
  }
  return b;
}

function sAlcance(d: InformeDatos, texto: string): Bloque[] {
  const { serie, vistas } = principal(d);
  if (!totalSerie(serie)) return [{ t: 'vacio', texto: 'Sin publicaciones en el periodo: no hay visualizaciones ni interacción que contar.' }];
  const b: Bloque[] = parrafos(texto);
  const inter = d.modo === 'evento' ? d.series.interaccion_conversacion : null;
  const canales = d.canales.filter((c) => totalCanal(serie, c) > 0);
  const t: TablaDatos = {
    id: 'alc-vistas', titulo: d.modo === 'evento' ? `Toda la conversación ${sobre(d, d.ejes_usados.conversacion)}` : 'Visualizaciones registradas de las filas recolectadas',
    columnas: [{ titulo: 'Plataforma' }, ...d.dias.map((x) => ({ titulo: `Vistas ${diaColumna(x)}`, num: true })), { titulo: 'Vistas total', num: true }, ...(inter ? [{ titulo: 'Interacción total', num: true }] : [])],
    filas: canales.map((c) => {
      const sv = totalCanal(vistas, c);
      return [{ texto: canalTxt(c), canal: c }, ...(vistas.por_canal[c] ?? d.dias.map(() => 0)).map((v) => (sv ? v : 'Sin datos')), sv || 'Sin datos', ...(inter ? [totalCanal(inter, c)] : [])];
    }),
    total: [{ texto: 'Total', fuerte: true }, ...vistas.total, totalSerie(vistas), ...(inter ? [totalSerie(inter)] : [])],
    nota: 'Las visualizaciones cuentan solo las publicaciones que las informan; no son personas únicas. La interacción suma me gusta, respuestas y compartidos.',
  };
  b.push({ t: 'tabla', tabla: t });
  const conV = canales.filter((c) => totalCanal(vistas, c) > 0);
  const ib = iDia(d, d.periodo.dia_base), ie = iDia(d, d.periodo.dia_evento);
  if (d.modo === 'evento' && ib >= 0 && ie >= 0 && conV.length) {
    b.push(fig(`Visualizaciones registradas por plataforma, ${diaEje(d.dias[ib].fecha)} y ${diaEje(d.dias[ie].fecha)}`,
      <BarrasPareadas titulo="Visualizaciones base frente a evento" filas={conV.map((c) => ({ etiqueta: canalTxt(c), valores: [vistas.por_canal[c][ib], vistas.por_canal[c][ie]] }))}
        series={[{ nombre: `${diaEje(d.dias[ib].fecha)} (base)`, color: TINTA_SUAVE }, { nombre: `${diaEje(d.dias[ie].fecha)} (evento)`, color: TINTA }]} />,
      `Fuente: tabla de esta sección. Hora de ${ciudad(d.zona)}.`));
  } else if (conV.length) {
    b.push(fig('Visualizaciones registradas por plataforma', <BarrasH titulo="Visualizaciones por plataforma" filas={conV.map((c) => ({ etiqueta: canalTxt(c), valor: totalCanal(vistas, c), color: colorCanal(c) }))} ejeX="Visualizaciones" />, `Fuente: ${fuentesTxt(d)}.`));
  }
  if (inter && totalSerie(inter)) {
    b.push(fig(`Interacción ${sobre(d, d.ejes_usados.conversacion)} por plataforma`, <BarrasH titulo="Interacción por plataforma" filas={canales.filter((c) => totalCanal(inter, c) > 0).map((c) => ({ etiqueta: canalTxt(c), valor: totalCanal(inter, c), color: colorCanal(c) }))} ejeX="Interacción" />, `Fuente: ${fuentesTxt(d)}. Hora de ${ciudad(d.zona)}.`));
  }
  return b;
}

function sReparto(d: InformeDatos, texto: string): Bloque[] {
  const b: Bloque[] = [];
  const ejeR = d.ejes_usados.foco ?? d.ejes_usados.conversacion;
  const des = d.modo === 'evento' ? (d.ejes_usados.foco ? d.desglose.foco : d.desglose.conversacion) : null;
  if (des && des.total.publicaciones) {
    b.push(...parrafos(texto));
    const filas = des.filas.filter((f) => f.publicaciones > 0);
    b.push({ t: 'tabla', tabla: {
      id: 'rep-desglose', titulo: `Publicaciones ${sobre(d, ejeR)} por plataforma`,
      columnas: [{ titulo: 'Plataforma' }, { titulo: 'Publicaciones', num: true }, { titulo: '% de publicaciones', num: true }, { titulo: 'Visualizaciones', num: true }, { titulo: '% de visualizaciones', num: true }, { titulo: 'Me gusta', num: true }, { titulo: 'Respuestas', num: true }, { titulo: 'Compartidos', num: true }, { titulo: 'Interacción', num: true }, { titulo: '% de interacción', num: true }],
      filas: filas.map((f) => [{ texto: canalTxt(f.canal), canal: f.canal }, f.publicaciones, pc(f.pct_publicaciones), f.con_vistas ? f.vistas : 'Sin datos', f.con_vistas ? pc(f.pct_vistas) : 'Sin datos', f.con_interaccion ? f.me_gusta : 'Sin datos', f.con_interaccion ? f.respuestas : 'Sin datos', f.con_interaccion ? f.compartidos : 'Sin datos', f.con_interaccion ? f.interaccion : 'Sin datos', f.con_interaccion ? pc(f.pct_interaccion) : 'Sin datos']),
      total: [{ texto: 'Total', fuerte: true }, des.total.publicaciones, '100%', des.total.vistas, '100%', des.total.me_gusta, des.total.respuestas, des.total.compartidos, des.total.interaccion, '100%'],
      nota: 'Las noticias no tienen visualizaciones ni interacción. Los porcentajes son enteros; por redondeo pueden no sumar 100.',
    } });
    b.push(fig('Peso de cada plataforma en publicaciones, visualizaciones e interacción',
      <BarrasPareadas titulo="Porcentaje por plataforma" formato={pc} filas={filas.map((f) => ({ etiqueta: canalTxt(f.canal), valores: [f.pct_publicaciones, f.con_vistas ? f.pct_vistas : null, f.con_interaccion ? f.pct_interaccion : null] }))}
        series={[{ nombre: '% de publicaciones', color: '#B9C2C9' }, { nombre: '% de visualizaciones', color: TINTA }, { nombre: '% de interacción', color: '#7FA7BC' }]} />,
      `Fuente: tabla de esta sección.`));
    const conV = filas.filter((f) => f.con_vistas);
    if (conV.length) b.push(fig(`Visualizaciones registradas ${sobre(d, ejeR)} por plataforma`, <BarrasH titulo="Visualizaciones por plataforma" filas={conV.map((f) => ({ etiqueta: canalTxt(f.canal), valor: f.vistas, color: colorCanal(f.canal) }))} ejeX="Visualizaciones" />, `Fuente: ${fuentesTxt(d)}.`));
    return b;
  }
  const { serie, vistas } = principal(d);
  const tot = totalSerie(serie), tv = totalSerie(vistas);
  if (!tot) return [{ t: 'vacio', texto: 'Sin publicaciones que repartir por plataforma.' }];
  b.push(...parrafos(texto));
  const canales = d.canales.filter((c) => totalCanal(serie, c) > 0);
  b.push({ t: 'tabla', tabla: {
    id: 'rep-tema', titulo: 'Ítems y visualizaciones por plataforma',
    columnas: [{ titulo: 'Plataforma' }, { titulo: 'Ítems', num: true }, { titulo: '% de ítems', num: true }, { titulo: 'Visualizaciones', num: true }, { titulo: '% de visualizaciones', num: true }, { titulo: 'Cuentas distintas', num: true }],
    filas: canales.map((c) => [{ texto: canalTxt(c), canal: c }, totalCanal(serie, c), pc(parte(totalCanal(serie, c), tot)), totalCanal(vistas, c) || 'Sin datos', totalCanal(vistas, c) ? pc(parte(totalCanal(vistas, c), tv)) : 'Sin datos', d.cuentas_distintas.por_canal[c] ?? 0]),
    total: [{ texto: 'Total', fuerte: true }, tot, '100%', tv, tv ? '100%' : 'Sin datos', d.cuentas_distintas.total],
    nota: 'Visualizaciones de todas las filas recolectadas de cada plataforma. Cuentas distintas: cuentas que publicaron en el periodo.',
  } });
  b.push(fig('Ítems por plataforma', <BarrasH titulo="Ítems por plataforma" filas={canales.map((c) => ({ etiqueta: canalTxt(c), valor: totalCanal(serie, c), color: colorCanal(c) }))} ejeX="Ítems" />, `Fuente: ${fuentesTxt(d)}.`));
  return b;
}

const PALETA_EJES = ['#1F5C7A', '#8E3B5D', '#4B8E7E', '#C48A3E', '#7566A6', '#8DA8D6', '#AFB487', '#2B3038'];
function sEjes(d: InformeDatos, texto: string): Bloque[] {
  const l = d.ejes.lista;
  if (!l.length) return [{ t: 'vacio', texto: d.ejes.definiciones.length ? 'Ningún eje del informe tiene ítems en el periodo.' : 'La campaña todavía no tiene ejes. Crea ejes con su regla para contar los ítems de cada uno.' }];
  const b: Bloque[] = parrafos(texto);
  const color = (id: string, i: number) => d.ejes.definiciones.find((e) => e.id === id)?.color ?? PALETA_EJES[i % PALETA_EJES.length];
  const series = l.map((e, i) => ({ nombre: e.nombre, color: color(e.eje_id, i) }));
  const canales = d.canales.filter((c) => l.some((e) => (e.por_canal[c]?.total ?? 0) > 0));
  if (canales.length) {
    b.push(fig('Peso de cada eje en cada fuente', <Apiladas titulo="Peso de cada eje en cada fuente" filas={canales.map((c) => ({ etiqueta: canalTxt(c), partes: l.map((e) => e.por_canal[c]?.total ?? 0) }))} series={series} izq={120} />,
      'Fuente: tablas de esta sección. Cada barra suma los ítems de sus ejes; un ítem puede estar en varios.'));
  }
  const et = d.dias.map((x) => diaEje(x.fecha));
  b.push(fig('Ítems por día en cada eje', <Multiples etiquetas={et} paneles={l.map((e, i) => ({ titulo: e.nombre, color: series[i].color, valores: d.dias.map((_, j) => suma(Object.values(e.por_canal).map((x) => x.por_dia[j] ?? 0))) }))} />, `Todas las fuentes. Hora de ${ciudad(d.zona)}. Cada eje tiene su propia escala.`));
  let hayTope = false;
  for (const c of canales) {
    const filas: Celda[][] = l.map((e) => {
      const x = e.por_canal[c];
      return [e.nombre, ...d.dias.map((_, j) => {
        const v = x?.por_dia[j] ?? 0;
        if (!x?.tope[j]) return v;
        hayTope = true;
        return { texto: `${num(v)}*`, nota: x.estimado[j] != null ? `tope, est. ~${num(x.estimado[j])}` : 'tope', csv: v };
      }), x?.total ?? 0];
    });
    const S = d.series;
    const fila = (t: string, s: SerieCanal): Celda[] => [{ texto: t, fuerte: true }, ...(s.por_canal[c] ?? d.dias.map(() => 0)), suma(s.por_canal[c])];
    filas.push(fila('Total sin duplicados', S.sin_duplicados), fila('Otro país (aparte)', S.otro_pais), fila('Sin grupo', S.sin_eje), fila('Filas recolectadas', S.filas));
    b.push({ t: 'tabla', tabla: { id: `ejes-${c}`, titulo: canalTxt(c), columnas: [{ titulo: 'Eje' }, ...d.dias.map((x) => ({ titulo: diaColumna(x), num: true })), { titulo: 'Total', num: true }], filas } });
  }
  if (hayTope) b.push({ t: 'p', nota: true, texto: '* La recolección de ese eje, fuente y día llegó al tope: el conteo es un mínimo. El estimado del día completo viene del proveedor.' });
  for (const e of l) {
    const ej = d.destacadas.lista.filter((x) => x.eje_id === e.eje_id && x.grupo !== 'propias');
    if (ej.length) { b.push({ t: 'h3', texto: `Ejemplos · ${e.nombre}` }); b.push(ejemplos(d, ej)); }
  }
  return b;
}

const SERIES_SENT = [{ nombre: 'favorable', color: SENT.favorable }, { nombre: 'crítico', color: SENT.desfavorable }, { nombre: 'neutral u otro', color: SENT.neutral, claro: true }];
function sSentimiento(d: InformeDatos, texto: string): Bloque[] {
  const ms = d.muestras.filter((m) => m.n > 0);
  if (!ms.length) return [{ t: 'vacio', texto: d.muestras.length ? 'Las muestras del informe todavía no tienen ítems codificados.' : 'Este informe no tiene muestras codificadas. El sentimiento solo se informa a partir de una muestra leída y codificada.' }];
  const b: Bloque[] = parrafos(texto);
  const filas: Celda[][] = [];
  const barras: { etiqueta: string; partes: (number | null)[] }[] = [];
  for (const m of ms) {
    const desc = [m.tamano != null ? `${num(m.n)} de ${num(m.tamano)} previstos` : null, m.universo != null ? `universo ${num(m.universo)}` : null, m.semilla ? `semilla ${m.semilla}` : null, m.metodo ? sinPunto(m.metodo) : null].filter(Boolean).join(', ');
    if (desc) b.push({ t: 'p', nota: true, texto: `Muestra "${m.nombre}": ${desc}.` });
    if (m.ponderado) {
      for (const e of m.estratos.filter((x) => x.n > 0)) {
        filas.push([{ texto: canalTxt(e.canal), canal: e.canal }, e.n, pc(e.favorable.pct), pc(e.desfavorable.pct), pc(e.neutral.pct), e.margen_max != null ? `±${e.margen_max} pts` : 'Sin datos']);
        barras.push({ etiqueta: `${canalTxt(e.canal)} (n = ${num(e.n)})`, partes: [e.favorable.pct, e.desfavorable.pct, e.neutral.pct] });
      }
      filas.push([{ texto: `${m.nombre}, ponderado`, fuerte: true }, m.n, pc(m.ponderado.favorable), pc(m.ponderado.desfavorable), pc(m.ponderado.neutral), 'sin margen']);
      barras.push({ etiqueta: `${m.nombre}, ponderado (n = ${num(m.n)})`, partes: [m.ponderado.favorable, m.ponderado.desfavorable, m.ponderado.neutral] });
    } else {
      const s = m.sentimiento;
      filas.push([m.canal ? { texto: m.nombre, canal: m.canal } : m.nombre, m.n, pc(s.favorable.pct), pc(s.desfavorable.pct), pc(s.neutral.pct), m.margen_max != null ? `±${m.margen_max} pts` : 'Sin datos']);
      barras.push({ etiqueta: `${m.nombre} (n = ${num(m.n)})`, partes: [s.favorable.pct, s.desfavorable.pct, s.neutral.pct] });
    }
  }
  b.push({ t: 'tabla', tabla: {
    id: 'sent', titulo: 'Sentimiento por muestra',
    columnas: [{ titulo: 'Muestra' }, { titulo: 'Tamaño', num: true }, { titulo: 'Favorable', num: true }, { titulo: 'Crítico', num: true }, { titulo: 'Neutral u otro', num: true }, { titulo: 'Margen máx.', num: true }],
    filas, nota: 'Margen máximo con 95% de confianza: 1.96 × √(0.25 / n). El ponderado combina los estratos según el volumen recolectado de cada plataforma y no tiene un margen simple.',
  } });
  b.push(fig('Sentimiento por muestra (% de la muestra)', <Apiladas titulo="Sentimiento por muestra" filas={barras} series={SERIES_SENT} izq={220} />, 'Fuente: lectura y codificación de las muestras.'));
  const nombre = (id: string) => d.codigos.find((c) => c.id === id);
  for (const m of ms) {
    if (!m.temas.length) continue;
    const est = m.estratos.filter((e) => e.n > 0);
    const pond = !!m.ponderado;
    b.push({ t: 'tabla', tabla: {
      id: `temas-${m.id}`, titulo: `Temas principales · ${m.nombre}`,
      columnas: [{ titulo: 'Tema' }, ...(est.length > 1 ? est.map((e) => ({ titulo: `${canalTxt(e.canal)} (n = ${num(e.n)})`, num: true })) : [{ titulo: 'Ítems', num: true }]), { titulo: pond ? '% ponderado' : '% de la muestra', num: true }],
      filas: m.temas.map((t) => {
        const c = nombre(t.codigo_id);
        return [{ texto: c?.nombre ?? 'Sin nombre', nota: c ? (c.tono === 'apoyo' ? 'apoyo' : c.tono === 'critica' ? 'crítica' : undefined) : undefined }, ...(est.length > 1 ? est.map((e) => t.por_estrato[e.canal]?.n ?? 0) : [t.n]), pc(pond ? t.pct_ponderado : t.pct)];
      }),
      nota: m.sin_codigo ? `${num(m.sin_codigo)} ítems sin tema asignado.` : undefined,
    } });
    b.push(fig(`${m.nombre}: tema principal (${pond ? '% ponderado' : '% de la muestra'})`,
      <BarrasH titulo={`Temas de ${m.nombre}`} izq={230} formato={pc} filas={m.temas.map((t) => ({ etiqueta: nombre(t.codigo_id)?.nombre ?? 'Sin nombre', valor: (pond ? t.pct_ponderado : t.pct) ?? 0, color: TONO_CODIGO[nombre(t.codigo_id)?.tono ?? 'neutro'] }))} ejeX={pond ? '% ponderado' : '% de la muestra'} />,
      'Verde: apoyo. Rojo: crítica. Gris: neutro u otro.'));
  }
  return b;
}

function sPublicaciones(d: InformeDatos, texto: string): Bloque[] {
  const R = d.rankings;
  // Las noticias no tienen vistas ni interacción: van en Cobertura de medios, no en los rankings.
  const canalesR = d.canales.filter((c) => c !== 'Medio digital' && (R.publicaciones[c] || R.cuentas[c]));
  const cp = d.cuentas_propias;
  const dest = d.destacadas.lista.filter((x) => !x.eje_id && x.grupo !== 'propias');
  if (!canalesR.length && !cp.publicaciones.length && !dest.length && !d.comentarios.total.comentarios) return [{ t: 'vacio', texto: 'Sin publicaciones en el ámbito del informe.' }];
  const b: Bloque[] = parrafos(texto);
  b.push({ t: 'p', nota: true, texto: `El usuario de una cuenta solo se muestra si tiene 100,000 seguidores o más o si es una organización; las demás aparecen como "Cuenta personal". ${d.campana.es_demo ? 'Escenario de ejemplo: los fragmentos se muestran sin comillas y no son citas.' : 'Las cifras son las del momento de la recolección.'}` });
  if (cp.publicaciones.length) {
    const nom = enLista([...new Set(cp.autores.map((a) => a.etiqueta))]);
    b.push({ t: 'tabla', tabla: {
      id: 'propias', titulo: `Publicaciones de las cuentas propias${nom ? ` (${nom})` : ''}`,
      columnas: [{ titulo: 'Publicación' }, { titulo: 'Qué es', ancho: '36%' }, { titulo: 'Visualizaciones', num: true }, { titulo: 'Me gusta', num: true }, { titulo: 'Comentarios', num: true }],
      filas: cp.publicaciones.map((p) => [{ texto: `${p.cuenta.etiqueta}, ${momentoInf(p.publicada_en, d.zona)}`, canal: p.canal, enlace: urlSegura(p.url) }, p.que_es ?? fragmento(p.titulo ?? p.texto, d.campana.es_demo, 90), p.vistas ?? 'Sin datos', p.me_gusta ?? 'Sin datos', p.respuestas ?? 'Sin datos']),
    } });
    const conV = cp.publicaciones.filter((p) => (p.vistas ?? 0) > 0);
    if (conV.length) b.push(fig('Cuentas propias: visualizaciones de sus publicaciones', <BarrasH titulo="Visualizaciones de las publicaciones propias" izq={200} filas={conV.map((p) => ({ etiqueta: `${canalTxt(p.canal)}, ${momentoInf(p.publicada_en, d.zona)}`, valor: p.vistas ?? 0, color: colorCanal(p.canal) }))} ejeX="Visualizaciones" />, 'Fuente: tabla de esta sección.'));
  }
  if (dest.length) { b.push({ t: 'h3', texto: 'Publicaciones destacadas' }); b.push(ejemplos(d, dest)); }
  const enm = (n: number) => (n ? `Se dejaron fuera ${num(n)} ${n === 1 ? 'cuenta personal' : 'cuentas personales'} con menos de 100,000 seguidores.` : undefined);
  for (const c of canalesR) {
    const p = R.publicaciones[c];
    if (p) {
      const conV = p.por_vistas.some((x) => (x.vistas ?? 0) > 0);
      const l = conV ? p.por_vistas : p.por_interaccion;
      if (l.length) b.push({ t: 'tabla', tabla: tablaPublicaciones(d, `pub-${c}`, `${canalTxt(c)}: publicaciones con más ${conV ? 'visualizaciones' : 'interacción'}`, l, enm(conV ? p.omitidas.por_vistas : p.omitidas.por_interaccion)) });
      if (conV && l.length >= 3) b.push(fig(`${canalTxt(c)}: visualizaciones de las ${l.length} publicaciones principales`, <BarrasH titulo={`${c}: visualizaciones`} filas={l.map((x) => ({ etiqueta: `${x.cuenta.etiqueta}, ${momentoInf(x.publicada_en, d.zona)}`, valor: x.vistas ?? 0, color: colorCanal(c) }))} izq={230} ejeX="Visualizaciones" />, `Fuente: ${canalTxt(c)}. Hora de ${ciudad(d.zona)}.`));
    }
    const k = R.cuentas[c];
    if (k) {
      const conV = k.por_vistas.some((x) => x.vistas > 0);
      const l = conV ? k.por_vistas : k.por_publicaciones;
      if (l.length) b.push({ t: 'tabla', tabla: {
        id: `cue-${c}`, titulo: `${canalTxt(c)}: cuentas con más ${conV ? 'visualizaciones' : 'publicaciones'}`,
        columnas: [{ titulo: 'Cuenta', ancho: '40%' }, { titulo: 'Publicaciones', num: true }, { titulo: 'Visualizaciones', num: true }, { titulo: 'Me gusta', num: true }, { titulo: 'Interacción', num: true }],
        filas: l.map((x) => [cuentaCelda(x), x.publicaciones, conV ? x.vistas : 'Sin datos', x.me_gusta, x.interaccion]),
        nota: [`${num(k.cuentas)} cuentas distintas en el ámbito.`, enm(conV ? k.omitidas.por_vistas : k.omitidas.por_publicaciones)].filter(Boolean).join(' '),
      } });
    }
  }
  const ct = d.comentarios;
  if (ct.total.comentarios) {
    const cs = d.canales_comentarios.filter((c) => ct.por_canal[c]);
    b.push({ t: 'tabla', tabla: {
      id: 'coment', titulo: 'Dónde están los comentarios recolectados',
      columnas: [{ titulo: 'Plataforma' }, { titulo: 'Comentarios', num: true }, { titulo: 'Publicaciones', num: true }, { titulo: 'En publicaciones del ámbito', num: true }, { titulo: 'En cuentas propias o de figuras', num: true }, { titulo: 'Solo emojis', num: true }, { titulo: 'Duplicados', num: true }],
      filas: cs.map((c) => { const x = ct.por_canal[c]; return [{ texto: canalTxt(c), canal: c }, x.comentarios, x.publicaciones, `${num(x.en_ambito)} (${pc(x.pct_en_ambito)})`, `${num(x.de_cuentas_propias)} (${pc(x.pct_de_cuentas_propias)})`, x.solo_emojis, x.duplicados]; }),
      total: [{ texto: 'Total', fuerte: true }, ct.total.comentarios, ct.total.publicaciones, ct.total.en_ambito, ct.total.de_cuentas_propias, ct.total.solo_emojis, ct.total.duplicados],
      nota: 'Los autores de los comentarios no se guardan. Publicaciones: publicaciones distintas con comentarios recolectados.',
    } });
    const top = cs.flatMap((c) => ct.por_canal[c].top.map((t) => ({ ...t, c })));
    if (top.length) b.push({ t: 'tabla', tabla: {
      id: 'coment-top', titulo: 'Publicaciones con más comentarios recolectados',
      columnas: [{ titulo: 'Publicación' }, { titulo: 'Texto (fragmento)', ancho: '40%' }, { titulo: 'Comentarios', num: true }, { titulo: '% de la plataforma', num: true }],
      filas: top.map((t) => [{ texto: `${t.cuenta.etiqueta}, ${momentoInf(t.publicada_en, d.zona)}`, canal: t.c, enlace: urlSegura(t.url) }, fragmento(t.titulo ?? t.texto, d.campana.es_demo, 100), t.comentarios, pc(t.pct)]),
    } });
  }
  return b;
}

function sMedios(d: InformeDatos, texto: string): Bloque[] {
  const m = d.medios;
  const cuentas = Object.entries(m.cuentas).filter(([, l]) => l.length);
  if (!m.total_titulares && !cuentas.length) return [{ t: 'vacio', texto: 'Ningún medio publicó sobre el tema en el periodo, o la recolección no incluye noticias.' }];
  const b: Bloque[] = parrafos(texto);
  if (m.titulares.length) {
    b.push({ t: 'tabla', tabla: {
      id: 'titulares', titulo: 'Titulares en orden de hora',
      columnas: [{ titulo: 'Medio', ancho: '22%' }, { titulo: 'Titular', ancho: '60%' }, { titulo: 'Fecha y hora' }],
      filas: m.titulares.map((t) => [t.fuente ?? 'Sin fuente', { texto: fragmento(t.titulo, d.campana.es_demo, 140) || 'Sin titular', enlace: urlSegura(t.url), csv: [t.titulo, urlSegura(t.url)].filter(Boolean).join(' · ') }, momentoInf(t.publicada_en, d.zona)]),
      nota: m.total_titulares > m.titulares.length ? `Se muestran ${m.titulares.length} de ${num(m.total_titulares)} artículos.` : 'La hora es la que informa el buscador de noticias.',
    } });
  }
  if (m.por_fuente.length > 1) b.push(fig('Medios con más artículos', <BarrasH titulo="Medios con más artículos" filas={m.por_fuente.map((f) => ({ etiqueta: f.fuente, valor: f.articulos, color: colorCanal('Medio digital') }))} ejeX="Artículos" />, 'Fuente: noticias en línea.'));
  for (const [c, l] of cuentas) {
    b.push({ t: 'tabla', tabla: {
      id: `medios-${c}`, titulo: `Cuentas de medios en ${canalTxt(c)}`,
      columnas: [{ titulo: 'Cuenta', ancho: '40%' }, { titulo: 'Publicaciones', num: true }, { titulo: 'Primera publicación' }, { titulo: 'Visualizaciones', num: true }],
      filas: l.map((x) => [cuentaCelda(x), x.publicaciones, momentoInf(x.primera, d.zona), x.con_vistas ? x.vistas : 'Sin datos']),
    } });
  }
  return b;
}

function sComparacion(d: InformeDatos, texto: string): Bloque[] {
  const cmp = d.comparacion;
  if (!cmp) return [{ t: 'vacio', texto: 'Este informe no tiene un eje de comparación. Elige uno en la configuración del informe.' }];
  const conv = d.series.conversacion, co = d.series.comparacion;
  if (!totalSerie(conv)) return [{ t: 'vacio', texto: 'Sin conversación en el periodo para comparar.' }];
  const b: Bloque[] = parrafos(texto);
  const etq = cmp.etiqueta ?? cmp.nombre;
  const ie = d.modo === 'evento' ? iDia(d, d.periodo.dia_evento) : -1;
  const pick = (a: number[] | undefined) => (ie >= 0 ? a?.[ie] ?? 0 : suma(a));
  const cs = d.canales.filter((c) => pick(conv.por_canal[c]) > 0);
  const cuando = ie >= 0 ? `del ${diaLargo(d.periodo.dia_evento)}` : 'del periodo';
  b.push({ t: 'tabla', tabla: {
    id: 'comp', titulo: `Conversación ${cuando}: ${etq.toLowerCase()}`,
    columnas: [{ titulo: 'Plataforma' }, { titulo: 'Conversación', num: true }, { titulo: etq, num: true }, { titulo: '% que cumple', num: true }, { titulo: 'No cumple', num: true }],
    filas: cs.map((c) => { const t = pick(conv.por_canal[c]), n = pick(co.por_canal[c]); return [{ texto: canalTxt(c), canal: c }, t, n, pc(parte(n, t)), t - n]; }),
    total: [{ texto: 'Total', fuerte: true }, pick(conv.total), pick(co.total), pc(parte(pick(co.total), pick(conv.total))), pick(conv.total) - pick(co.total)],
  } });
  b.push(fig(`Conversación ${cuando}: % que ${etq.toLowerCase()}`, <BarrasH titulo="Porcentaje que cumple la comparación" formato={pc} filas={cs.map((c) => ({ etiqueta: canalTxt(c), valor: parte(pick(co.por_canal[c]), pick(conv.por_canal[c])) ?? 0, color: colorCanal(c) }))} ejeX="% de la conversación" />, `Fuente: ${fuentesTxt(d)}. Hora de ${ciudad(d.zona)}.`));
  b.push({ t: 'tabla', tabla: tablaDias(d, 'comp-dias', `${etq}, por día`, co, { nota: 'Publicaciones de la conversación que además cumplen la regla de comparación.' }) });
  return b;
}

function sMetodologia(d0: InformeDatos, texto: string, analista: boolean): Bloque[] {
  // informe_datos lista las recolecciones que se cruzan con el periodo en cualquier canal: aquí solo las de los canales del informe.
  const d = { ...d0, recolecciones: recoleccionesDe(d0) };
  const b: Bloque[] = [];
  if (analista) b.push(...parrafos(texto));
  const fp: ReactNode[] = [];
  fp.push(<>Periodo: {nombrePeriodo(d)}, hora de {ciudad(d.zona)} ({d.zona}).{d.periodo.dia_base ? ` El ${diaLargo(d.periodo.dia_base)} es el día base.` : ''}{d.dias.some((x) => x.parcial) ? ' El último día es parcial.' : ''}</>);
  const v = d.periodo.ventana_evento;
  if (v) fp.push(<>Evento: {diaLargo(v.inicio.slice(0, 10))}, de {v.hora_inicio}{v.hora_fin ? ` a ${v.hora_fin}` : ''}{v.estimada ? ' (hora estimada)' : ''}.</>);
  const porCanal = new Map<string, typeof d.recolecciones>();
  for (const r of d.recolecciones) porCanal.set(r.canal, [...(porCanal.get(r.canal) ?? []), r]);
  for (const [c, rs] of porCanal) {
    const metodos = [...new Set(rs.map((r) => r.metodo))];
    const desc = [...new Set(rs.map((r) => r.descripcion).filter((x): x is string => !!x).map(sinPunto))].slice(0, 3);
    const filas = suma(rs.map((r) => r.filas ?? 0));
    fp.push(<><b>{canalTxt(c)}:</b> {metodos.join(', ').toLowerCase()}{desc.length ? `: ${desc.join('; ')}` : ''}. {num(filas)} filas en {rs.length} {rs.length === 1 ? 'recolección' : 'recolecciones'}.</>);
  }
  if (!d.recolecciones.length) fp.push(<>No hay registro de recolecciones para este periodo: las cifras salen de las filas cargadas, sin detalle de cómo se recolectaron.</>);
  b.push({ t: 'h3', texto: 'Fuentes y periodo' }, { t: 'lista', items: fp });
  const usados = new Set([d.ejes_usados.conversacion, d.ejes_usados.foco, d.ejes_usados.comparacion, ...d.ejes_usados.ejes].filter(Boolean) as string[]);
  const ejes = d.ejes.definiciones.filter((e) => usados.has(e.id));
  if (ejes.length) b.push({ t: 'h3', texto: 'Ejes y reglas' }, { t: 'lista', items: ejes.map((e) => <><b>{e.nombre}:</b> {e.regla ? sinPunto(e.regla) : 'sin regla escrita'}.</>) });
  if (d.muestras.length) {
    b.push({ t: 'h3', texto: 'Muestras' }, { t: 'lista', items: d.muestras.map((m) => <><b>{m.nombre}:</b> {num(m.n)} {m.objeto} codificados{m.tamano != null ? ` de ${num(m.tamano)} previstos` : ''}{m.universo != null ? `, de un universo de ${num(m.universo)}` : ''}{m.metodo ? `, ${sinPunto(m.metodo)}` : ''}{m.semilla ? `, semilla ${m.semilla}` : ''}. Ponderación: {m.ponderacion}.{m.margen_max != null ? ` Margen máximo ±${m.margen_max} puntos.` : ''}</>) });
  }
  const lim: ReactNode[] = [];
  for (const r of d.recolecciones.filter((x) => x.llego_al_tope)) lim.push(<>{canalTxt(r.canal)}{r.eje_nombre ? `, ${r.eje_nombre}` : ''}{r.dia ? `, ${fecha(r.dia, 'corto')}` : ''}: llegó al tope de {num(r.tope)} filas{r.estimado != null ? `; el proveedor estima ${num(r.estimado)}` : ''}. El conteo es un mínimo.</>);
  for (const r of d.recolecciones) for (const f of r.faltantes ?? []) lim.push(<>{canalTxt(r.canal)}: no se pudo leer {f.cuenta === 'Cuenta personal' ? 'una cuenta personal' : f.cuenta}{f.motivo ? ` (${sinPunto(f.motivo)})` : ''}{f.desde ? `, desde ${momentoInf(f.desde, d.zona)}` : ''}.</>);
  for (const r of d.recolecciones) if (r.cubre_desde && r.periodo_inicio && r.cubre_desde > r.periodo_inicio) lim.push(<>{canalTxt(r.canal)}{r.eje_nombre ? `, ${r.eje_nombre}` : ''}: la recolección cubre solo desde {momentoInf(r.cubre_desde, d.zona)}.</>);
  for (const l of [...new Set(d.recolecciones.flatMap((r) => r.limites ?? []))]) lim.push(<>{l.charAt(0).toUpperCase() + l.slice(1)}{/[.!?]$/.test(l) ? '' : '.'}</>);
  lim.push(<>Las visualizaciones e interacciones son las que informa cada plataforma al momento de la recolección; no son personas únicas y pueden cambiar después.</>);
  lim.push(<>El usuario de las cuentas con menos de 100,000 seguidores que no son organizaciones no se publica.</>);
  b.push({ t: 'h3', texto: 'Límites' }, { t: 'lista', items: lim });
  if (d.recolecciones.length) {
    b.push({ t: 'tabla', tabla: {
      id: 'recolecciones', titulo: 'Registro de recolecciones',
      columnas: [{ titulo: 'Fuente' }, { titulo: 'Método' }, { titulo: 'Eje' }, { titulo: 'Día', num: true }, { titulo: 'Filas', num: true }, { titulo: 'Tope', num: true }, { titulo: 'Estimado', num: true }],
      filas: d.recolecciones.map((r) => [{ texto: canalTxt(r.canal), canal: r.canal, nota: r.descripcion ?? undefined }, r.metodo, r.eje_nombre ?? '', r.dia ? fecha(r.dia, 'corto') : '', r.filas ?? 'Sin datos', r.tope == null ? '' : { texto: `${num(r.tope)}${r.llego_al_tope ? ' (alcanzado)' : ''}`, csv: r.tope }, r.estimado ?? '']),
    } });
  }
  return b;
}

/** Arma el modelo del Informe: secciones activas, numeradas, con sus bloques. */
export function armar(d: InformeDatos, textos?: Record<string, string>): Modelo {
  const cfg = seccionesDe(d).filter((s) => s.activa);
  const nMet = cfg.findIndex((s) => s.id === 'metodologia');
  const secciones = cfg.map((s, i): SeccionModelo => {
    const texto = textoDe(d, s.id, textos);
    const titulo = s.id === 'comparacion' && d.comparacion && !(d.secciones ?? []).find((x) => x.id === s.id)?.titulo ? `Comparación: ${(d.comparacion.etiqueta ?? d.comparacion.nombre).toLowerCase()}` : s.titulo ?? s.id;
    const analista = !!(textos?.[s.id] ?? s.texto)?.trim() && (textos?.[s.id] ?? s.texto) !== textoAuto(d, s.id);
    let bloques: Bloque[];
    switch (s.id) {
      case 'resumen': bloques = sResumen(d, texto, nMet >= 0 ? nMet + 1 : null); break;
      case 'volumen': bloques = sVolumen(d, texto); break;
      case 'alcance': bloques = sAlcance(d, texto); break;
      case 'reparto': bloques = sReparto(d, texto); break;
      case 'ejes': bloques = sEjes(d, texto); break;
      case 'sentimiento': bloques = sSentimiento(d, texto); break;
      case 'publicaciones': bloques = sPublicaciones(d, texto); break;
      case 'medios': bloques = sMedios(d, texto); break;
      case 'comparacion': bloques = sComparacion(d, texto); break;
      case 'metodologia': bloques = sMetodologia(d, texto, analista); break;
      default: bloques = parrafos(texto);
    }
    return { id: s.id, n: i + 1, titulo, salto: SALTO.has(s.id), bloques };
  });
  return { d, secciones };
}

/** Tablas del modelo, para el CSV. */
export function tablasDe(m: Modelo): { seccion: string; tabla: TablaDatos }[] {
  return m.secciones.flatMap((s) => s.bloques.filter((b): b is Extract<Bloque, { t: 'tabla' }> => b.t === 'tabla').map((b) => ({ seccion: `${s.n}. ${s.titulo}`, tabla: b.tabla })));
}
/** Textos tal como salen en el documento (para congelarlos en una edición). */
export function textosDe(d: InformeDatos, textos?: Record<string, string>): Record<string, string> {
  return Object.fromEntries(seccionesDe(d).map((s) => [s.id, textoDe(d, s.id, textos)]));
}

// ---------- pintar ----------
function PintarBloque({ b }: { b: Bloque }) {
  switch (b.t) {
    case 'p': return <p className={b.nota ? 'inf-nota' : 'inf-p'}>{b.texto}</p>;
    case 'h3': return <h3 className="inf-h3">{b.texto}</h3>;
    case 'vacio': return <p className="inf-vacio">{b.texto}</p>;
    case 'kpis': return <div className="inf-kpis">{b.items.map((k, i) => <div key={i} style={{ borderTopColor: k.color }}><b>{k.valor}</b><span>{k.etiqueta}</span></div>)}</div>;
    case 'hallazgos': return b.items.length ? <ol className="inf-hall">{b.items.map((h, i) => <li key={i}><span className="inf-hn">{i + 1}</span><span>{h}</span></li>)}</ol> : <p className="inf-vacio">Sin hallazgos todavía.</p>;
    case 'tabla': return <Tabla t={b.tabla} />;
    case 'fig': return <figure className="inf-fig"><figcaption className="inf-ft">{b.titulo}</figcaption>{b.nodo}{b.fuente ? <p className="inf-fuente">{/^Fuente/.test(b.fuente) ? b.fuente : `Fuente: ${b.fuente}`}</p> : null}</figure>;
    case 'lista': return <ul className="inf-lista">{b.items.map((x, i) => <li key={i}>{x}</li>)}</ul>;
  }
}

const cssTexto = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

export interface PropsInforme {
  datos: InformeDatos;
  /** Textos por sección (los de una edición congelada); si faltan, los guardados o los automáticos. */
  textos?: Record<string, string>;
}

export function Informe({ datos: d, textos }: PropsInforme) {
  const m = armar(d, textos);
  const demo = d.campana.es_demo;
  // Pie y aviso en cada página impresa: cajas de margen de @page (Chromium), fuera del área de contenido.
  const pagina = `@page{size:A4;margin:16mm 15mm 18mm;@bottom-center{content:${cssTexto(PIE)};font:400 7.5pt Helvetica,Arial,'Liberation Sans',sans-serif;color:#7C858C}${demo ? `@top-center{content:${cssTexto(AVISO_DEMO)};font:600 7.5pt Helvetica,Arial,'Liberation Sans',sans-serif;color:#7A5A00}` : ''}}`;
  // Hojas de pantalla: portada y luego una hoja nueva en cada sección con salto.
  const hojas: SeccionModelo[][] = [];
  for (const s of m.secciones) { if (s.salto || !hojas.length) hojas.push([s]); else hojas[hojas.length - 1].push(s); }
  const p = d.portada;
  const aviso = demo ? <p className="inf-aviso" role="note">{AVISO_DEMO}</p> : null;
  const pie = <p className="inf-pie">{PIE}</p>;
  return (
    <div className="inf" lang="es">
      <style dangerouslySetInnerHTML={{ __html: pagina }} />
      <section className="inf-hoja inf-portada" aria-label="Portada">
        {aviso}
        <div className="inf-port">
          <i className="inf-raya" aria-hidden="true" />
          <h1>{p.titulo}</h1>
          {p.subtitulo ? <p className="inf-sub">{p.subtitulo}</p> : null}
          <p>Periodo: {nombrePeriodo(d)}, hora de {ciudad(d.zona)}.{d.periodo.dia_base ? ` El ${diaLargo(d.periodo.dia_base)} es el día base.` : ''}{d.dias.some((x) => x.parcial) ? ` El ${diaLargo(d.dias[d.dias.length - 1].fecha)} es parcial.` : ''}</p>
          {d.canales.length ? <p>Fuentes: {fuentesTxt(d)}.</p> : null}
          {p.nota_portada ? <p className="inf-np">{p.nota_portada}</p> : null}
          <ol className="inf-indice">{m.secciones.map((s) => <li key={s.id}>{s.titulo}</li>)}</ol>
          <p>Fecha del informe: {fecha(p.fecha_informe, 'largo')}</p>
          {p.nota_version ? <p>{p.nota_version}</p> : null}
        </div>
        {pie}
      </section>
      {hojas.map((h, i) => (
        <div className="inf-hoja" key={i}>
          {aviso}
          {h.map((s) => (
            <section className="inf-sec" key={s.id} id={`inf-${s.id}`} aria-labelledby={`inf-h-${s.id}`}>
              <h2 id={`inf-h-${s.id}`}><span className="inf-num">{s.n}</span>{s.titulo}</h2>
              {s.bloques.map((b, j) => <PintarBloque key={j} b={b} />)}
            </section>
          ))}
          {pie}
        </div>
      ))}
      {!m.secciones.length ? <div className="inf-hoja"><p className="inf-vacio">Todas las secciones están apagadas.</p></div> : null}
    </div>
  );
}

export { hallazgos, ejeNombre };
export const SECCION_TITULO: Record<string, string> = Object.fromEntries(SECCIONES.map((s) => [s.id, s.titulo]));
export type { Destacada };
