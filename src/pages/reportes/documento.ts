// Documento de reporte: arma el contenido (misma forma que reporte_envios.contenido) a partir de los datos reales
// de la campaña. Lo usan la vista previa de Reportes, "Enviar ahora" (guarda una copia) y el panel Descargar reporte.
// Aquí no hay cifras ni nombres escritos: todo sale de las tablas. Lo que no existe queda como sección vacía.
import { db } from '../../lib/db';
import { compacto, diaEn, diasEntre, fecha, neto, num, pct, rango } from '../../lib/formato';
import {
  ALERTAS_ABIERTAS, type Alerta, type Campana, type Evento, type EventoMensaje, type EventoParticipante, type FiguraCampana,
  type Mencion, type Narrativa, type NotaInterna, type Tema,
} from '../../lib/tipos';

// ---------- forma del contenido ----------
export interface ItemDoc {
  texto: string; detalle?: string; enlace?: string; barra?: number; tono?: string; chip?: string; chip_tono?: string; valor?: string; valor2?: string;
}
export interface CifraDoc { etiqueta: string; valor: string; detalle?: string }
export interface PuntoDoc { texto: string; por_que?: string; que_hacer?: string }
export interface SeccionDoc {
  id: string; pagina?: number; titulo: string; ia?: boolean; nota?: string; texto?: string;
  /** Mensaje cuando la sección no tiene datos todavía. */
  vacio?: string;
  cifras?: CifraDoc[]; puntos?: PuntoDoc[]; items?: ItemDoc[];
}
export interface Contenido { tipo_doc?: string; titulo?: string; meta?: string; marca?: 'Consultora' | 'Cliente'; secciones?: SeccionDoc[]; generado_desde?: string }
export interface SeccionCfg { id: string; titulo: string; ia?: boolean; activa?: boolean }

// ---------- catálogos fijos de la interfaz ----------
export const TIPOS_REPORTE = ['Corte diario', 'Semanal de narrativas', 'Post-evento', 'A la medida'] as const;
export const FRECUENCIAS = ['Diario', 'Semanal', 'Por evento', 'Una vez'] as const;
export const FORMATOS_DEST = ['Correo con PDF', 'Enlace con acceso', 'WhatsApp resumen'] as const;
export const DIAS_SEMANA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

/** Secciones disponibles por tipo, para reportes nuevos sin plantilla. */
export const SECCIONES_TIPO: Record<string, SeccionCfg[]> = {
  'Corte diario': [
    { id: 'esencial', titulo: 'Lo esencial', ia: true }, { id: 'cifras', titulo: 'Cifras del día' },
    { id: 'alertas', titulo: 'Alertas abiertas' }, { id: 'narr', titulo: 'Narrativas en movimiento' }, { id: 'medios', titulo: 'Medios' },
    { id: 'rivales', titulo: 'Rivales' }, { id: 'agenda', titulo: 'Agenda de hoy y próximos eventos' }, { id: 'reco', titulo: 'Recomendación', ia: true },
  ],
  'Semanal de narrativas': [
    { id: 'resumen', titulo: 'Resumen ejecutivo', ia: true }, { id: 'narr', titulo: 'Narrativas' }, { id: 'temas', titulo: 'Temas' },
    { id: 'part', titulo: 'Participación por figura' }, { id: 'vigilar', titulo: 'Para vigilar' },
  ],
  'Post-evento': [
    { id: 'balance', titulo: 'Balance', ia: true }, { id: 'cifras', titulo: 'Cifras del evento' }, { id: 'curva', titulo: 'Antes, durante y después' },
    { id: 'gano', titulo: 'Quién ganó la conversación' }, { id: 'mensajes', titulo: 'Mensajes clave' }, { id: 'medios', titulo: 'Cobertura en medios' },
    { id: 'rivales', titulo: 'Reacciones de rivales' }, { id: 'aprend', titulo: 'Aprendizajes' },
  ],
  'A la medida': [
    { id: 'resumen', titulo: 'Resumen', ia: true }, { id: 'cifras', titulo: 'Cifras del periodo' }, { id: 'part', titulo: 'Participación por figura' },
    { id: 'temas', titulo: 'Temas' }, { id: 'narr', titulo: 'Narrativas' }, { id: 'alertas', titulo: 'Alertas abiertas' }, { id: 'agenda', titulo: 'Próximos eventos' },
  ],
};
/** Sección de texto de análisis por defecto de cada tipo. */
export const ANALISIS_TIPO: Record<string, string> = { 'Corte diario': 'reco', 'Semanal de narrativas': 'resumen', 'Post-evento': 'balance', 'A la medida': 'resumen' };

