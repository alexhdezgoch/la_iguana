import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router-dom';
import { useAcciones } from './Acciones';
import { hoyDe, useCampanaOpcional, useCampanas, usePaginaActual } from './Campana';
import { Icono, Logo, type NombreIcono } from './Iconos';
import { useSesion } from './Sesion';
import { useTabla } from '../lib/hooks';
import { diasEntre } from '../lib/formato';
import type { Campana, CampanaResumen } from '../lib/tipos';

function pieCampana(c: Campana): string {
  const ambito = c.ambito ?? c.contienda ?? '';
  if (c.fase === 'Campaña' && c.jornada) {
    const d = diasEntre(hoyDe(c), c.jornada);
    if (d != null && d >= 0) return `${ambito} · ${d} días`;
  }
  return `${ambito} · ${c.fase.toLowerCase()}`;
}

function Selector({ actual, campanas, resumenes }: { actual: Campana | null; campanas: Campana[]; resumenes: CampanaResumen[] }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDetailsElement>(null);
  const loc = useLocation();
  const { datos: vinculos } = useTabla<{ figura_id: string }>('campana_figuras');
  useEffect(() => setAbierto(false), [loc.pathname]);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla); };
  }, [abierto]);
  const personas = new Set(vinculos.map((v) => v.figura_id)).size || resumenes.reduce((n, r) => n + r.figuras, 0);

  return (
    <details className="swd" ref={ref} open={abierto} onToggle={(e) => setAbierto((e.target as HTMLDetailsElement).open)}>
      <summary className="sw" aria-label="Cambiar de campaña" onClick={(e) => { e.preventDefault(); setAbierto((v) => !v); }}>
        {actual
          ? <span className="sw-b">{actual.iniciales}</span>
          : <span className="sw-b" style={{ background: '#DCE3DB', color: '#1B211D' }}>{campanas.length}</span>}
        <span className="sw-t">
          <span className="sm b">{actual ? actual.nombre : 'Todas las campañas'}</span>
          <span className="mu">{actual ? actual.contienda : 'Vista del equipo'}</span>
        </span>
        <Icono n="selector" />
      </summary>
      <div className="swm">
        <Link className={'swi' + (actual ? '' : ' cur')} to="/" aria-current={actual ? undefined : 'true'} style={{ textDecoration: 'none' }}>
          <span className="swp" style={{ boxShadow: 'none', background: '#EEF0EC', color: '#454E48' }}><Icono n="cuadricula" /></span>
          <span className="sw-t">
            <span className="sm b">Todas las campañas</span>
            <span className="mu">{campanas.length} {campanas.length === 1 ? 'campaña' : 'campañas'} · {personas} {personas === 1 ? 'figura' : 'figuras'}</span>
          </span>
        </Link>
        <span className="swh" style={{ borderTop: '1px solid rgb(22 32 25 / .07)', marginTop: 4, paddingTop: 10 }}>Campañas</span>
        {campanas.map((c) => {
          const cur = actual?.id === c.id;
          return (
            <Link key={c.id} className={'swi' + (cur ? ' cur' : '')} to={`/c/${c.id}`} aria-current={cur ? 'true' : undefined} style={{ textDecoration: 'none' }}>
              <span className={'sw-b' + (cur ? '' : ' alt')}>{c.iniciales}</span>
              <span className="sw-t"><span className="sm b">{c.nombre}</span><span className="mu">{pieCampana(c)}</span></span>
              <Icono n="ok" g={2} />
            </Link>
          );
        })}
        <div className="swn">
          <Link className="swi" to="/nueva-campana" style={{ textDecoration: 'none' }}>
            <span className="swp"><Icono n="mas" g={2} /></span>Nueva campaña
          </Link>
        </div>
      </div>
    </details>
  );
}

function Item({ a, icono, children, fin, cuenta }: { a: string; icono: NombreIcono; children: string; fin?: boolean; cuenta?: number }) {
  return (
    <NavLink className={({ isActive }) => 'ni' + (isActive ? ' on' : '')} to={a} end={fin}>
      <Icono n={icono} />{children}{cuenta ? <span className="cnt">{cuenta}</span> : null}
    </NavLink>
  );
}

