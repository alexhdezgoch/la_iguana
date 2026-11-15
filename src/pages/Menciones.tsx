// Menciones de una campaña: lista con filtros (en la URL), cola de revisión, corrección de sentimiento y descarte.
// Los totales de arriba son el corte guardado de la figura propia: no cambian al corregir una mención.
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import './Menciones.css';
import { hoyDe, useCampana, usePagina, useRol } from '../shell/Campana';
import { Carga, Vacio } from '../shell/Estados';
import { Icono } from '../shell/Iconos';
import { useAcciones } from '../shell/Acciones';
import { useNombres, useTabla } from '../lib/hooks';
import { corto, cuando, num, pct, rango } from '../lib/formato';
import type { Evento, FiguraCampana, Mencion, MencionFigura, Narrativa, NotaInterna, Persona, Sentimiento, Tema } from '../lib/tipos';
import { CHIP_IMP, CHIP_SENT, PUNTO, SENTIMIENTOS, SIN, TEXTO_IMP, VISTAS, enVista, estadoDe, lista, momento, pendiente, sentimientoDe, type Vista } from './menciones/comun';
import { Filtro, type Opcion } from './menciones/Filtro';
import { Revision, hayCambios, type Borrador } from './menciones/Revision';

type ClaveFiltro = 'canal' | 'figura' | 'tema' | 'narrativa' | 'sentimiento' | 'evento';
const FILTROS: ClaveFiltro[] = ['canal', 'figura', 'tema', 'narrativa', 'sentimiento', 'evento'];

/** Valores de la mención para un filtro. Una mención puede nombrar varias figuras. */
function valoresDe(m: Mencion, k: ClaveFiltro, figs: Map<string, string[]>): string[] {
  if (k === 'figura') { const f = figs.get(m.id) ?? (m.figura_id ? [m.figura_id] : []); return f.length ? f : [SIN]; }
  return [valorDe(m, k)];
}
function valorDe(m: Mencion, k: Exclude<ClaveFiltro, 'figura'>): string {
  switch (k) {
    case 'canal': return m.canal;
    case 'tema': return m.tema_id ?? SIN;
    case 'narrativa': return m.narrativa_id ?? SIN;
    case 'sentimiento': return sentimientoDe(m) ?? SIN;
    case 'evento': return m.evento_id ?? SIN;
  }
}

