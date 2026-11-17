// Hallazgos automáticos del Informe: frases cortas y factuales armadas solo con las cifras de informe_datos.
// Son deterministas (mismo JSON, mismo texto). Quien analiza puede editarlas o reemplazarlas en la pantalla del Informe.
// Reglas: sin adjetivos sobre personas ni valoraciones; "posible" para coordinación; las cifras con formato.ts.
import { num } from '../formato';
import type { InformeDatos, SeccionId } from './tipos';
import {
  canalTxt, diaLargo, ejeNombre, enLista, hh, iDia, momentoInf, nombrePeriodo, parte, pc, porCanalTxt, principal, sobre, suma,
  totalCanal, totalSerie, veces,
} from './util';

type H = string[];

function volumen(d: InformeDatos): H {
  const out: H = [];
  const S = d.series;
  const filas = totalSerie(S.filas);
  if (!filas) return out;
  const fuentes = d.canales.filter((c) => totalCanal(S.filas, c) > 0).length;
  const { serie, nombre } = principal(d);
  const tot = totalSerie(serie);
  out.push(`Del ${nombrePeriodo(d)}, se recolectaron ${num(filas)} publicaciones en ${fuentes} ${fuentes === 1 ? 'fuente' : 'fuentes'}. ${num(tot)} son ${nombre}${tot ? `: ${porCanalTxt(d, (c) => totalCanal(serie, c))}` : ''}.`);
  if (d.modo === 'evento') {
    const ib = iDia(d, d.periodo.dia_base), ie = iDia(d, d.periodo.dia_evento);
    if (ib >= 0 && ie >= 0) {
      const b = serie.total[ib] ?? 0, e = serie.total[ie] ?? 0;
      out.push(b > 0
        ? `La conversación pasó de ${num(b)} publicaciones el ${diaLargo(d.periodo.dia_base)} (día base) a ${num(e)} el ${diaLargo(d.periodo.dia_evento)}, ${veces(e / b)} veces la base.`
        : `El día base no tuvo publicaciones en la conversación; el ${diaLargo(d.periodo.dia_evento)} hubo ${num(e)}.`);
    }
    const pico = d.por_hora?.pico.total;
    if (pico && pico.n > 0) {
      out.push(`La hora pico del día del evento fue a las ${hh(pico.hora)}, con ${num(pico.n)} publicaciones${pico.veces_base != null ? `, ${veces(pico.veces_base)} veces el promedio horario del día base` : ''}.`);
    }
    const foco = totalSerie(S.foco);
    if (d.ejes_usados.foco && d.ejes_usados.foco !== d.ejes_usados.conversacion) {
      out.push(foco
        ? `${num(foco)} publicaciones son ${sobre(d, d.ejes_usados.foco)}${ie >= 0 ? `; ${num(S.foco.total[ie] ?? 0)} de ellas (${pc(parte(S.foco.total[ie] ?? 0, foco))}) salieron el día del evento` : ''}.`
        : `Ninguna publicación del periodo quedó marcada ${sobre(d, d.ejes_usados.foco)}.`);
    }
  } else if (tot) {
    const i = serie.total.indexOf(Math.max(...serie.total));
    out.push(`El día con más ítems fue el ${diaLargo(d.dias[i]?.fecha)}, con ${num(serie.total[i])}.`);
    for (const c of d.canales) {
      const v = serie.por_canal[c] ?? [];
      const t = suma(v);
      if (!t || d.canales.length < 2) continue;
      const j = v.indexOf(Math.max(...v));
      out.push(`${canalTxt(c)}: ${num(t)} ítems, con el máximo el ${diaLargo(d.dias[j]?.fecha)} (${num(v[j])}).`);
    }
  }
  const otro = totalSerie(S.otro_pais);
  if (otro) out.push(`Aparte se contaron ${num(otro)} publicaciones marcadas de otro país, que no entran en la conversación.`);
  return out;
}

function alcance(d: InformeDatos): H {
  const out: H = [];
  const { serie, vistas } = principal(d);
  const tot = totalSerie(serie), v = totalSerie(vistas);
  if (!tot) return out;
  const inter = d.modo === 'evento' ? totalSerie(d.series.interaccion_conversacion) : null;
  out.push(`Las ${num(tot)} publicaciones sumaron ${num(v)} visualizaciones registradas${inter != null ? ` y ${num(inter)} interacciones` : ''}. Son las cifras que muestra cada plataforma al momento de la recolección, no personas únicas.`);
  const top = [...d.canales].sort((a, b) => totalCanal(vistas, b) - totalCanal(vistas, a))[0];
  if (top && v) out.push(`${canalTxt(top)} reúne el ${pc(parte(totalCanal(vistas, top), v))} de las visualizaciones.`);
  if (d.modo === 'evento') {
    const ib = iDia(d, d.periodo.dia_base), ie = iDia(d, d.periodo.dia_evento);
    if (ib >= 0 && ie >= 0) out.push(`El día del evento las plataformas sumaron ${num(vistas.total[ie] ?? 0)} visualizaciones frente a ${num(vistas.total[ib] ?? 0)} el día base.`);
  }
  const sinV = d.canales.filter((c) => totalCanal(serie, c) > 0 && totalCanal(vistas, c) === 0).map(canalTxt);
  if (sinV.length) out.push(`${enLista(sinV)} no ${sinV.length === 1 ? 'informa' : 'informan'} visualizaciones.`);
  return out;
}