// ---------- datos ----------
export interface DatosDoc {
  campana: Campana; hoy: string;
  figuras: FiguraCampana[]; alertas: Alerta[]; narrativas: Narrativa[]; temas: Tema[]; eventos: Evento[]; menciones: Mencion[];
  /** Figura del documento: la de un perfil o la propia de la campaña. */
  figura: FiguraCampana | null;
  evento: Evento | null; participantes: EventoParticipante[]; mensajes: EventoMensaje[];
  notas: NotaInterna[] | null;
}
export const TABLAS_DOC = ['v_figuras_campana', 'alertas', 'narrativas', 'temas', 'eventos', 'menciones', 'evento_participantes', 'evento_mensajes', 'notas_internas'];

/** Evento que cubre un post-evento: el indicado o el último evento ya ocurrido que no esté cancelado. */
export function eventoPorDefecto(eventos: Evento[], hoy: string): Evento | null {
  const pasados = eventos.filter((e) => e.fecha_inicio && e.fecha_inicio <= hoy && e.estado !== 'Cancelado' && e.estado !== 'Borrador' && e.menciones != null);
  return pasados.sort((a, b) => (b.fecha_inicio ?? '').localeCompare(a.fecha_inicio ?? ''))[0] ?? null;
}

export async function cargarDatos(campana: Campana, hoy: string, o: { eventoId?: string | null; figuraId?: string | null; conEvento?: boolean; conNotas?: boolean } = {}): Promise<DatosDoc> {
  const cid = campana.id;
  const [figuras, alertas, narrativas, temas, eventos] = await Promise.all([
    db.listar<FiguraCampana>('v_figuras_campana', { eq: { campana_id: cid }, orden: [['participacion', 'desc'], ['orden', 'asc']] }),
    db.listar<Alerta>('alertas', { eq: { campana_id: cid, estado: ALERTAS_ABIERTAS }, orden: 'orden' }),
    db.listar<Narrativa>('narrativas', { eq: { campana_id: cid }, orden: [['menciones', 'desc']] }),
    db.listar<Tema>('temas', { eq: { campana_id: cid }, orden: 'orden' }),
    db.listar<Evento>('eventos', { eq: { campana_id: cid }, orden: 'fecha_inicio' }),
  ]);
  const figuraId = o.figuraId ?? campana.figura_propia_id;
  const figura = figuras.find((f) => f.figura_id === figuraId) ?? null;
  const evento = o.eventoId ? eventos.find((e) => e.id === o.eventoId) ?? null : o.conEvento ? eventoPorDefecto(eventos, hoy) : null;
  const [menciones, participantes, mensajes, notas] = await Promise.all([
    db.listar<Mencion>('menciones', { eq: figura ? { campana_id: cid, figura_id: figura.figura_id } : { campana_id: cid }, neq: { estado: 'Descartada' }, orden: [['alcance', 'desc']], limite: 5 }),
    evento ? db.listar<EventoParticipante>('evento_participantes', { eq: { evento_id: evento.id }, orden: 'orden' }) : Promise.resolve([]),
    evento ? db.listar<EventoMensaje>('evento_mensajes', { eq: { evento_id: evento.id }, orden: 'orden' }) : Promise.resolve([]),
    o.conNotas ? db.listar<NotaInterna>('notas_internas', { eq: { campana_id: cid }, orden: [['creada_en', 'desc']], limite: 50 }).catch(() => []) : Promise.resolve(null),
  ]);
  return { campana, hoy, figuras, alertas, narrativas, temas, eventos, menciones, figura, evento, participantes, mensajes, notas };
}

