// Ficha de una figura en la campaña: cabecera, cifras del corte de 30 días y pestañas (en la URL, ?pestana=).
// Lee v_figuras_campana, series_diarias, narrativas, tema_figuras, temas, eventos, evento_participantes,
// mencion_figuras, menciones y notas_internas. Escribe campana_figuras.relacion y notas_internas.
// Funciona con cualquier figura de la campaña: lo que no tiene datos muestra un estado vacío.
import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { hoyDe, useCampana, usePagina, useRol } from '../shell/Campana';
import { Carga, Vacio } from '../shell/Estados';
import { Icono } from '../shell/Iconos';
import { useAcciones } from '../shell/Acciones';
import { useNombres, useTabla } from '../lib/hooks';
import { db } from '../lib/db';
import { REL, compacto, corto, fecha, iniciales, neto, num, pct } from '../lib/formato';
import type { CampanaFigura, Evento, EventoParticipante, FiguraCampana, Mencion, MencionFigura, Narrativa, Relacion, SerieDiaria, Tema, TemaFigura } from '../lib/tipos';
import { cargoDe, narrativasDe, responsableDe, type EventoFigura } from './figura/comun';
import { Comparacion } from './figura/Comparacion';
import { Notas } from './figura/Notas';
import { Audiencia, Cobertura, Conversacion, ListaEventos, ListaNarrativas, Publicaciones, Sentimiento, TemasNarrativas } from './figura/Pestanas';
import './Figura.css';

const PESTANAS = [
  { id: 'resumen', texto: 'Resumen' },
  { id: 'conversacion', texto: 'Conversación' },
  { id: 'temas', texto: 'Temas y narrativas' },
  { id: 'publicaciones', texto: 'Publicaciones' },
  { id: 'audiencia', texto: 'Audiencia' },
  { id: 'eventos', texto: 'Eventos' },
  { id: 'comparar', texto: 'Comparar' },
] as const;
type Pestana = typeof PESTANAS[number]['id'];

/** Relaciones que se pueden asignar desde la ficha. "Propia" la fija la campaña (campanas.figura_propia_id). */
/** Clase de la cifra grande: sin dato se ve atenuada. */
const kvs = (v: number | null | undefined) => (v == null ? 'kv s fg-sd' : 'kv s');

const RELACIONES_EDITABLES: Relacion[] = ['Aliada', 'Rival', 'A observar'];