export default function Menciones() {
  usePagina('Menciones');
  const campana = useCampana();
  const cid = campana.id;
  const hoy = hoyDe(campana);
  const zona = campana.zona_horaria;
  const base = `/c/${cid}`;
  const { puedeEditar, esCliente } = useRol();
  const { abrirAgregarUrl } = useAcciones();
  const [params, setParams] = useSearchParams();
  const [borradores, setBorradores] = useState<Record<string, Borrador | undefined>>({});

  const menciones = useTabla<Mencion>('menciones', { eq: { campana_id: cid }, orden: [['publicada_en', 'desc']] });
  const mf = useTabla<MencionFigura>('mencion_figuras', { eq: { campana_id: cid } });
  const figuras = useTabla<FiguraCampana>('v_figuras_campana', { eq: { campana_id: cid }, orden: 'orden' });
  const temas = useTabla<Tema>('temas', { eq: { campana_id: cid }, orden: 'orden' });
  const narrativas = useTabla<Narrativa>('narrativas', { eq: { campana_id: cid }, orden: [['menciones', 'desc']] });
  const eventos = useTabla<Evento>('eventos', { eq: { campana_id: cid }, orden: [['fecha_inicio', 'desc']] });
  const notas = useTabla<NotaInterna>('notas_internas', { eq: { campana_id: cid, entidad: 'mencion' }, orden: [['actualizada_en', 'desc']] }, !esCliente);
  const personas = useTabla<Persona>('personas', { orden: 'nombre' });
  const { nombres: visibles } = useNombres();

  const vista: Vista = (VISTAS as string[]).includes(params.get('vista') ?? '') ? (params.get('vista') as Vista) : 'Todas';
  const elegidos = Object.fromEntries(FILTROS.map((k) => [k, lista(params.get(k))])) as Record<ClaveFiltro, string[]>;

  function fijar(cambios: Record<string, string | null>) {
    setParams((p) => {
      const n = new URLSearchParams(p);
      for (const [k, v] of Object.entries(cambios)) { if (v) n.set(k, v); else n.delete(k); }
      return n;
    }, { replace: true });
  }

  const nombres = useMemo(() => new Map(figuras.datos.map((f) => [f.figura_id, f.nombre])), [figuras.datos]);
  const temaN = useMemo(() => new Map(temas.datos.map((t) => [t.id, t.nombre])), [temas.datos]);
  const narrN = useMemo(() => new Map(narrativas.datos.map((n) => [n.id, n.nombre])), [narrativas.datos]);
  const evN = useMemo(() => new Map(eventos.datos.map((e) => [e.id, e.nombre])), [eventos.datos]);
  const porPersona = useMemo(() => new Map(personas.datos.map((p) => [p.id, p])), [personas.datos]);
  const notaDe = useMemo(() => {
    const m = new Map<string, NotaInterna>();
    notas.datos.forEach((n) => { if (!m.has(n.entidad_id)) m.set(n.entidad_id, n); });
    return m;
  }, [notas.datos]);

  const figsDe = useMemo(() => {
    const m = new Map<string, string[]>();
    mf.datos.forEach((f) => m.set(f.mencion_id, [...(m.get(f.mencion_id) ?? []), f.figura_id]));
    return m;
  }, [mf.datos]);
  const todas = useMemo(
    // Las que esperan proceso (sin fecha de publicación) van primero; luego las más recientes.
    () => [...menciones.datos].sort((a, b) => (a.publicada_en ? 1 : 0) - (b.publicada_en ? 1 : 0) || (Date.parse(momento(b)) || 0) - (Date.parse(momento(a)) || 0)),
    [menciones.datos],
  );
  const filtradas = todas.filter((m) => FILTROS.every((k) => !elegidos[k].length || valoresDe(m, k, figsDe).some((v) => elegidos[k].includes(v))));
  const items = filtradas.filter((m) => enVista(m, vista));
  const enEstaVista = todas.filter((m) => enVista(m, vista));
  const cuentaVista = (v: Vista) => filtradas.filter((m) => enVista(m, v)).length;
  const pendientes = todas.filter(pendiente).length;

  const selId = params.get('m');
  const sel = items.find((m) => m.id === selId) ?? items[0] ?? null;

  // Opciones de cada filtro, con conteos derivados de las menciones de la vista actual.
  const cuenta = (k: ClaveFiltro, v: string) => enEstaVista.filter((m) => valoresDe(m, k, figsDe).includes(v)).length;
  const conSin = (k: ClaveFiltro, ops: Opcion[], texto: string) => {
    const n = cuenta(k, SIN);
    return n ? [...ops, { valor: SIN, texto, cuenta: n }] : ops;
  };
  const canales = [...new Set(todas.map((m) => m.canal))]
    .map((c) => ({ valor: c, texto: c, cuenta: cuenta('canal', c) }))
    .sort((a, b) => b.cuenta - a.cuenta);
  const opciones: Record<ClaveFiltro, Opcion[]> = {
    canal: canales,
    figura: conSin('figura', figuras.datos.map((f) => ({ valor: f.figura_id, texto: f.nombre, cuenta: cuenta('figura', f.figura_id) })), 'Sin figura'),
    tema: conSin('tema', temas.datos.map((t) => ({ valor: t.id, texto: t.nombre, cuenta: cuenta('tema', t.id) })), 'Sin tema'),
    narrativa: conSin('narrativa', narrativas.datos.map((n) => ({ valor: n.id, texto: n.nombre, cuenta: cuenta('narrativa', n.id) })), 'Sin narrativa'),
    sentimiento: conSin('sentimiento', SENTIMIENTOS.map((s) => ({ valor: s, texto: s, cuenta: cuenta('sentimiento', s) })), 'Sin clasificar'),
    evento: conSin('evento', eventos.datos.map((e) => ({ valor: e.id, texto: e.nombre, cuenta: cuenta('evento', e.id) })), 'Sin evento'),
  };
  const ETIQUETA: Record<ClaveFiltro, [string, string]> = {
    canal: ['Canal', 'Todos'], figura: ['Figura', 'Todas'], tema: ['Tema', 'Todos'], narrativa: ['Narrativa', 'Todas'], sentimiento: ['Sentimiento', 'Todos'], evento: ['Evento', 'Todos'],
  };
  const hayFiltros = FILTROS.some((k) => elegidos[k].length);

  const propia = figuras.datos.find((f) => f.figura_id === campana.figura_propia_id) ?? null;
  const parte = (p: number | null) => (propia && p != null ? num((propia.menciones * p) / 100) : 'Sin datos');

  return (
    <Carga estados={[menciones, mf, figuras, temas, narrativas, eventos]}>
      <main className="page pg-menciones">
        <div className="ph">
          <div>
            <h1>Menciones</h1>
            <p className="mu">{[propia?.nombre, campana.periodo_inicio ? rango(campana.periodo_inicio, campana.periodo_fin) : null, 'más recientes primero'].filter(Boolean).join(' · ')}</p>
          </div>
          {puedeEditar ? (
            <button type="button" className="btn bg" onClick={abrirAgregarUrl}><Icono n="mas" g={2} />Agregar URL</button>
          ) : null}
        </div>

        {!todas.length ? (
          <Vacio titulo="Todavía no hay menciones en esta campaña"
            accion={puedeEditar ? <button type="button" className="btn bg" onClick={abrirAgregarUrl}><Icono n="mas" g={2} />Agregar URL</button> : null}>
            Las menciones llegan cuando la ingesta procesa las fuentes de la campaña.{puedeEditar ? ' Mientras tanto puedes sumar una nota o publicación a mano.' : ''}
          </Vacio>
        ) : (
          <>
            <section className="kpis" aria-label="Totales">
              {propia ? (
                <>
                  <div className="kpi" style={{ flexBasis: 150 }}><span className="kl">Total</span><span className="kv s">{num(propia.menciones)}</span><span className="mu" title={`Menciones de ${propia.nombre}`}>Menciones de {corto(propia)}</span></div>
                  <div className="kpi" style={{ flexBasis: 150 }}><span className="kl">Favorables</span><span className="kv s tf">{parte(propia.favorable)}</span><span className="mu">{pct(propia.favorable, 0)}</span></div>
                  <div className="kpi" style={{ flexBasis: 150 }}><span className="kl">Neutrales</span><span className="kv s">{parte(propia.neutral)}</span><span className="mu">{pct(propia.neutral, 0)}</span></div>
                  <div className="kpi" style={{ flexBasis: 150 }}><span className="kl">Desfavorables</span><span className="kv s tu">{parte(propia.desfavorable)}</span><span className="mu">{pct(propia.desfavorable, 0)}</span></div>
                </>
              ) : null}
              <div className="kpi" style={{ flexBasis: 150 }}><span className="kl">Pendientes</span><span className="kv s">{num(pendientes)}</span><span className="mu">Marcadas para revisión</span></div>
            </section>

            <div className="barra">
              <div className="seg" role="group" aria-label="Filtrar por estado">
                {VISTAS.filter((v) => v !== 'Descartadas' || vista === 'Descartadas' || cuentaVista(v) > 0).map((v) => (
                  <button key={v} type="button" className="pill" aria-pressed={vista === v} onClick={() => fijar({ vista: v === 'Todas' ? null : v, m: null })}>{v} · {cuentaVista(v)}</button>
                ))}
              </div>
              <div className="filtros">
                {FILTROS.map((k) => (
                  <Filtro key={k} nombre={ETIQUETA[k][0]} todos={ETIQUETA[k][1]} opciones={opciones[k]} elegidos={elegidos[k]}
                    ancho={k === 'evento' ? 340 : 280} cambiar={(v) => fijar({ [k]: v.length ? v.join(',') : null, m: null })} />
                ))}
                {hayFiltros ? <button type="button" className="enlace-btn" onClick={() => fijar(Object.fromEntries([...FILTROS.map((k) => [k, null]), ['m', null]]))}>Quitar filtros</button> : null}
              </div>
            </div>

            <div className="row">
              <section className="tw c3" aria-label="Lista de menciones">
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {items.map((m) => {
                    const s = sentimientoDe(m) as Sentimiento | null;
                    const est = estadoDe(m, hayCambios(m, borradores[m.id], notaDe.get(m.id) ?? null));
                    const detalle = [m.tema_id ? temaN.get(m.tema_id) : null, m.narrativa_id ? narrN.get(m.narrativa_id) : 'Sin narrativa'].filter(Boolean).join(' · ');
                    return (
                      <button key={m.id} type="button" className="mi" aria-pressed={sel?.id === m.id} onClick={() => {
                        fijar({ m: m.id });
                        // En pantallas angostas el panel queda debajo de la lista: lo acercamos.
                        if (window.innerWidth < 820) window.setTimeout(() => document.querySelector('.pg-menciones .rev')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                      }}>
                        <span className="mm mu">
                          {m.fuente ? <span className="b" style={{ color: '#454E48' }}>{m.fuente}</span> : null}
                          <span>{m.canal}</span>
                          <span>{m.publicada_en ? cuando(m.publicada_en, hoy, zona) : 'Sin fecha'}</span>
                          {m.origen === 'Manual' ? <span className="chip own">Manual</span> : null}
                        </span>
                        <span className="b" style={{ fontSize: 15, lineHeight: '21px' }}>{m.titulo ?? m.url ?? 'Mención sin título'}</span>
                        <span className="mm">
                          {s ? <span className={CHIP_SENT[s]}><span className={PUNTO[s]} />{s}</span> : <span className="chip watch">Sin clasificar</span>}
                          {m.importancia ? <span className={CHIP_IMP[m.importancia]}>Importancia {TEXTO_IMP[m.importancia].toLowerCase()}</span> : null}
                          {detalle ? <span className="mu">{detalle}</span> : null}
                          <span className={est.cls} style={{ marginLeft: 'auto' }}>{est.texto}</span>
                        </span>
                      </button>
                    );
                  })}
                  {!items.length ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center' }} className="mu">
                      No hay menciones en esta vista.{hayFiltros ? ' Prueba quitando algún filtro.' : ''}
                    </div>
                  ) : null}
                  <div className="mu" style={{ padding: '12px 16px', background: '#F1F3EF' }}>
                    {propia ? `${num(items.length)} de ${num(propia.menciones)} menciones.` : `${num(items.length)} ${items.length === 1 ? 'mención' : 'menciones'} en esta vista.`}{' '}
                    Las publicaciones de ciudadanos se muestran sin nombre ni usuario. No hay perfiles de personas privadas.
                  </div>
                </div>
              </section>

              {sel ? (
                <Revision
                  key={sel.id}
                  m={sel}
                  borrador={borradores[sel.id]}
                  setBorrador={(b) => setBorradores((x) => ({ ...x, [sel.id]: b }))}
                  figuras={mf.datos.filter((f) => f.mencion_id === sel.id)}
                  nombres={nombres}
                  tema={sel.tema_id ? temaN.get(sel.tema_id) ?? null : null}
                  narrativa={sel.narrativa_id ? narrN.get(sel.narrativa_id) ?? null : null}
                  evento={sel.evento_id && evN.has(sel.evento_id) ? { id: sel.evento_id, nombre: evN.get(sel.evento_id)! } : null}
                  nota={notaDe.get(sel.id) ?? null}
                  personas={porPersona}
                  visibles={visibles}
                  base={base}
                  hoy={hoy}
                  zona={zona}
                  puedeEditar={puedeEditar}
                  verNotas={!esCliente}
                />
              ) : (
                <aside className="card c2 nada" aria-label="Revisión de la mención">
                  <h2>{vista === 'Pendientes' ? 'Nada por revisar' : 'Sin mención elegida'}</h2>
                  <p className="mu">No quedan menciones en esta vista.</p>
                </aside>
              )}
            </div>
          </>
        )}
      </main>
    </Carga>
  );
}