export function Layout() {
  const { campanaId } = useParams();
  const { campanas, resumenes, cargando, error } = useCampanas();
  const actual = useCampanaOpcional();
  const { org, usuario, salir } = useSesion();
  const { titulo, migas } = usePaginaActual();
  const { abrirBuscador, abrirPeriodo, periodo } = useAcciones();

  // La barra lateral siempre apunta a una campaña: la actual o, en las vistas del equipo, la primera.
  const destino = actual ?? campanas[0] ?? null;
  const base = destino ? `/c/${destino.id}` : '';
  const res = resumenes.find((r) => r.id === destino?.id);
  const abiertas = res?.alertas_abiertas ?? 0;
  const porRevisar = res?.menciones_por_revisar ?? 0;
  const esDemo = actual ? actual.es_demo : campanas.some((c) => c.es_demo);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); abrirBuscador(); }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [abrirBuscador]);

  const faltaCampana = !!campanaId && !actual;

  return (
    <div className="app">
      <nav className="side" aria-label="Navegación">
        <Link className="logo" to="/"><Logo />La Iguana</Link>
        <Selector actual={actual} campanas={campanas} resumenes={resumenes} />
        <button type="button" className="find" onClick={abrirBuscador}><Icono n="buscar" />Buscar<span className="kbd">Ctrl K</span></button>
        {destino ? (
          <>
            <Item a={base} icono="resumen" fin>Resumen</Item>
            <div className="grp">Monitoreo</div>
            <Item a={`${base}/figuras`} icono="figuras">Figuras</Item>
            <Item a={`${base}/eventos`} icono="eventos">Eventos</Item>
            <Item a={`${base}/menciones`} icono="menciones" cuenta={porRevisar}>Menciones</Item>
            <Item a={`${base}/temas`} icono="temas">Temas y narrativas</Item>
            <div className="grp">Salidas</div>
            <Item a={`${base}/alertas`} icono="alertas" cuenta={abiertas}>Alertas</Item>
            <Item a={`${base}/reportes`} icono="reportes">Reportes</Item>
          </>
        ) : null}
        <div className="user">
          <span className="av" aria-hidden="true">{org?.iniciales ?? '··'}</span>
          <span className="sw-t">
            <span className="sm b">{org?.nombre ?? 'La Iguana'}</span>
            <span className="mu">{esDemo ? 'Escenario hipotético, cifras ilustrativas' : usuario?.email}</span>
          </span>
          <button type="button" className="btn bg bi salir" onClick={() => void salir()} aria-label="Cerrar sesión" title={`Cerrar sesión (${usuario?.email ?? ''})`}><Icono n="salir" /></button>
        </div>
      </nav>

      <div className="main">
        <div className="top">
          <div className="crumb">
            {actual ? (
              <>
                <Link to="/">Campañas</Link><Icono n="sig" t={14} />
                {titulo ? <><Link to={`/c/${actual.id}`}>{actual.titulo_largo ?? actual.nombre}</Link><Icono n="sig" t={14} /></> : <span className="here">{actual.titulo_largo ?? actual.nombre}</span>}
              </>
            ) : titulo && titulo !== 'Todas las campañas' ? (
              <><Link to="/">Campañas</Link><Icono n="sig" t={14} /></>
            ) : null}
            {migas.map((m) => (
              <span key={m.texto} style={{ display: 'contents' }}>{m.a ? <Link to={m.a}>{m.texto}</Link> : <span>{m.texto}</span>}<Icono n="sig" t={14} /></span>
            ))}
            {titulo ? <span className="here">{titulo}</span> : null}
          </div>
          {esDemo ? <span className="chip warn sp" title="Personas y partidos reales. Cifras, menciones y eventos inventados para la demostración.">Demo · escenario hipotético</span> : <span className="sp" />}
          <button type="button" className="btn bg" onClick={(e) => abrirPeriodo(e.currentTarget)}><Icono n="eventos" />{periodo}</button>
          {destino ? (
            <Link className="btn bg bi" to={`${base}/alertas`} aria-label={`Alertas, ${abiertas} abiertas`}>
              <Icono n="alertas" />{abiertas ? <span className="dotn" /> : null}
            </Link>
          ) : null}
        </div>

        {error ? (
          <main className="page"><div className="card"><h2>No se pudieron cargar las campañas</h2><p className="mu">{error}</p></div></main>
        ) : cargando ? (
          <main className="page" aria-busy="true"><div className="cargando">Cargando…</div></main>
        ) : faltaCampana ? (
          <main className="page"><div className="card"><h2>Esta campaña no existe o no tienes acceso</h2><p><Link to="/">Ver todas las campañas</Link></p></div></main>
        ) : (
          <Suspense fallback={<main className="page" aria-busy="true"><div className="cargando">Cargando…</div></main>}>
            <Outlet />
          </Suspense>
        )}
      </div>
    </div>
  );
}