function reparto(d: InformeDatos): H {
  const out: H = [];
  const des = d.modo === 'evento' ? (d.ejes_usados.foco ? d.desglose.foco : d.desglose.conversacion) : null;
  if (des && des.total.publicaciones) {
    const filas = des.filas.filter((f) => f.publicaciones > 0);
    const p = [...filas].sort((a, b) => b.publicaciones - a.publicaciones)[0];
    const v = [...filas].filter((f) => f.pct_vistas != null).sort((a, b) => b.vistas - a.vistas)[0];
    const i = [...filas].sort((a, b) => b.interaccion - a.interaccion)[0];
    out.push(`Se cuentan ${num(des.total.publicaciones)} publicaciones ${sobre(d, d.ejes_usados.foco ?? d.ejes_usados.conversacion)}. ${canalTxt(p.canal)} tiene la mayor parte (${pc(p.pct_publicaciones)}).`);
    if (v && v.canal !== p.canal) out.push(`En visualizaciones, ${canalTxt(v.canal)} reúne el ${pc(v.pct_vistas)}.`);
    else if (v) out.push(`${canalTxt(v.canal)} también reúne el ${pc(v.pct_vistas)} de las visualizaciones.`);
    if (i && i.interaccion) out.push(`En interacción, ${canalTxt(i.canal)} reúne el ${pc(i.pct_interaccion)} (${num(i.interaccion)}).`);
    return out;
  }
  const { serie, vistas } = principal(d);
  const tot = totalSerie(serie);
  if (!tot) return out;
  const orden = [...d.canales].sort((a, b) => totalCanal(serie, b) - totalCanal(serie, a));
  out.push(`${canalTxt(orden[0])} tiene el ${pc(parte(totalCanal(serie, orden[0]), tot))} de los ${num(tot)} ítems.`);
  const tv = totalSerie(vistas);
  if (tv) {
    const ov = [...d.canales].sort((a, b) => totalCanal(vistas, b) - totalCanal(vistas, a))[0];
    out.push(`${canalTxt(ov)} reúne el ${pc(parte(totalCanal(vistas, ov), tv))} de las visualizaciones registradas.`);
  }
  return out;
}

function ejes(d: InformeDatos): H {
  const out: H = [];
  const l = d.ejes.lista;
  if (!l.length) return out;
  const dup = totalSerie(d.series.sin_duplicados);
  out.push(`Se siguen ${l.length} ${l.length === 1 ? 'eje' : 'ejes'}. Sin duplicados suman ${num(dup)} ítems; un ítem puede estar en varios ejes, por eso la suma de los ejes (${num(suma(l.map((e) => e.total)))}) es mayor.`);
  const top = [...l].sort((a, b) => b.total - a.total)[0];
  if (top.total) {
    const c = Object.entries(top.por_canal).sort((a, b) => b[1].total - a[1].total)[0];
    out.push(`El eje con más ítems es ${top.nombre} (${num(top.total)})${c ? `, sobre todo en ${canalTxt(c[0])} (${num(c[1].total)})` : ''}.`);
  }
  const topes = l.reduce((n, e) => n + Object.values(e.por_canal).reduce((m, x) => m + x.tope.filter(Boolean).length, 0), 0);
  if (topes) out.push(`En ${topes} ${topes === 1 ? 'combinación' : 'combinaciones'} de eje, fuente y día la recolección llegó al tope: esas cifras son un mínimo.`);
  const sin = totalSerie(d.series.sin_eje);
  if (sin) out.push(`${num(sin)} filas recolectadas no entran en ningún eje.`);
  return out;
}

function sentimiento(d: InformeDatos): H {
  const out: H = [];
  const nombre = (id: string) => d.codigos.find((c) => c.id === id)?.nombre ?? 'Sin nombre';
  for (const m of d.muestras) {
    if (!m.n) continue;
    const s = m.ponderado ?? { favorable: m.sentimiento.favorable.pct ?? 0, desfavorable: m.sentimiento.desfavorable.pct ?? 0, neutral: m.sentimiento.neutral.pct ?? 0 };
    out.push(`En la muestra "${m.nombre}" (${num(m.n)} ${m.objeto === 'comentarios' ? 'comentarios' : 'publicaciones'}${m.ponderado ? ', ponderada por volumen' : ''}), el ${pc(s.favorable)} es favorable, el ${pc(s.desfavorable)} crítico y el ${pc(s.neutral)} neutral u otro${m.ponderado ? '' : m.margen_max != null ? ` (margen máximo ±${m.margen_max} puntos)` : ''}.`);
    const t = m.temas[0];
    if (t) out.push(`El tema más frecuente en "${m.nombre}" es ${nombre(t.codigo_id)} (${pc(t.pct_ponderado ?? t.pct)}).`);
  }
  return out;
}