// ---------- secciones ----------
const DIR: Record<string, { chip: string; tono: string }> = {
  Favorable: { chip: 'A favor', tono: 'fav' }, Desfavorable: { chip: 'En contra', tono: 'unf' },
  Posicionamiento: { chip: 'Posicionamiento', tono: 'watch' }, 'Sin dirección': { chip: 'Sin dirección', tono: 'watch' },
};
const SEV_TONO: Record<string, string> = { Alta: 'unf', Media: 'warn', Baja: 'watch' };
const SENT_TONO: Record<string, string> = { Favorable: 'fav', Neutral: 'watch', Desfavorable: 'unf' };
const MSJ_TONO: Record<string, string> = { 'Aterrizó': 'fav', Parcial: 'warn', 'No aterrizó': 'unf' };
const REL_TONO: Record<string, string> = { Propia: 'own', Aliada: 'fav', Rival: 'unf', 'A observar': 'watch' };
const plural = (n: number, uno: string, varios: string) => `${num(n)} ${n === 1 ? uno : varios}`;
const barra = (v: number | null | undefined, max: number) => (v == null || max <= 0 ? 0 : Math.round((v / max) * 100));
const nombreFig = (d: DatosDoc, id: string | null | undefined) => d.figuras.find((f) => f.figura_id === id)?.nombre ?? 'Figura sin nombre';
const nombreNarr = (d: DatosDoc, id: string | null | undefined) => d.narrativas.find((n) => n.id === id)?.nombre ?? null;
const may = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function narrativasDe(d: DatosDoc): Narrativa[] {
  const id = d.figura?.figura_id;
  if (!id) return d.narrativas;
  return d.narrativas.filter((n) => n.figura_id === id || (Array.isArray(n.detalle?.figura_ids) && n.detalle.figura_ids.includes(id)));
}

