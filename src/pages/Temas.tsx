// Temas y narrativas. Sigue el patrón de Resumen: datos filtrados por campaña, <Carga>, estados vacíos.
// Filtros, tema elegido y narrativa abierta viven en la URL (?p, fig, can, ev, tema, tab, modo, narrativa).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { hoyDe, useCampana, usePagina, useRol } from '../shell/Campana';
import { Carga, Vacio } from '../shell/Estados';
import { Icono } from '../shell/Iconos';
import { useAcciones } from '../shell/Acciones';
import { useTabla } from '../lib/hooks';
import { REL, fecha, num } from '../lib/formato';
import type { Alerta, Evento, FiguraCampana, Narrativa, SerieDiaria, Tema, TemaFigura } from '../lib/tipos';
import {
  DIR, ORDEN_REL, TEND, cambioVentana, conteo, diasDelPeriodo, figuraDeNarrativa, nombresCortos, pctDeFigura,
  seriesPorEntidad, signoPct, ventanaEvento, type Canal, type Ventana,
} from './temas/calculos';
import { banda, ceros, linea, marcas, maximo, sumar } from './temas/graficos';
import { Detalle } from './temas/Detalle';
import './Temas.css';

const G4 = ['#285A32', '#6F9A77', '#B4CDB8', '#DDE4DC'];
const ESTADOS_CON_DATOS = ['En curso', 'En análisis', 'Cerrado'];
const pctTxt = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(1)}%`;

interface Opcion { valor: string; texto: string; desactivada?: boolean }

function Desplegable({ etiqueta, valor, opciones, elegir, desactivado }: { etiqueta: string; valor: string; opciones: Opcion[]; elegir: (v: string) => void; desactivado?: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla); };
  }, [abierto]);
  const actual = opciones.find((o) => o.valor === valor) ?? opciones[0];
  return (
    <div className="dd" ref={ref}>
      <button type="button" className="btn bg" style={{ fontWeight: 500 }} aria-haspopup="listbox" aria-expanded={abierto} onClick={() => setAbierto(!abierto)} disabled={desactivado}>
        <span style={{ color: '#636C66' }}>{etiqueta}</span><span className="ddv">{actual?.texto}</span>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {abierto ? (
        <div className="swm ddm" role="listbox" aria-label={etiqueta}>
          {opciones.map((o) => (
            <button type="button" key={o.valor} className={o.valor === valor ? 'swi cur' : 'swi'} role="option" aria-selected={o.valor === valor} disabled={o.desactivada}
              onClick={() => { elegir(o.valor); setAbierto(false); }}>
              <span className="sm" style={{ flex: 1 }}>{o.texto}</span>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function Temas() {
  usePagina('Temas y narrativas');
  const { abrirDescarga } = useAcciones();
  const campana = useCampana();
  const cid = campana.id;
  const hoy = hoyDe(campana);
  const base = `/c/${cid}`;
  const { puedeEditar, esCliente } = useRol();
  const [sp, setSp] = useSearchParams();

  const temasQ = useTabla<Tema>('temas', { eq: { campana_id: cid }, orden: 'orden' });
  const narrQ = useTabla<Narrativa>('narrativas', { eq: { campana_id: cid }, orden: 'orden' });
  const figQ = useTabla<FiguraCampana>('v_figuras_campana', { eq: { campana_id: cid }, orden: 'orden' });
  const tfQ = useTabla<TemaFigura>('tema_figuras', { eq: { campana_id: cid } });
  const serTQ = useTabla<SerieDiaria>('series_diarias', { eq: { campana_id: cid, entidad: 'tema' }, orden: 'fecha', limite: 10000 });
  const serNQ = useTabla<SerieDiaria>('series_diarias', { eq: { campana_id: cid, entidad: 'narrativa' }, orden: 'fecha', limite: 10000 });
  const evQ = useTabla<Evento>('eventos', { eq: { campana_id: cid, estado: ESTADOS_CON_DATOS }, orden: 'fecha_inicio' });
  const alQ = useTabla<Alerta>('alertas', { eq: { campana_id: cid }, orden: 'orden' });

  // ---------- estado en la URL ----------
  const st = {
    p: sp.get('p') ?? '30', fig: sp.get('fig') ?? 'all', can: sp.get('can') ?? 'all', ev: sp.get('ev') ?? '',
    tema: sp.get('tema') ?? '', tab: sp.get('tab') ?? 'all', modo: sp.get('modo') ?? 't', n: sp.get('narrativa') ?? '',
  };
  const DEF: Record<string, string> = { p: '30', fig: 'all', can: 'all', ev: '', tema: '', tab: 'all', modo: 't', narrativa: '' };
  const fijar = (cambios: Record<string, string>) => {
    const s = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(cambios)) { if (v === DEF[k] || v === '') s.delete(k); else s.set(k, v); }
    setSp(s, { replace: true });
  };

  const d = useMemo(() => {
    const dias = diasDelPeriodo(campana.periodo_inicio, campana.periodo_fin ?? hoy);
    const serT = seriesPorEntidad(serTQ.datos, dias);
    const serN = seriesPorEntidad(serNQ.datos, dias);
    const figs = new Map(figQ.datos.map((f) => [f.figura_id, f]));
    const cortos = nombresCortos(figQ.datos);
    const temas = new Map(temasQ.datos.map((t) => [t.id, t]));
    const narrativas = new Map(narrQ.datos.map((n) => [n.id, n]));
    const eventos = evQ.datos.filter((e) => e.fecha_inicio && e.fecha_inicio >= dias[0] && e.fecha_inicio <= dias[dias.length - 1]);
    return { dias, serT, serN, figs, cortos, temas, narrativas, eventos };
  }, [campana.periodo_inicio, campana.periodo_fin, hoy, serTQ.datos, serNQ.datos, figQ.datos, temasQ.datos, narrQ.datos, evQ.datos]);

  const { dias, serT, serN, figs, cortos } = d;
  const ultimo = dias.length - 1;
  const haySeries = serT.size > 0 || serN.size > 0;
  const propiaId = campana.figura_propia_id;
  const propia = propiaId ? figs.get(propiaId) : undefined;
  const propiaCorto = propia ? cortos.get(propia.figura_id) ?? propia.nombre : null;

  // ---------- ventana ----------
  const evento = st.ev ? d.eventos.find((e) => e.id === st.ev) : undefined;
  const ve = evento && haySeries ? ventanaEvento(evento, dias) : null;
  let v: Ventana;
  if (ve) v = { ...ve, completa: ve.desde === 0 && ve.hasta === ultimo, texto: `ventana de ${evento!.nombre}` };
  else if (st.p === '24' && haySeries) v = { desde: ultimo, hasta: ultimo, completa: false, texto: 'últimas 24 horas' };
  else if (st.p === '7' && haySeries) v = { desde: Math.max(ultimo - 6, 0), hasta: ultimo, completa: false, texto: 'últimos 7 días' };
  else v = { desde: 0, hasta: ultimo, completa: true, texto: `últimos ${dias.length} días` };
  const porEvento = !!ve;

  // canales disponibles (de los repartos guardados)
  const nombresCanal = [...new Set([...temasQ.datos, ...narrQ.datos].flatMap((x) => ((x.detalle?.canales ?? []) as Canal[]).map((c) => c.canal)))];
  const CANALES: Opcion[] = [{ valor: 'all', texto: 'Todos' }];
  if (nombresCanal.length > 1 && nombresCanal.includes('Medios')) CANALES.push({ valor: 'redes', texto: 'Redes sociales' });
  nombresCanal.forEach((c) => CANALES.push({ valor: c, texto: c }));
  const canal = CANALES.some((c) => c.valor === st.can) ? st.can : 'all';
  const canalTxt = CANALES.find((c) => c.valor === canal)!.texto;

  // ---------- temas ----------
  const filasTema = temasQ.datos.map((t) => {
    const serie = serT.get(t.id);
    const c = conteo(t.menciones, serie, v, canal, t.detalle);
    return { t, serie, c };
  });
  const grand = filasTema.reduce((s, x) => s + (x.c ?? 0), 0);
  const tfPorTema = new Map<string, TemaFigura[]>();
  tfQ.datos.forEach((x) => { if (!tfPorTema.has(x.tema_id)) tfPorTema.set(x.tema_id, []); tfPorTema.get(x.tema_id)!.push(x); });
  const temasPrincipales = temasQ.datos.filter((t) => !t.detalle?.otros);
  const otros = temasQ.datos.find((t) => t.detalle?.otros);

  // ---------- narrativas ----------
  const filasNarr = narrQ.datos.map((n) => {
    const serie = serN.get(n.id);
    return { n, serie, c: conteo(n.menciones, serie, v, canal, n.detalle), f: figuraDeNarrativa(n, figs) };
  });
  const conteos = new Map(filasNarr.map((x) => [x.n.id, x.c]));
  const cobertura = filasNarr.reduce((s, x) => s + (x.c ?? 0), 0);
  const activas = narrQ.datos.filter((n) => n.estado === 'Activa');
  const emergentes = filasNarr.filter((x) => x.n.tendencia === 'Emergente');
  const alzas = narrQ.datos.filter((n) => n.direccion === 'Desfavorable' && (n.cambio_24h ?? 0) > 0).sort((a, b) => (b.cambio_24h ?? 0) - (a.cambio_24h ?? 0));
  const alza = alzas[0];

  const relDe = (n: Narrativa) => (n.figura_id ? figs.get(n.figura_id)?.relacion : undefined);
  const figOk = (n: Narrativa) => {
    if (st.fig === 'all') return true;
    if (st.fig === 'propia') return !!propiaId && (n.figura_id === propiaId || ((n.detalle?.figura_ids ?? []) as string[]).includes(propiaId));
    return relDe(n) === (st.fig === 'rivales' ? 'Rival' : 'Aliada');
  };
  const TABS: Array<[string, string, (n: Narrativa) => boolean]> = [
    ['all', 'Todas', () => true],
    ['fav', propiaCorto ? `Favorables a ${propiaCorto}` : 'Favorables', (n) => n.direccion === 'Favorable' && (!propiaId || n.figura_id === propiaId)],
    ['unf', propiaCorto ? `Desfavorables a ${propiaCorto}` : 'Desfavorables', (n) => n.direccion === 'Desfavorable' && (!propiaId || n.figura_id === propiaId)],
    ['riv', 'Sobre rivales', (n) => relDe(n) === 'Rival'],
  ];
  const baseNarr = filasNarr.filter((x) => x.c !== 0 && (!st.tema || x.n.tema_id === st.tema) && figOk(x.n));
  const tabFn = (TABS.find((t) => t[0] === st.tab) ?? TABS[0])[2];
  const orden = (n: Narrativa) => (n.cambio_7d == null ? 1000 + (n.cambio_24h ?? 0) : n.cambio_7d);
  const listaNarr = baseNarr.filter((x) => tabFn(x.n)).sort((a, b) => orden(b.n) - orden(a.n));

  const FIGURAS: Opcion[] = [{ valor: 'all', texto: 'Todas' }];
  if (propia) FIGURAS.push({ valor: 'propia', texto: propia.nombre });
  if (figQ.datos.some((f) => f.relacion === 'Aliada')) FIGURAS.push({ valor: 'aliadas', texto: 'Aliadas' });
  if (figQ.datos.some((f) => f.relacion === 'Rival')) FIGURAS.push({ valor: 'rivales', texto: 'Rivales' });
  const figTxt = (FIGURAS.find((f) => f.valor === st.fig) ?? FIGURAS[0]).texto;
  const EVENTOS: Opcion[] = [{ valor: '', texto: 'Ninguno' }, ...d.eventos.map((e) => ({ valor: e.id, texto: `${e.nombre} · ${fecha(e.fecha_inicio, 'corto')}` }))];

  // ---------- gráfica de evolución ----------
  const conSerie = temasPrincipales.filter((t) => serT.has(t.id)).sort((a, b) => b.menciones - a.menciones);
  const top3 = conSerie.slice(0, 3);
  const restoIds = temasQ.datos.filter((t) => serT.has(t.id) && !top3.includes(t)).map((t) => t.id);
  const capas: Array<{ nombre: string; serie: number[] }> = top3.map((t) => ({ nombre: t.nombre, serie: serT.get(t.id)! }));
  if (restoIds.length) capas.push({ nombre: 'Otros temas', serie: restoIds.reduce((acc, id) => sumar(acc, serT.get(id)!), ceros(dias.length)) });
  let acumulado = ceros(dias.length);
  const pilas = capas.map((c) => { const lo = acumulado; acumulado = sumar(acumulado, c.serie); return { lo, hi: acumulado, nombre: c.nombre }; });
  const emx = maximo(acumulado);
  const itemsMarca = (texto: (e: Evento) => string) => d.eventos.map((e) => ({ i: Math.max(0, Math.min(ultimo, dias.indexOf(e.fecha_inicio!.slice(0, 10)))), texto: texto(e), peso: e.menciones ?? 0 }));
  const marcasTemas = marcas(itemsMarca((e) => fecha(e.fecha_inicio, 'corto')), dias.length, 300, 60);
  const marcasNarr = marcas(itemsMarca((e) => `${e.tipo} · ${fecha(e.fecha_inicio, 'corto')}`), dias.length, 480, 170);
  const notaTemas = (campana.extra?.nota_temas as string | undefined) ?? null;

  // ---------- mapa de calor ----------
  const propias = st.modo === 'p';
  const figsMapa = [...figQ.datos].sort((a, b) => (ORDEN_REL[a.relacion] ?? 9) - (ORDEN_REL[b.relacion] ?? 9) || a.orden - b.orden);
  const valorCelda = (x: TemaFigura | undefined) => (x ? (propias ? x.porcentaje_propias : x.porcentaje) : null);
  const temasMapa = temasPrincipales.filter((t) => tfPorTema.has(t.id));
  const maxMapa = Math.max(1, ...temasMapa.flatMap((t) => (tfPorTema.get(t.id) ?? []).map((x) => valorCelda(x) ?? 0)));
  const marcada = (t: Tema, x: TemaFigura | undefined) => {
    if (!x || !t.es_propio || figs.get(x.figura_id)?.relacion !== 'Rival') return false;
    const ahora = propias ? x.porcentaje_propias : x.porcentaje, antes = propias ? x.porcentaje_propias_hace_7d : x.porcentaje_hace_7d;
    return ahora != null && antes != null && ahora > antes;
  };
  let bandera: { t: Tema; x: TemaFigura; f: FiguraCampana } | null = null;
  for (const t of temasMapa) for (const x of tfPorTema.get(t.id) ?? []) if (!bandera && marcada(t, x) && figs.get(x.figura_id)) bandera = { t, x, f: figs.get(x.figura_id)! };
  const alertaBandera = bandera ? alQ.datos.find((a) => a.tema_id === bandera!.t.id && (a.figura_id === bandera!.f.figura_id || (a.figura_id == null && a.tipo === 'Rival en tema propio'))) : undefined;

  // ---------- detalle ----------
  const sel = st.n ? d.narrativas.get(st.n) : undefined;
  const abrir = (id: string) => fijar({ narrativa: id });
  const cerrar = () => fijar({ narrativa: '' });

  const sucio = st.p !== '30' || st.fig !== 'all' || canal !== 'all' || !!st.ev;
  const cargas = [temasQ, narrQ, figQ, tfQ, serTQ, serNQ, evQ, alQ];
  const subtitulo = `${num(grand)} menciones${figQ.datos.length ? ` entre las ${figQ.datos.length} figuras` : ''} · ${v.texto}${canal === 'all' ? '' : ` · ${canalTxt}`}`;
  const chLabel = v.completa ? `Cambio vs. ${dias.length} días previos` : 'Cambio vs. periodo previo';

  if (!temasQ.cargando && !narrQ.cargando && !temasQ.datos.length && !narrQ.datos.length && !temasQ.error && !narrQ.error) {
    return (
      <main className="page pg-temas">
        <div className="ph"><div><h1>Temas y narrativas</h1><p className="mu">Sin menciones clasificadas todavía.</p></div></div>
        <Vacio titulo="Todavía no hay temas ni narrativas"
          accion={figQ.datos.length ? <Link className="btn bg" to={`${base}/menciones`}>Ver menciones</Link> : puedeEditar ? <Link className="btn bg" to={`${base}/figuras/nueva`}><Icono n="mas" g={2} />Agregar figura</Link> : null}>
          Los temas y narrativas aparecen cuando hay menciones clasificadas de las figuras en seguimiento.
        </Vacio>
      </main>
    );
  }

  return (
    <Carga estados={cargas}>
      <main className="page pg-temas">
        <div className="ph">
          <div>
            <h1>Temas y narrativas</h1>
            <p className="mu">{subtitulo}</p>
          </div>
          <div className="acts"><button type="button" className="btn bg" onClick={() => abrirDescarga('Semanal')}>Descargar reporte</button></div>
        </div>

        <div className="fbar" role="group" aria-label="Filtros de temas y narrativas">
          <div className="seg" role="group" aria-label="Periodo">
            {([['24', '24 h'], ['7', '7 días'], ['30', `${dias.length} días`]] as const).map(([k, l]) => (
              <button type="button" className="pill" key={k} aria-pressed={!porEvento && (st.p === k || (!haySeries && k === '30'))}
                disabled={!haySeries && k !== '30'} title={!haySeries && k !== '30' ? 'Sin serie diaria para esta campaña' : undefined}
                onClick={() => fijar({ p: k, ev: '' })}>{l}</button>
            ))}
          </div>
          {FIGURAS.length > 1 ? <Desplegable etiqueta="Figura" valor={st.fig} opciones={FIGURAS} elegir={(x) => fijar({ fig: x })} /> : null}
          {CANALES.length > 1 ? <Desplegable etiqueta="Canal" valor={canal} opciones={CANALES} elegir={(x) => fijar({ can: x })} /> : null}
          {d.eventos.length && haySeries ? <Desplegable etiqueta="Evento" valor={evento ? st.ev : ''} opciones={EVENTOS} elegir={(x) => fijar({ ev: x })} /> : null}
          {sucio ? <button type="button" className="nb lk" style={{ color: '#285A32' }} onClick={() => fijar({ p: '30', fig: 'all', can: 'all', ev: '' })}>Limpiar filtros</button> : null}
        </div>

        <section className="kpis" aria-label="Cifras de temas y narrativas">
          <div className="kpi">
            <span className="kl">Temas activos</span>
            <span className="kv">{temasPrincipales.length}</span>
            <span className="mu">{otros?.porcentaje != null ? `Más "Otros", con ${pctTxt(Math.round(otros.porcentaje))} de las menciones` : `${num(grand)} menciones en temas`}</span>
          </div>
          <div className="kpi" aria-label="Conteo de narrativas">
            <span className="kl">Narrativas activas</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span className="kv">{activas.length}</span>
              {emergentes.length ? <span className="chip warn">{emergentes.length} {emergentes.length === 1 ? 'emergente' : 'emergentes'}</span> : null}
            </div>
            <span className="mu">{[
              propia ? `${activas.filter((n) => n.figura_id === propiaId).length} sobre ${propiaCorto}` : null,
              `${activas.filter((n) => n.figura_id && n.figura_id !== propiaId).length} sobre ${propia ? 'otras figuras' : 'figuras'}`,
              `${activas.filter((n) => !n.figura_id).length} sin figura única`,
            ].filter(Boolean).join(' · ')}</span>
          </div>
          <div className="kpi">
            <span className="kl">Cobertura de narrativas</span>
            <span className="kv">{num(cobertura)}</span>
            <span className="mu">menciones con narrativa · {grand ? `${Math.round((cobertura / grand) * 100)}%` : 'Sin datos'} de {num(grand)}</span>
          </div>
          {alza ? (
            <button type="button" className="kpi kb" onClick={() => abrir(alza.id)}>
              <span className="kl">Mayor alza desfavorable</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}><span className="kv tu">{signoPct(alza.cambio_24h)}</span><span className="mu">en 24 h</span></div>
              <span className="sm"><span className="b">{alza.nombre}</span> · <span style={{ color: '#285A32', fontWeight: 600 }}>ver detalle</span></span>
            </button>
          ) : (
            <div className="kpi">
              <span className="kl">Mayor alza desfavorable</span>
              <span className="kv">—</span>
              <span className="mu">Ninguna narrativa desfavorable creció en 24 h</span>
            </div>
          )}
        </section>

        {emergentes.length ? (
          <section className="col" style={{ gap: 10 }} aria-label="Narrativas emergentes">
            <div className="ch"><h2>Narrativas emergentes</h2><span className="mu">Menos de 10 días y más del doble de su promedio de 7 días</span></div>
            <div className="row" style={{ alignItems: 'stretch' }}>
              {emergentes.map(({ n, serie, f }) => {
                const dir = DIR[n.direccion] ?? DIR['Sin dirección'];
                const a = serie ? serie.slice(-14) : [];
                const mx = maximo(a) * 1.05;
                const tema = n.tema_id ? d.temas.get(n.tema_id)?.nombre : null;
                return (
                  <button type="button" className="card c1 kb" style={{ gap: 10 }} aria-label={`Narrativa emergente: ${n.nombre}`} key={n.id} onClick={() => abrir(n.id)}>
                    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <span className={dir.cls}>{dir.texto}</span>
                      {n.veces_promedio != null ? <span className="chip warn">{n.veces_promedio.toFixed(1)}× su promedio</span> : null}
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span className="b" style={{ fontSize: 16, lineHeight: '22px' }}>{n.nombre}</span>
                      <span className="mu">{[tema, f.corto].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
                      <span style={{ display: 'flex', flexDirection: 'column' }}><span className="kv s">{num(n.menciones_24h)}</span><span className="mu">menciones en 24 h</span></span>
                      {a.length > 1 ? (
                        <span className="cv" style={{ width: 120, height: 36 }} role="img" aria-label={`Menciones por día, últimos ${a.length} días`}>
                          <i style={{ clipPath: banda(ceros(a.length), a, 120, 30, 3, mx, 36), background: '#E7F0E8' }} />
                          <i style={{ clipPath: linea(a, 120, 30, 3, mx, 36, 2), background: '#285A32' }} />
                        </span>
                      ) : null}
                    </span>
                    {n.detectada_el ? <span className="mu">Detectada el {fecha(n.detectada_el, 'corto')}</span> : null}
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        <div className="row">
          <section className="tw" style={{ flex: '3 1 620px', minWidth: 0 }} aria-label="Temas de agenda">
            <header className="twh"><h2>Temas de agenda</h2><span className="mu">{narrQ.datos.some((n) => n.tema_id) ? 'Haz clic en un tema para filtrar las narrativas' : 'Menciones por tema en el periodo'}</span></header>
            {temasQ.datos.length ? (
              <div>
                <table className="tt" style={{ minWidth: 690 }}>
                  <thead><tr><th>Tema</th><th className="r">Menciones</th><th className="r">%</th><th className="r" title={chLabel}>Cambio</th><th>Tendencia</th>{propia ? <th>Balance para {propiaCorto}</th> : null}<th>Figura que lidera</th></tr></thead>
                  <tbody>
                    {filasTema.map(({ t, serie, c }) => {
                      const on = st.tema === t.id;
                      const filas = tfPorTema.get(t.id) ?? [];
                      const bal = propiaId ? filas.find((x) => x.figura_id === propiaId) : undefined;
                      const lider = t.detalle?.otros ? undefined : filas.filter((x) => x.porcentaje != null).sort((a, b) => (b.porcentaje ?? 0) - (a.porcentaje ?? 0))[0];
                      const pctV = v.completa && canal === 'all' && t.porcentaje != null ? Math.round(t.porcentaje) : c != null && grand ? Math.round((c / grand) * 100) : null;
                      const cambio = t.detalle?.otros ? null : v.completa && !porEvento ? t.cambio : cambioVentana(serie, v);
                      const ventanaCambio = v.completa ? (t.detalle?.cambio_ventana as string | undefined) : undefined;
                      const mx = serie ? maximo(serie) : 0;
                      return (
                        <tr className={on ? 'ck on' : 'ck'} key={t.id} onClick={() => fijar({ tema: on ? '' : t.id })}>
                          <td style={{ whiteSpace: 'nowrap' }}><button type="button" className="nb tl" aria-pressed={on} title={t.es_propio ? 'Tema propio de la campaña' : undefined}>{t.nombre}</button></td>
                          <td className="r b">{c == null ? 'Sin datos' : num(c)}</td>
                          <td className="r">{pctV == null ? '—' : `${pctV}%`}</td>
                          <td className="r" style={{ whiteSpace: 'nowrap' }}>{cambio == null ? (t.detalle?.otros ? '' : '—') : signoPct(cambio)}{ventanaCambio ? <span className="mu"> · {ventanaCambio}</span> : null}</td>
                          <td>{serie && mx ? <span className="cv" style={{ width: 80, height: 24 }} aria-hidden="true"><i style={{ clipPath: linea(serie, 80, 19, 3, mx, 24, 1.5), background: '#454E48' }} /></span>
                            : t.tendencia ? <span className={TEND[t.tendencia] ?? 'chip watch'}>{t.tendencia}</span> : <span className="mu">—</span>}</td>
                          {propia ? (
                            <td>{bal && bal.favorable != null ? (
                              <div className="stack" style={{ minWidth: 96, height: 8 }} title={`${bal.favorable}% favorable · ${bal.neutral ?? 0}% neutral · ${bal.desfavorable ?? 0}% desfavorable`}>
                                <i style={{ flex: bal.favorable, background: '#3A76C4' }} /><i style={{ flex: bal.neutral ?? 0, background: '#C5CBC6' }} /><i style={{ flex: bal.desfavorable ?? 0, background: '#D07A2D' }} />
                              </div>
                            ) : <span className="mu">—</span>}</td>
                          ) : null}
                          <td className="sm" style={{ whiteSpace: 'nowrap' }}>{lider ? <>{cortos.get(lider.figura_id) ?? 'Figura'} · {pctTxt(lider.porcentaje!)}</> : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p className="mu" style={{ padding: '0 16px 16px' }}>Todavía no hay temas clasificados.</p>}
            {propia && tfQ.datos.some((x) => x.favorable != null) ? (
              <div className="mu" style={{ padding: '10px 16px', background: '#F1F3EF', display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
                <span className="lg"><span className="d df" />Favorable</span><span className="lg"><span className="d" style={{ background: '#C5CBC6' }} />Neutral</span><span className="lg"><span className="d du" />Desfavorable</span>
                <span>Balance de las menciones de {propiaCorto} en cada tema · {chLabel}</span>
              </div>
            ) : null}
          </section>

          <section className="card" style={{ flex: '1 1 280px', minWidth: 0 }}>
            <div className="ch"><h2>Evolución de los temas</h2><span className="mu">Menciones por día</span></div>
            {pilas.length && emx ? (
              <>
                <div className="cv" style={{ aspectRatio: '2' }} role="img" aria-label={`Menciones por día y por tema, del ${fecha(dias[0])} al ${fecha(dias[ultimo])}`}>
                  {pilas.map((p, j) => ({ p, j })).reverse().map(({ p, j }) => <i key={p.nombre} style={{ clipPath: banda(p.lo, p.hi, 300, 112, 18, emx, 150), background: G4[j] }} />)}
                  <svg viewBox="0 0 300 150" aria-hidden="true">
                    {marcasTemas.map((m) => <path key={'l' + m.x} d={`M${m.x.toFixed(1)} 14V130`} stroke="#636C66" strokeWidth="1" strokeDasharray="2 3" />)}
                    {marcasTemas.map((m) => <text key={'t' + m.x} x={m.anclaje === 'end' ? 298 : m.x} y="10" textAnchor={m.anclaje} fontSize="12" fill="#454E48">{m.texto}</text>)}
                    <text x="0" y="146" fontSize="12" fill="#636C66">{fecha(dias[0], 'corto')}</text><text x="300" y="146" textAnchor="end" fontSize="12" fill="#636C66">{fecha(dias[ultimo], 'corto')}</text>
                  </svg>
                </div>
                <div className="mu" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
                  {pilas.map((p, j) => <span className="lg" key={p.nombre}><span className="d" style={{ background: G4[j] }} />{p.nombre}</span>)}
                </div>
              </>
            ) : <p className="mu">Sin serie diaria de temas para esta campaña.</p>}
            {notaTemas ? <p className="sm" style={{ color: '#454E48' }}>{notaTemas}</p> : null}
          </section>
        </div>

        <section className="card" aria-label="Quién lidera cada tema">
          <div className="ch" style={{ alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <h2>Quién lidera cada tema</h2>
              <span className="mu">{propias ? 'De lo que publica cada figura, qué parte dedica a cada tema. Es la agenda que empuja.' : 'De las menciones de cada tema, qué parte nombra a cada figura. Es la agenda que otros le asignan.'}</span>
            </div>
            {temasMapa.length ? (
              <div className="seg" role="group" aria-label="Qué se mide">
                <button type="button" className="pill" aria-pressed={!propias} onClick={() => fijar({ modo: 't' })}>Menciones de terceros</button>
                <button type="button" className="pill" aria-pressed={propias} onClick={() => fijar({ modo: 'p' })}>Publicaciones propias</button>
              </div>
            ) : null}
          </div>
          {temasMapa.length ? (
            <>
              <div className="hmw">
                <table className="hm" style={{ minWidth: 760 }}>
                  <thead><tr><th>Tema</th>
                    {figsMapa.map((f) => <th key={f.figura_id} title={`${f.nombre} · ${f.relacion}`}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span className="d" style={{ background: REL[f.relacion]?.color }} />{cortos.get(f.figura_id)}</span></th>)}
                  </tr></thead>
                  <tbody>
                    {temasMapa.map((t) => {
                      const filas = tfPorTema.get(t.id) ?? [];
                      return (
                        <tr key={t.id} className={st.tema === t.id ? 'on' : ''}>
                          <td className="sm b">{t.nombre}</td>
                          {figsMapa.map((f) => {
                            const x = filas.find((y) => y.figura_id === f.figura_id);
                            const val = valorCelda(x);
                            if (val == null) return <td key={f.figura_id}><span className="hc" style={{ background: '#F1F3EF', color: '#636C66' }} title={`${f.nombre} · ${t.nombre}: sin datos`}>—</span></td>;
                            const a = Math.min(val / maxMapa, 1) * 0.86 + 0.04;
                            const tip = `${f.nombre} · ${t.nombre}: ${propias ? `${pctTxt(val)} de sus publicaciones propias` : `${pctTxt(val)} de las menciones del tema${x?.neto != null ? ` · sentimiento neto ${x.neto > 0 ? '+' : ''}${x.neto}` : ''}`}`;
                            return <td key={f.figura_id}><span className={marcada(t, x) ? 'hc fl' : 'hc'} style={{ background: `rgba(40,90,50,${a.toFixed(2)})`, color: a > 0.5 ? '#fff' : '#1B211D' }} title={tip}>{pctTxt(Math.round(val))}</span></td>;
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {bandera ? (
                <div className="well sm" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 12px', color: '#454E48' }}>
                  <span className="hc fl" style={{ minWidth: 0, width: 18, height: 18, flex: 'none' }} />
                  <span style={{ flex: '1 1 260px' }}>{propias
                    ? `${bandera.f.nombre} dedica ${pctTxt(bandera.x.porcentaje_propias!)} de sus publicaciones a ${bandera.t.nombre}, tema propio de la campaña. Hace 7 días era ${pctTxt(bandera.x.porcentaje_propias_hace_7d!)}.`
                    : `${bandera.f.nombre}, figura rival, tiene ${pctTxt(bandera.x.porcentaje!)} de las menciones de ${bandera.t.nombre}, tema propio de la campaña. Hace 7 días tenía ${pctTxt(bandera.x.porcentaje_hace_7d!)}.`}</span>
                  {alertaBandera ? <Link className="lk" to={`${base}/alertas?alerta=${alertaBandera.id}`}>Ver alerta</Link> : null}
                </div>
              ) : null}
              <div className="mu" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
                {(['Propia', 'Aliada', 'Rival', 'A observar'] as const).filter((r) => figsMapa.some((f) => f.relacion === r)).map((r) => <span className="lg" key={r}><span className="d" style={{ background: REL[r].color }} />{r}</span>)}
                <span>Mide conversación, no intención de voto. Pasa el cursor por una celda para ver el detalle.</span>
              </div>
            </>
          ) : <p className="mu">Todavía no hay cruce de temas por figura para esta campaña.</p>}
        </section>

        <section className="tw" aria-label="Tabla de narrativas">
          <header className="twh" style={{ paddingBottom: 0 }}>
            <h2>Narrativas</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {st.tema ? <button type="button" className="chip own kb" onClick={() => fijar({ tema: '' })} aria-label="Quitar filtro de tema">Tema: {d.temas.get(st.tema)?.nombre ?? 'Sin nombre'}<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button> : null}
              {st.fig !== 'all' ? <button type="button" className="chip own kb" onClick={() => fijar({ fig: 'all' })} aria-label="Quitar filtro de figura">Figura: {figTxt}<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button> : null}
              <span className="mu">{listaNarr.length} de {narrQ.datos.length} narrativas · orden: cambio en 7 días</span>
            </div>
            <div className="tabs" role="tablist" aria-label="Narrativas por dirección" style={{ flex: '1 0 100%' }}>
              {TABS.map(([k, l, fn]) => <button type="button" className="tab" role="tab" key={k} aria-selected={st.tab === k} onClick={() => fijar({ tab: k })}>{l} · {baseNarr.filter((x) => fn(x.n)).length}</button>)}
            </div>
          </header>
          <div>
            {listaNarr.length ? (
              <table className="tt" style={{ minWidth: 960 }}>
                <thead><tr><th>Narrativa</th><th>Figura</th><th>Dirección</th><th>Tema</th><th className="r">Menciones</th><th className="r">Cambio 24 h · 7 d</th><th>Tendencia</th></tr></thead>
                <tbody>
                  {listaNarr.map(({ n, c, f }) => {
                    const dir = DIR[n.direccion] ?? DIR['Sin dirección'];
                    const pf = pctDeFigura(n, figs);
                    const fuerte = n.direccion === 'Desfavorable' && (n.cambio_24h ?? 0) > 20;
                    return (
                      <tr className={st.n === n.id ? 'ck on' : 'ck'} key={n.id} onClick={() => abrir(n.id)}>
                        <td style={{ minWidth: 230 }}><button type="button" className="nb tl">{n.nombre}</button>{n.seguida ? <span className="chip live" style={{ marginLeft: 8 }}>Seguida</span> : null}{n.descripcion ? <div className="mu">{n.descripcion}</div> : null}</td>
                        <td className="sm" style={{ whiteSpace: 'nowrap' }}><div>{f.corto}</div><div className="mu">{f.rel}</div></td>
                        <td><span className={dir.cls}>{dir.texto}</span></td>
                        <td className="sm">{n.tema_id ? d.temas.get(n.tema_id)?.nombre ?? '—' : '—'}</td>
                        <td className="r" style={{ whiteSpace: 'nowrap' }}><div className="b">{c == null ? 'Sin datos' : num(c)}</div><div className="mu">{pf == null ? 'sin figura única' : `${pf.toFixed(1)}% de la figura`}</div></td>
                        <td className="r" style={{ whiteSpace: 'nowrap' }}>{n.cambio_24h == null && n.cambio_7d == null ? <span className="mu">—</span> : <span className={fuerte ? 'b tu' : ''}>{signoPct(n.cambio_24h)} · {n.cambio_7d == null ? 'nueva' : signoPct(n.cambio_7d)}</span>}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{n.tendencia ? <span className={TEND[n.tendencia] ?? 'chip watch'}>{n.tendencia}</span> : <span className="mu">—</span>}{n.detectada_el ? <div className="mu" style={{ paddingTop: 2 }}>Desde el {fecha(n.detectada_el, 'corto')}</div> : null}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: '36px 20px', textAlign: 'center' }} className="mu">
                {narrQ.datos.length
                  ? <>No hay narrativas activas con estos filtros. <button type="button" className="nb lk" style={{ color: '#285A32' }} onClick={() => fijar({ tema: '', fig: 'all', tab: 'all' })}>Quitar filtros</button></>
                  : 'Todavía no hay narrativas detectadas.'}
              </div>
            )}
          </div>
        </section>

        <p className="mu note">Menciones de fuentes monitoreadas. No representa toda la conversación ni la opinión de la población. Las etiquetas de narrativa describen una historia, no afirman que sea cierta. Las narrativas de otras figuras llevan etiquetas neutrales de posicionamiento.</p>

        {sel ? (
          <Detalle
            n={sel} base={base} campanaId={cid} hoy={hoy} zona={campana.zona_horaria} dias={dias} serie={serN.get(sel.id)} marcas={marcasNarr}
            figs={figs} temas={d.temas} narrativas={d.narrativas} conteos={conteos} puedeEditar={puedeEditar} esCliente={esCliente}
            abrir={abrir} cerrar={cerrar}
          />
        ) : null}
      </main>
    </Carga>
  );
}