function publicaciones(d: InformeDatos): H {
  const out: H = [];
  for (const c of d.canales) {
    const r = d.rankings.publicaciones[c];
    const p = r?.por_vistas?.[0];
    if (p && p.vistas) out.push(`En ${canalTxt(c)}, la publicación con más visualizaciones (${num(p.vistas)}) es de ${p.cuenta.visible ? p.cuenta.etiqueta : 'una cuenta personal'}, ${momentoInf(p.publicada_en, d.zona)}.`);
  }
  const cp = d.cuentas_propias;
  if (cp.autores.length) {
    const n = suma(cp.por_canal.map((x) => x.en_ambito)), v = suma(cp.por_canal.map((x) => x.vistas));
    out.push(`Las cuentas propias (${enLista([...new Set(cp.autores.map((a) => a.etiqueta))])}) publicaron ${num(n)} piezas en el ámbito del informe; todo lo que publicaron en el periodo suma ${num(v)} visualizaciones.`);
  }
  const ct = d.comentarios.total;
  if (ct.comentarios) out.push(`Se recolectaron ${num(ct.comentarios)} comentarios en ${num(ct.publicaciones)} publicaciones; ${num(ct.en_ambito)} están en publicaciones del ámbito.`);
  return out;
}

function medios(d: InformeDatos): H {
  const out: H = [];
  const m = d.medios;
  if (m.total_titulares) {
    const primero = m.titulares[0];
    out.push(`${num(m.total_titulares)} ${m.total_titulares === 1 ? 'artículo' : 'artículos'} de ${m.por_fuente.length} ${m.por_fuente.length === 1 ? 'medio' : 'medios'} trataron el tema${primero?.publicada_en ? `; el primero, ${momentoInf(primero.publicada_en, d.zona)}` : ''}.`);
    const f = m.por_fuente[0];
    if (f && m.por_fuente.length > 1) out.push(`${f.fuente} publicó más artículos (${num(f.articulos)}).`);
  }
  for (const [c, l] of Object.entries(m.cuentas)) {
    if (!l.length) continue;
    out.push(`En ${canalTxt(c)}, ${l.length} ${l.length === 1 ? 'cuenta de medio publicó' : 'cuentas de medios publicaron'}; la primera, ${momentoInf(l[0].primera, d.zona)}.`);
  }
  return out;
}

function comparacion(d: InformeDatos): H {
  const out: H = [];
  const cmp = d.comparacion;
  if (!cmp) return out;
  const i = d.modo === 'evento' ? iDia(d, d.periodo.dia_evento) : -1;
  const conv = d.series.conversacion, co = d.series.comparacion;
  const pick = (a: number[] | undefined) => (i >= 0 ? a?.[i] ?? 0 : suma(a));
  const t = pick(conv.total), n = pick(co.total);
  if (!t) return out;
  const cuando = i >= 0 ? `El ${diaLargo(d.periodo.dia_evento)}` : 'En el periodo';
  const etq = (cmp.etiqueta ?? cmp.nombre).toLowerCase();
  out.push(`${cuando}, ${num(n)} de ${num(t)} publicaciones de la conversación (${pc(parte(n, t))}) cumplen "${etq}".`);
  const por = d.canales.filter((c) => pick(conv.por_canal[c]) > 0).map((c) => `${canalTxt(c)} ${pc(parte(pick(co.por_canal[c]), pick(conv.por_canal[c])))}`);
  if (por.length > 1) out.push(`Por plataforma: ${enLista(por)}.`);
  return out;
}

function metodologia(d: InformeDatos): H {
  const out: H = [];
  const r = d.recolecciones.filter((x) => d.canales.includes(x.canal));
  if (r.length) {
    const tope = r.filter((x) => x.llego_al_tope).length;
    out.push(`Se registraron ${r.length} ${r.length === 1 ? 'recolección' : 'recolecciones'}${tope ? `; ${tope} llegaron al tope de filas, por eso esos conteos son un mínimo` : ''}.`);
  }
  return out;
}

const POR_SECCION: Record<string, (d: InformeDatos) => H> = { volumen, alcance, reparto, ejes, sentimiento, publicaciones, medios, comparacion, metodologia };

/** Hallazgos automáticos de una sección. Resumen: el primero de cada sección más el pico. */
export function hallazgos(d: InformeDatos, id: SeccionId): H {
  if (id === 'resumen') {
    const v = volumen(d);
    const r = [v[0], v[1], d.modo === 'evento' ? v[2] : null, alcance(d)[0], comparacion(d)[0], sentimiento(d)[0], medios(d)[0], d.modo === 'tema' ? ejes(d)[1] : null];
    return r.filter((x): x is string => !!x).slice(0, 7);
  }
  return POR_SECCION[id]?.(d) ?? [];
}

/** Texto automático de una sección tal como se precarga en el editor: el resumen, un hallazgo por línea; el resto, un párrafo. */
export function textoAuto(d: InformeDatos, id: SeccionId): string {
  const h = hallazgos(d, id);
  return id === 'resumen' ? h.join('\n') : h.join(' ');
}
export { ejeNombre };