function generar(d: DatosDoc, id: string, porEvento: boolean): Omit<SeccionDoc, 'id' | 'titulo' | 'ia'> {
  const f = d.figura, ev = porEvento ? d.evento : null;
  switch (id) {
    case 'cifras':
      if (ev) {
        return {
          nota: `Ventana de ${ev.ventana_horas} horas antes y después`,
          cifras: [
            { etiqueta: 'Menciones', valor: num(ev.menciones), detalle: ev.menciones_antes != null ? `${num(ev.menciones_antes)} antes del evento` : undefined },
            { etiqueta: 'Alcance', valor: compacto(ev.alcance) },
            { etiqueta: 'Sentimiento neto', valor: neto(ev.neto), detalle: ev.neto_antes != null ? `Antes: ${neto(ev.neto_antes)}` : undefined },
            { etiqueta: 'Notas en medios', valor: num(ev.notas_medios) },
          ],
        };
      }
      if (!f) return { vacio: 'La campaña todavía no tiene figura propia con cifras.' };
      {
        const lugar = d.figuras.findIndex((x) => x.figura_id === f.figura_id) + 1;
        return {
          nota: d.campana.periodo_inicio ? `Corte del ${rango(d.campana.periodo_inicio, d.campana.periodo_fin)}` : undefined,
          cifras: [
            { etiqueta: 'Menciones', valor: num(f.menciones), detalle: `de ${num(d.figuras.reduce((n, x) => n + x.menciones, 0))} entre ${plural(d.figuras.length, 'figura', 'figuras')}` },
            { etiqueta: 'Participación', valor: pct(f.participacion), detalle: lugar === 1 ? 'Primer lugar' : lugar ? `Lugar ${lugar}` : undefined },
            { etiqueta: 'Sentimiento neto', valor: neto(f.neto), detalle: f.favorable != null ? `${f.favorable}% favorable, ${f.desfavorable}% desfavorable` : undefined },
            { etiqueta: 'Índice de riesgo', valor: f.riesgo != null ? String(f.riesgo) : 'Sin datos', detalle: f.riesgo_nivel ?? undefined },
          ],
        };
      }
    case 'alertas':
      if (!d.alertas.length) return { nota: 'Ninguna abierta', vacio: 'No hay alertas abiertas.' };
      return {
        nota: plural(d.alertas.length, 'abierta', 'abiertas'),
        items: d.alertas.map((a) => ({ texto: a.texto, chip: a.severidad, chip_tono: SEV_TONO[a.severidad] ?? 'watch', valor: a.estado })),
      };
    case 'narr': {
      const l = narrativasDe(d).slice(0, 6);
      if (!l.length) return { vacio: 'Todavía no hay narrativas detectadas.' };
      const max = Math.max(1, ...l.map((n) => n.menciones));
      return {
        nota: f ? `Sobre ${f.nombre}` : undefined,
        items: l.map((n) => {
          const dir = DIR[n.direccion] ?? DIR['Sin dirección'];
          return { texto: n.nombre, detalle: n.tendencia ?? undefined, chip: dir.chip, chip_tono: dir.tono, valor: num(n.menciones), barra: barra(n.menciones, max), tono: dir.tono };
        }),
      };
    }
    case 'medios':
      if (ev) {
        const c = ev.resultados?.cobertura;
        if (!c) return { vacio: 'Sin cobertura registrada para este evento.' };
        return {
          nota: `${num(c.favorables ?? 0)} favorables, ${num(c.neutrales ?? 0)} neutrales, ${num(c.desfavorables ?? 0)} desfavorables`,
          items: [['Medios digitales', c.digitales], ['Radio', c.radio], ['Televisión', c.television]]
            .filter(([, v]) => v != null).map(([t, v]) => ({ texto: String(t), valor: plural(Number(v), 'nota', 'notas') })),
        };
      } else {
        const c = f?.detalle?.cobertura;
        const medios: Array<{ medio: string; notas: number }> = Array.isArray(c?.por_medio) ? c.por_medio : [];
        if (!c || !medios.length) return { vacio: 'Sin notas de medios en el periodo.' };
        const total = (c.favorables ?? 0) + (c.neutrales ?? 0) + (c.desfavorables ?? 0);
        return {
          nota: `${plural(total, 'nota', 'notas')} · ${num(c.favorables ?? 0)} favorables, ${num(c.neutrales ?? 0)} neutrales, ${num(c.desfavorables ?? 0)} desfavorables`,
          items: medios.map((m) => ({ texto: m.medio, valor: plural(m.notas, 'nota', 'notas') })),
        };
      }
    case 'rivales':
      if (ev) {
        const r: Array<{ figura_id: string; publicaciones?: number; narrativa_id?: string | null; menciones?: number | null }> = ev.resultados?.reacciones ?? [];
        if (!r.length) return { vacio: 'Sin reacciones de rivales registradas.' };
        return { items: r.map((x) => ({ texto: nombreFig(d, x.figura_id), detalle: nombreNarr(d, x.narrativa_id) ?? 'Sin mensaje', valor: plural(x.publicaciones ?? 0, 'publicación', 'publicaciones'), valor2: x.menciones != null ? `${num(x.menciones)} menciones` : undefined })) };
      } else {
        const r = d.figuras.filter((x) => x.relacion === 'Rival');
        if (!r.length) return { vacio: 'Sin rivales en seguimiento.' };
        return { nota: 'Corte del periodo', items: r.map((x) => ({ texto: x.nombre, detalle: `Participación ${pct(x.participacion)} · neto ${neto(x.neto)}`, valor: `${num(x.menciones)} menciones`, valor2: x.riesgo != null ? `Riesgo ${x.riesgo}` : undefined })) };
      }
    case 'agenda': {
      const l = d.eventos.filter((e) => e.estado !== 'Cancelado' && e.fecha_inicio && (e.fecha_fin ?? e.fecha_inicio) >= d.hoy).slice(0, 5);
      if (!l.length) return { vacio: 'Sin eventos por venir.' };
      return {
        items: l.map((e) => {
          const lugar = [e.sede, e.ciudad].filter(Boolean).join(', ');
          const dias = diasEntre(d.hoy, e.fecha_inicio);
          if (dias != null && dias <= 0) return { texto: e.nombre, detalle: lugar || e.tipo, chip: 'Hoy', chip_tono: 'live' };
          return { texto: e.nombre, detalle: lugar || e.tipo, valor: may(fecha(e.fecha_inicio, 'corto')), valor2: dias != null ? `En ${dias} ${dias === 1 ? 'día' : 'días'}` : undefined };
        }),
      };
    }
    case 'temas': {
      if (!d.temas.length) return { vacio: 'Los temas aparecen cuando hay menciones clasificadas.' };
      const max = Math.max(1, ...d.temas.map((t) => t.porcentaje ?? 0));
      return { items: d.temas.map((t) => ({ texto: t.nombre, detalle: t.tendencia ?? undefined, barra: barra(t.porcentaje, max), tono: t.es_propio ? 'own' : 'watch', valor: pct(t.porcentaje, 0), valor2: `${num(t.menciones)} menciones` })) };
    }
    case 'part': case 'rivales_comp': {
      if (!d.figuras.length) return { vacio: 'Sin figuras en seguimiento.' };
      const max = Math.max(1, ...d.figuras.map((x) => x.participacion ?? 0));
      return { items: d.figuras.map((x) => ({ texto: x.nombre, detalle: x.relacion, barra: barra(x.participacion, max), tono: REL_TONO[x.relacion], valor: pct(x.participacion), valor2: `neto ${neto(x.neto)}` })) };
    }
    case 'vigilar': {
      const n = narrativasDe(d).filter((x) => x.direccion === 'Desfavorable' && (x.tendencia === 'En aumento' || x.tendencia === 'Emergente'));
      const a = d.alertas.filter((x) => x.severidad === 'Alta');
      if (!n.length && !a.length) return { vacio: 'Nada en aumento en contra ni alertas altas abiertas.' };
      return {
        items: [
          ...n.map((x) => ({ texto: x.nombre, detalle: `Narrativa ${x.tendencia?.toLowerCase()}`, chip: 'En contra', chip_tono: 'unf', valor: num(x.menciones) })),
          ...a.map((x) => ({ texto: x.texto, detalle: 'Alerta abierta', chip: x.severidad, chip_tono: 'unf' })),
        ],
      };
    }
    case 'curva': {
      if (!ev) return { vacio: 'Elige un evento para ver su curva.' };
      const v = [['Antes', ev.menciones_antes], ['Durante', ev.menciones_durante], ['Después', ev.menciones_despues]] as Array<[string, number | null]>;
      if (v.every(([, x]) => x == null)) return { vacio: 'Sin menciones por tramo para este evento.' };
      const max = Math.max(1, ...v.map(([, x]) => x ?? 0));
      return { nota: `Ventana de ${ev.ventana_horas} horas`, items: v.map(([t, x]) => ({ texto: t, barra: barra(x, max), tono: 'own', valor: num(x) })) };
    }
    case 'gano': {
      if (!d.participantes.length) return { vacio: 'Sin participantes con cifras.' };
      const max = Math.max(1, ...d.participantes.map((p) => p.participacion ?? 0));
      return { items: d.participantes.map((p) => ({ texto: nombreFig(d, p.figura_id), detalle: p.rol, barra: barra(p.participacion, max), tono: REL_TONO[d.figuras.find((x) => x.figura_id === p.figura_id)?.relacion ?? ''] ?? 'watch', valor: pct(p.participacion), valor2: `neto ${neto(p.neto)}` })) };
    }
    case 'mensajes': {
      if (!d.mensajes.length) return { vacio: 'Sin mensajes clave definidos para este evento.' };
      return { items: d.mensajes.map((m) => ({ texto: m.texto, chip: m.estado ?? undefined, chip_tono: m.estado ? MSJ_TONO[m.estado] ?? 'watch' : undefined, valor: m.menciones != null ? `${num(m.menciones)} menciones` : undefined, valor2: m.porcentaje != null ? pct(m.porcentaje) : undefined })) };
    }
    case 'publicaciones': {
      const p: Array<{ titulo: string; canal?: string; origen?: string; metrica?: string; valor?: number }> = ev?.resultados?.publicaciones ?? [];
      if (!p.length) return { vacio: 'Sin publicaciones destacadas registradas.' };
      return { items: p.map((x) => ({ texto: x.titulo, detalle: [x.canal, x.origen].filter(Boolean).join(' · ') || undefined, valor: x.valor != null ? compacto(x.valor) : undefined, valor2: x.metrica })) };
    }
    case 'menciones': {
      if (!d.menciones.length) return { vacio: 'Sin menciones registradas.' };
      return { items: d.menciones.map((m) => ({ texto: m.titulo ?? m.resumen ?? 'Mención sin título', detalle: [m.fuente, m.canal].filter(Boolean).join(' · '), chip: m.sentimiento_manual ?? m.sentimiento ?? undefined, chip_tono: SENT_TONO[m.sentimiento_manual ?? m.sentimiento ?? ''], valor: m.alcance != null ? compacto(m.alcance) : undefined, valor2: m.alcance != null ? 'alcance' : undefined })) };
    }
    case 'eventos_recientes': case 'eventos_semana': {
      const desde = id === 'eventos_semana' ? 7 : 30;
      const l = d.eventos.filter((e) => { const x = diasEntre(e.fecha_inicio, d.hoy); return x != null && x >= 0 && x < desde; });
      if (!l.length) return { vacio: `Sin eventos en los últimos ${desde} días.` };
      return { items: l.map((e) => ({ texto: e.nombre, detalle: `${may(fecha(e.fecha_inicio, 'corto'))} · ${e.tipo}`, chip: e.estado, chip_tono: 'watch', valor: e.menciones != null ? `${num(e.menciones)} menciones` : undefined })) };
    }
    case 'fig_cifras':
      if (!f) return { vacio: 'Sin figura.' };
      return { cifras: [
        { etiqueta: 'Menciones', valor: num(f.menciones) }, { etiqueta: 'Participación', valor: pct(f.participacion) },
        { etiqueta: 'Alcance', valor: compacto(f.alcance) }, { etiqueta: 'Interacción', valor: compacto(f.interaccion) },
      ] };
    case 'fig_sent':
      if (!f) return { vacio: 'Sin figura.' };
      return { cifras: [
        { etiqueta: 'Favorable', valor: pct(f.favorable, 0) }, { etiqueta: 'Neutral', valor: pct(f.neutral, 0) }, { etiqueta: 'Desfavorable', valor: pct(f.desfavorable, 0) },
        { etiqueta: 'Sentimiento neto', valor: neto(f.neto) }, { etiqueta: 'Índice de riesgo', valor: f.riesgo != null ? String(f.riesgo) : 'Sin datos', detalle: f.riesgo_nivel ?? undefined },
      ] };
    case 'balance':
      if (ev?.veredicto) return { texto: ev.veredicto };
      return { vacio: 'Sin balance escrito todavía.' };
    case 'aprend':
      if (ev?.aprendizajes) return { texto: ev.aprendizajes };
      return { vacio: 'Sin aprendizajes registrados.' };
    case 'notas':
      if (!d.notas?.length) return { vacio: 'Sin notas internas.' };
      return { items: d.notas.map((n) => ({ texto: n.texto, detalle: fecha(diaEn(n.creada_en, d.campana.zona_horaria), 'corto') })) };
    default:
      return { vacio: 'Texto de análisis sin escribir.' };
  }
}