export default function Figura() {
  const { figuraId = '' } = useParams();
  const campana = useCampana();
  const cid = campana.id;
  const hoy = hoyDe(campana);
  const base = `/c/${cid}`;
  const { puedeEditar, esCliente, rol } = useRol();
  const { aviso, abrirDescarga } = useAcciones();
  const [params, setParams] = useSearchParams();
  const pedida = params.get('pestana');
  const pestana: Pestana = (PESTANAS.find((p) => p.id === pedida)?.id ?? 'resumen');
  const elegir = (p: Pestana) => setParams((prev) => { const n = new URLSearchParams(prev); if (p === 'resumen') n.delete('pestana'); else n.set('pestana', p); return n; }, { replace: true });

  const figuras = useTabla<FiguraCampana>('v_figuras_campana', { eq: { campana_id: cid }, orden: [['participacion', 'desc'], ['orden', 'asc']] });
  const serie = useTabla<SerieDiaria>('series_diarias', { eq: { campana_id: cid, entidad: 'figura', entidad_id: figuraId }, orden: 'fecha' });
  const narr = useTabla<Narrativa>('narrativas', { eq: { campana_id: cid }, orden: 'orden' });
  const temaFig = useTabla<TemaFigura>('tema_figuras', { eq: { campana_id: cid, figura_id: figuraId } });
  const temas = useTabla<Tema>('temas', { eq: { campana_id: cid }, orden: 'orden' });
  const eventos = useTabla<Evento>('eventos', { eq: { campana_id: cid }, orden: [['fecha_inicio', 'desc']] });
  const partic = useTabla<EventoParticipante>('evento_participantes', { eq: { campana_id: cid, figura_id: figuraId } });
  const enlaces = useTabla<MencionFigura>('mencion_figuras', { eq: { campana_id: cid, figura_id: figuraId } });
  const idsMencion = enlaces.datos.map((e) => e.mencion_id);
  const menciones = useTabla<Mencion>('menciones', { eq: { campana_id: cid, id: idsMencion }, neq: { estado: 'Descartada' }, orden: [['publicada_en', 'desc']], limite: 50 }, idsMencion.length > 0);

  const f = figuras.datos.find((x) => x.figura_id === figuraId) ?? null;
  const { nombres } = useNombres();
  usePagina(f ? f.nombre : figuras.cargando ? 'Figura' : 'Figura no encontrada', [{ texto: 'Figuras', a: `${base}/figuras` }]);

  const total = figuras.datos.reduce((n, x) => n + (x.menciones ?? 0), 0);
  const narrativas = useMemo(() => narrativasDe(narr.datos, figuraId), [narr.datos, figuraId]);

  // Eventos ya ocurridos o en marcha. Participante: neto del participante. Figura propia: además los eventos de origen Propio, con el neto del evento.
  const eventosFigura = useMemo<EventoFigura[]>(() => {
    const esPropia = campana.figura_propia_id === figuraId;
    return eventos.datos
      .filter((e) => e.estado !== 'Borrador' && e.estado !== 'Cancelado' && e.fecha_inicio != null && e.fecha_inicio <= hoy)
      .flatMap((e): EventoFigura[] => {
        const p = partic.datos.find((x) => x.evento_id === e.id);
        if (p) return [{ evento: e, neto: p.neto, rol: p.rol }];
        if (esPropia && e.origen === 'Propio') return [{ evento: e, neto: e.neto, rol: null }];
        return [];
      });
  }, [eventos.datos, partic.datos, campana.figura_propia_id, figuraId, hoy]);

  // Comparación: las candidaturas de la campaña (extra_campana.candidatura) más esta figura; si no hay, las de mayor participación.
  const comparacion = useMemo(() => {
    if (!f) return { titulo: '', filas: [] as FiguraCampana[] };
    const cand = figuras.datos.filter((x) => x.extra_campana?.candidatura === true || x.figura_id === f.figura_id);
    if (cand.length >= 2 && f.extra_campana?.candidatura === true) return { titulo: 'Frente a las otras figuras', filas: cand };
    if (cand.length >= 2) return { titulo: 'Frente a las figuras principales', filas: cand };
    const top = figuras.datos.slice(0, 4);
    return { titulo: 'Frente a las otras figuras', filas: top.some((x) => x.figura_id === f.figura_id) ? top : [...top.slice(0, 3), f] };
  }, [figuras.datos, f]);

  const [guardandoRel, setGuardandoRel] = useState(false);
  async function cambiarRelacion(r: Relacion) {
    if (!f || r === f.relacion) return;
    setGuardandoRel(true);
    try {
      await db.cambiar<CampanaFigura>('campana_figuras', f.id, { relacion: r });
      aviso(`${f.nombre} ahora es ${r === 'A observar' ? 'figura a observar' : r.toLowerCase()} en esta campaña`);
    } catch (e) {
      aviso(e instanceof Error ? e.message : String(e));
    } finally { setGuardandoRel(false); }
  }

  if (!figuras.cargando && !figuras.error && !f) {
    return (
      <main className="page pg-figura">
        <Vacio titulo="Esta figura no está en la campaña">
          Puede que el enlace esté mal o que la figura se haya quitado de {campana.titulo_largo ?? campana.nombre}. <Link to={`${base}/figuras`}>Ver las figuras de la campaña</Link>
        </Vacio>
      </main>
    );
  }

  const rel = f ? REL[f.relacion] ?? REL['A observar'] : REL['A observar'];
  const cargo = f ? cargoDe(f) : null;
  const subtitulo = f ? [cargo, typeof f.extra?.subtitulo === 'string' ? f.extra.subtitulo : null].filter(Boolean).join(' · ') : '';
  const meta = f ? [f.partido, f.coalicion, f.territorio, f.seguidores != null ? `${compacto(f.seguidores)} seguidores · medido el ${fecha(hoy, 'largo')}` : null].filter(Boolean).join(' · ') : '';
  const responsable = f ? responsableDe(f, nombres) : null;
  const sinCorte = f ? f.periodo == null : false;

  return (
    <Carga estados={[figuras, serie, narr, temaFig, temas, eventos, partic, enlaces, menciones]}>
      {f ? (
        <main className="page pg-figura">
          <section className="card fg-cab">
            <span aria-hidden="true" className="fg-av" style={{ background: rel.color }}>{f.iniciales || iniciales(f.nombre)}</span>
            <div className="fg-id">
              <div className="fg-nom"><h1>{f.nombre}</h1><span className={`chip ${rel.cls}`}>{f.relacion}</span></div>
              {subtitulo ? <p style={{ color: '#454E48' }}>{subtitulo}</p> : null}
              {meta ? <p className="mu">{meta}</p> : null}
              {responsable ? <p className="mu">Responsable en la campaña: {responsable}</p> : null}
            </div>
            <div className="fg-acc">
              {puedeEditar && f.relacion !== 'Propia' ? (
                <label className="fg-rel">
                  <span className="mu">Relación</span>
                  <select className="entrada" value={f.relacion} disabled={guardandoRel} onChange={(e) => cambiarRelacion(e.target.value as Relacion)} aria-label="Relación con la campaña">
                    {RELACIONES_EDITABLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
              ) : null}
              <button type="button" className="btn bg" onClick={() => abrirDescarga()}><Icono d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />Descargar reporte</button>
            </div>
          </section>

          {sinCorte ? (
            <p className="mu well">Esta figura todavía no tiene corte de 30 días. Las cifras aparecen cuando la ingesta procese sus menciones.</p>
          ) : null}

          <section className="kpis" aria-label="Métricas">
            <div className="kpi fg-kpi"><span className="kl">Participación</span><span className={kvs(f.participacion)}>{pct(f.participacion)}</span><span className="mu">{num(f.menciones)} de {num(total)} menciones</span></div>
            <div className="kpi fg-kpi"><span className="kl">Sentimiento neto</span><span className={kvs(f.neto) + (f.neto == null ? '' : f.neto >= 0 ? ' tf' : ' tu')}>{neto(f.neto)}</span><span className="mu">{f.favorable != null && f.desfavorable != null ? `${f.favorable}% favorable, ${f.desfavorable}% desfavorable` : 'Sin desglose todavía'}</span></div>
            <div className="kpi fg-kpi"><span className="kl">Alcance</span><span className={kvs(f.alcance)}>{compacto(f.alcance)}</span><span className="mu">Cuentas únicas estimadas</span></div>
            <div className="kpi fg-kpi"><span className="kl">Tasa de interacción</span><span className={kvs(f.interaccion)}>{pct(f.interaccion)}</span><span className="mu">En publicaciones propias</span></div>
            <div className="kpi fg-kpi"><span className="kl">Cobertura en medios</span><span className={kvs(f.notas_medios)}>{num(f.notas_medios)}</span><span className="mu">Notas en prensa, radio y TV</span></div>
            <div className="kpi fg-kpi"><span className="kl">Índice de riesgo</span><span className={kvs(f.riesgo)}>{f.riesgo ?? 'Sin datos'}</span><span className="mu">{f.riesgo_nivel ? `${f.riesgo_nivel}, de 0 a 100` : 'Escala de 0 a 100'}</span></div>
          </section>

          <div className="tabs" role="tablist" aria-label="Secciones del perfil">
            {PESTANAS.map((p) => (
              <button key={p.id} type="button" className="tab" role="tab" id={`fg-tab-${p.id}`} aria-selected={pestana === p.id} aria-controls="fg-panel" onClick={() => elegir(p.id)}>{p.texto}</button>
            ))}
          </div>

          <div id="fg-panel" role="tabpanel" aria-labelledby={`fg-tab-${pestana}`} className="col" style={{ gap: 20 }}>
            {pestana === 'resumen' ? (
              <div className="col fade" style={{ gap: 20 }}>
                <div className="row">
                  <Sentimiento f={f} />
                  <ListaNarrativas narrativas={narrativas} max={4} verTodas={() => elegir('temas')} />
                </div>
                {comparacion.filas.length > 1 ? <Comparacion titulo={comparacion.titulo} filas={comparacion.filas} actual={f.figura_id} base={base} /> : null}
                <div className="row">
                  <Cobertura f={f} />
                  <ListaEventos eventos={eventosFigura} nombre={corto(f)} base={base} max={4} />
                </div>
                {rol && !esCliente ? <Notas campanaId={cid} figuraId={f.figura_id} hoy={hoy} zona={campana.zona_horaria} puedeEditar={puedeEditar} /> : null}
              </div>
            ) : null}
            {pestana === 'conversacion' ? <Conversacion f={f} serie={serie.datos} /> : null}
            {pestana === 'temas' ? <TemasNarrativas temaFiguras={temaFig.datos} temas={temas.datos} narrativas={narrativas} base={base} /> : null}
            {pestana === 'publicaciones' ? <Publicaciones menciones={menciones.datos} enlaces={enlaces.datos} figuraId={f.figura_id} hoy={hoy} zona={campana.zona_horaria} base={base} /> : null}
            {pestana === 'audiencia' ? <Audiencia f={f} hoy={hoy} /> : null}
            {pestana === 'eventos' ? <div className="row fade"><ListaEventos eventos={eventosFigura} nombre={corto(f)} base={base} /></div> : null}
            {pestana === 'comparar' ? (
              <div className="col fade" style={{ gap: 12 }}>
                <Comparacion titulo={`Todas las figuras · ${figuras.datos.length}`} filas={figuras.datos} actual={f.figura_id} base={base} />
                <p className="mu">Mismo corte de 30 días y mismo método para todas las figuras. Ordenadas por participación.</p>
              </div>
            ) : null}
          </div>
        </main>
      ) : null}
    </Carga>
  );
}