export interface Config {
  tipo: string; nombre: string; secciones: SeccionCfg[];
  marca?: 'Consultora' | 'Cliente';
  /** Texto de análisis escrito por el equipo, para la sección indicada. */
  analisis?: { id: string; texto: string } | null;
  /** Último documento guardado de este reporte: de ahí se toman los textos de las secciones de análisis. */
  previo?: Contenido | null;
  perfil?: boolean;
}

/** Arma el documento con los datos actuales. Las secciones apagadas (activa === false) no entran. */
export function construir(d: DatosDoc, c: Config): Contenido {
  const porEvento = c.tipo === 'Post-evento' && !!d.evento;
  const activas = c.secciones.filter((s) => s.activa !== false);
  const secciones: SeccionDoc[] = activas.map((s, i) => {
    const base = { id: s.id, titulo: s.titulo, ia: !!s.ia, pagina: activas.length > 4 && i >= 3 ? 2 : 1 };
    const previa = c.previo?.secciones?.find((x) => x.id === s.id);
    if (c.analisis && c.analisis.id === s.id && c.analisis.texto.trim()) {
      const texto = c.analisis.texto.trim();
      // Si el texto es el borrador guardado sin cambios sigue marcado como IA; si lo escribió el equipo, no.
      return { ...base, ia: base.ia && previa?.texto?.trim() === texto, texto };
    }
    if (s.ia) {
      if (previa && (previa.texto || previa.puntos?.length)) return { ...base, nota: previa.nota, texto: previa.texto, puntos: previa.puntos };
      if (s.id === 'balance' && porEvento) return { ...base, ...generar(d, s.id, porEvento) };
      return { ...base, vacio: 'Texto de análisis sin escribir. Se escribe en el editor del reporte.' };
    }
    return { ...base, ...generar(d, s.id, porEvento) };
  });
  const propia = d.figura;
  const cam = d.campana.titulo_largo ?? d.campana.nombre;
  let titulo: string, meta: string, tipoDoc: string;
  if (porEvento && d.evento) {
    const e = d.evento;
    titulo = e.nombre;
    tipoDoc = 'Reporte post-evento';
    meta = [may(fecha(e.fecha_inicio, 'completo')), [e.sede, e.ciudad].filter(Boolean).join(', '), `ventana de ${e.ventana_horas} horas antes y después`].filter(Boolean).join(' · ');
  } else if (c.perfil && propia) {
    titulo = propia.nombre;
    tipoDoc = 'Perfil de figura';
    meta = [propia.cargo, propia.relacion, cam, d.campana.periodo_inicio ? rango(d.campana.periodo_inicio, d.campana.periodo_fin) : null].filter(Boolean).join(' · ');
  } else {
    const f = fecha(d.hoy, 'completo');
    titulo = `${c.nombre} del ${f.charAt(0).toLowerCase()}${f.slice(1)}`;
    tipoDoc = c.tipo;
    meta = [propia?.nombre, cam, d.campana.periodo_inicio ? `cifras del ${rango(d.campana.periodo_inicio, d.campana.periodo_fin)}` : null].filter(Boolean).join(' · ');
  }
  return { tipo_doc: tipoDoc, titulo, meta, marca: c.marca ?? 'Consultora', secciones, generado_desde: 'datos de la campaña' };
}

// ---------- archivos ----------
const csvCelda = (v: string | number | null | undefined) => {
  const s = v == null ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/** CSV con las cifras agregadas del documento: sin textos de análisis ni de menciones. */
export function aCsv(c: Contenido): string {
  const filas: string[][] = [['Sección', 'Elemento', 'Detalle', 'Valor', 'Valor 2']];
  for (const s of c.secciones ?? []) {
    if (s.id === 'menciones' || s.id === 'notas') continue;
    for (const k of s.cifras ?? []) filas.push([s.titulo, k.etiqueta, k.detalle ?? '', k.valor, '']);
    for (const it of s.items ?? []) filas.push([s.titulo, it.texto, [it.detalle, it.chip].filter(Boolean).join(' · '), it.valor ?? '', it.valor2 ?? '']);
  }
  return '﻿' + filas.map((f) => f.map(csvCelda).join(',')).join('\r\n') + '\r\n';
}

/** Nombre de archivo legible: "corte-diario-2027-05-13.csv". */
export function nombreArchivo(base: string, hoy: string, ext: string): string {
  const s = base.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  return `${s || 'reporte'}-${hoy}.${ext}`;
}

/** Descarga un archivo generado en el navegador. */
export function descargar(nombre: string, contenido: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement('a');
  a.href = url; a.download = nombre; a.style.display = 'none';
  document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
