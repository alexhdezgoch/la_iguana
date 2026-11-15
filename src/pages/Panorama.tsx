// Panorama (/): vista del equipo sobre todas las campañas que la persona puede ver.
// Fuera de /c/:campanaId no hay campaña actual: se usan useCampanas() y consultas sin filtro de campaña
// (las reglas de acceso de la base dejan solo lo visible).
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { hoyDe, useCampanas, usePagina } from '../shell/Campana';
import { Carga, Vacio } from '../shell/Estados';
import { Icono } from '../shell/Iconos';
import { useSesion } from '../shell/Sesion';
import { useTabla } from '../lib/hooks';
import { SEVERIDAD, ESTADO_EVENTO, fecha, num } from '../lib/formato';
import { ALERTAS_ABIERTAS, type Alerta, type CampanaResumen, type Evento, type FiguraCampana, type MiembroCampana } from '../lib/tipos';
import { agruparFiguras, alertasParaHoy, corto, etiqueta, lasCampanas, porFase, type CampanaPanorama } from './panorama/derivar';
import { TarjetaCampana } from './panorama/TarjetaCampana';
import { TablaFiguras } from './panorama/TablaFiguras';
import './Panorama.css';

const RANGO_SEV: Record<string, number> = { Alta: 0, Media: 1, Baja: 2 };

export default function Panorama() {
  usePagina('Todas las campañas');
  const { campanas } = useCampanas();
  const { persona } = useSesion();
  const [params, setParams] = useSearchParams();

  // "Hoy" del equipo: la fecha de corte más reciente entre las campañas (o la fecha real si ninguna tiene corte).
  const hoy = useMemo(() => {
    const cortes = campanas.map((c) => c.fecha_corte).filter((f): f is string => !!f).sort();
    return cortes.length ? cortes[cortes.length - 1] : hoyDe(null);
  }, [campanas]);
  const desde = useMemo(() => campanas.map((c) => hoyDe(c)).sort()[0] ?? hoy, [campanas, hoy]);

  const resumenes = useTabla<CampanaResumen>('v_campanas_resumen', { orden: 'orden' });
  const figuras = useTabla<FiguraCampana>('v_figuras_campana', { orden: 'orden' });
  const alertas = useTabla<Alerta>('alertas', { eq: { estado: ALERTAS_ABIERTAS }, orden: [['detectada_en', 'desc']] });
  const misRoles = useTabla<MiembroCampana>('miembros_campana', { eq: { persona_id: persona?.id ?? '' } }, !!persona);
  const eventos = useTabla<Evento>('eventos', { neq: { estado: 'Cancelado' }, desde: { fecha_inicio: desde }, orden: [['fecha_inicio', 'asc'], ['hora', 'asc']] });

  const lista: CampanaPanorama[] = useMemo(
    () => campanas.map((c) => ({ c, r: resumenes.datos.find((r) => r.id === c.id) ?? null })),
    [campanas, resumenes.datos],
  );
  const porId = useMemo(() => new Map(lista.map((x) => [x.c.id, x])), [lista]);
  const ordenCampana = useMemo(() => new Map(lista.map((x, i) => [x.c.id, i])), [lista]);
  const cortoDe = (id: string) => { const x = porId.get(id); return x ? corto(x) : id; };
  const etiquetaDe = (id: string) => { const x = porId.get(id); return x ? etiqueta(x) : id; };

  const todas = useMemo(() => agruparFiguras(figuras.datos, ordenCampana), [figuras.datos, ordenCampana]);
  const compartidas = todas.filter((f) => f.vinculos.length > 1).length;
  const sel = params.get('campana');
  const filtro = sel && porId.has(sel) ? sel : null;
  const filas = filtro ? todas.filter((f) => f.vinculos.some((v) => v.campana_id === filtro)) : todas;
  const elegir = (id: string | null) => {
    const p = new URLSearchParams(params);
    if (id) p.set('campana', id); else p.delete('campana');
    setParams(p, { replace: true });
  };

  // Severidad más alta abierta por campaña, para el color del chip de alertas de cada tarjeta.
  const severidadMax = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of alertas.datos) {
      const ya = m.get(a.campana_id);
      if (!ya || (RANGO_SEV[a.severidad] ?? 9) < (RANGO_SEV[ya] ?? 9)) m.set(a.campana_id, a.severidad);
    }
    return m;
  }, [alertas.datos]);

  // Totales del encabezado: suma derivada de las filas.
  const activas = campanas.filter((c) => c.estado === 'Activa');
  const totalAbiertas = lista.reduce((n, x) => n + (x.r?.alertas_abiertas ?? 0), 0);
  const conAltas = lista.filter((x) => (x.r?.alertas_altas ?? 0) > 0);
  const totalAltas = conAltas.reduce((n, x) => n + x.r!.alertas_altas, 0);
  const subAltas = !totalAltas ? 'Ninguna de nivel alto'
    : conAltas.length === 1
      ? `${totalAltas} de nivel alto, ${totalAltas === 1 ? '' : totalAltas === 2 ? 'ambas ' : 'todas '}en ${corto(conAltas[0])}`
      : `${totalAltas} de nivel alto: ${conAltas.map((x) => `${x.r!.alertas_altas} en ${corto(x)}`).join(' · ')}`;
  const conPendientes = lista.filter((x) => (x.r?.menciones_por_revisar ?? 0) > 0);
  const totalPendientes = conPendientes.reduce((n, x) => n + x.r!.menciones_por_revisar, 0);

  const kpis = [
    { kl: 'Campañas activas', kv: num(activas.length), mu: activas.length ? porFase(activas) : 'Ninguna activa' },
    { kl: 'Figuras en seguimiento', kv: num(todas.length), mu: todas.length ? (compartidas ? `${compartidas} ${compartidas === 1 ? 'aparece' : 'aparecen'} en más de una campaña` : 'Ninguna en más de una campaña') : 'Todavía sin figuras' },
    { kl: 'Alertas abiertas', kv: num(totalAbiertas), mu: totalAbiertas ? subAltas : 'Nada que atender por ahora' },
    { kl: 'Menciones por revisar', kv: num(totalPendientes), mu: totalPendientes ? conPendientes.map((x) => `${x.r!.menciones_por_revisar} en ${corto(x)}`).join(' · ') : 'Nada por revisar' },
  ];

  // La lista junta las alertas repetidas en varias campañas: se cuentan las distintas, no la suma por campaña.
  const distintas = alertasParaHoy(alertas.datos, ordenCampana, Infinity);
  const paraHoy = distintas.slice(0, 5);
  // Un borrador no es un evento confirmado: no se presenta como próximo.
  const proximos = eventos.datos
    .filter((e) => e.estado !== 'Borrador' && e.fecha_inicio && porId.has(e.campana_id) && e.fecha_inicio >= hoyDe(porId.get(e.campana_id)!.c))
    .slice(0, 3);
  const demos = lista.filter((x) => x.c.es_demo).length;
  const primera = lista[0] ?? null;
  const conAlertas = lista.find((x) => (x.r?.alertas_abiertas ?? 0) > 0) ?? primera;
  // Misma regla que crear_campana y que el asistente: cualquier persona activa del equipo que no sea externa.
  const puedeCrear = !!persona && persona.rol_org !== 'externo';
  // Enlaces a altas (figura, evento) solo hacia campañas donde la persona puede escribir.
  const editable = (cid: string | null | undefined) => !!cid && !!persona
    && (persona.rol_org === 'admin' || misRoles.datos.some((m) => m.campana_id === cid && (m.rol === 'Administración' || m.rol === 'Análisis')));
  const hoyTexto = fecha(hoy, 'completo').replace(/^./, (l) => l.toLowerCase());

  return (
    <Carga estados={[resumenes, figuras, alertas, eventos]}>
      <main className="page pg-panorama">
        <div className="ph">
          <div>
            <h1>Todas las campañas</h1>
            <p className="mu">Lo que el equipo tiene abierto hoy, {hoyTexto} · últimos 30 días</p>
          </div>
          {puedeCrear ? <Link className="btn bp" to="/nueva-campana"><Icono n="mas" g={2} />Nueva campaña</Link> : null}
        </div>

        {!lista.length ? (
          <Vacio titulo="Todavía no hay campañas">
            {puedeCrear ? <><Link to="/nueva-campana">Crear una campaña</Link> para empezar a monitorear.</> : 'Cuando te sumen a una campaña aparecerá aquí.'}
          </Vacio>
        ) : (
          <>
            <section className="kpis" aria-label="Totales del equipo">
              {kpis.map((k) => (
                <div className="kpi" key={k.kl}>
                  <span className="kl">{k.kl}</span>
                  <span className="kv">{k.kv}</span>
                  <span className="mu">{k.mu}</span>
                </div>
              ))}
            </section>

            <div className="pn-tarjetas">
              {lista.map((x) => <TarjetaCampana key={x.c.id} x={x} severidadMax={severidadMax.get(x.c.id) ?? null} puedeEditar={editable(x.c.id)} marcarDemo={x.c.es_demo && demos < lista.length} />)}
            </div>

            <div className="pn-cab">
              <div className="pn-cab-t">
                <h2>Figuras de todas las campañas</h2>
                <div className="seg" role="group" aria-label="Filtrar por campaña">
                  <button type="button" className="pill" aria-pressed={!filtro} onClick={() => elegir(null)}>Todas</button>
                  {lista.map((x) => (
                    <button key={x.c.id} type="button" className="pill" aria-pressed={filtro === x.c.id} onClick={() => elegir(x.c.id)}>{corto(x)}</button>
                  ))}
                </div>
              </div>
              <span className="mu">{filas.length} de {todas.length} {todas.length === 1 ? 'figura' : 'figuras'}</span>
            </div>

            {filas.length ? (
              <TablaFiguras filas={filas} cortoDe={cortoDe} />
            ) : (
              <Vacio titulo={filtro ? `${etiquetaDe(filtro)} todavía no tiene figuras` : 'Todavía no hay figuras en seguimiento'}>
                {editable(filtro ?? primera?.c.id)
                  ? <><Link to={`/c/${filtro ?? primera?.c.id}/figuras/nueva`}>Agregar una figura</Link> para ver sus cifras aquí.</>
                  : 'Cuando el equipo agregue figuras, aparecerán aquí con sus cifras.'}
              </Vacio>
            )}

            <div className="row">
              <section className="card c1">
                <div className="ch">
                  <h2>Alertas abiertas · {distintas.length}</h2>
                  {conAlertas ? <Link className="lk" to={`/c/${conAlertas.c.id}/alertas`} title={`Abre las alertas de ${etiqueta(conAlertas)}`}>Ver alertas</Link> : null}
                </div>
                {paraHoy.length ? (
                  <div className="list">
                    {paraHoy.map(({ alerta: a, campanas: cs }) => (
                      <Link className="li pn-li" key={a.id} to={`/c/${a.campana_id}/alertas?alerta=${encodeURIComponent(a.id)}`} style={{ alignItems: 'flex-start' }}>
                        <span className={SEVERIDAD[a.severidad]} style={{ flex: '0 0 54px', justifyContent: 'center' }}>{a.severidad}</span>
                        <div className="gr"><span className="sm">{a.texto}</span><span className="mu">{cs.map(etiquetaDe).join(' y ')}</span></div>
                      </Link>
                    ))}
                  </div>
                ) : <p className="mu">Nada que atender por ahora.</p>}
                {distintas.length > paraHoy.length || distintas.length !== totalAbiertas ? (
                  <p className="mu sm">
                    {distintas.length > paraHoy.length ? `Las ${paraHoy.length} más urgentes de ${distintas.length}. ` : ''}
                    {distintas.length !== totalAbiertas ? 'Una alerta repetida en varias campañas se cuenta una vez.' : ''}
                  </p>
                ) : null}
              </section>

              <section className="card c1">
                <div className="ch">
                  <h2>Próximos eventos</h2>
                  {primera ? <Link className="lk" to={`/c/${(proximos[0] ? porId.get(proximos[0].campana_id) ?? primera : primera).c.id}/eventos`} title={`Abre los eventos de ${etiqueta(proximos[0] ? porId.get(proximos[0].campana_id) ?? primera : primera)}`}>Ver eventos</Link> : null}
                </div>
                {proximos.length ? (
                  <div className="list">
                    {proximos.map((e) => {
                      const [dia, mes] = fecha(e.fecha_inicio, 'corto').split(' ');
                      return (
                        <Link className="li pn-li" key={e.id} to={`/c/${e.campana_id}/eventos/${e.id}`}>
                          <span className="ini pn-fecha" aria-hidden="true"><span className="pn-mes">{mes}</span><span className="pn-dia">{dia}</span></span>
                          <div className="gr"><span className="b">{e.nombre}</span><span className="mu">{e.tipo} · {etiquetaDe(e.campana_id)}</span></div>
                          <span className={ESTADO_EVENTO[e.estado] ?? 'chip watch'}>{e.estado}</span>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mu">Sin eventos por venir.{primera && editable(primera.c.id) ? <> <Link to={`/c/${primera.c.id}/eventos/nuevo`}>Crear evento</Link></> : null}</p>
                )}
              </section>
            </div>

            <p className="mu note">
              Cada figura se guarda una sola vez y se enlaza a cada campaña con su propia relación. Las cifras de esta pantalla suman {lasCampanas(lista.length)}{demos && demos < lista.length ? `, incluidas ${demos === 1 ? 'la de demostración (escenario hipotético)' : `las ${demos} de demostración (escenario hipotético)`}` : ''}. Dentro de una campaña, todo se calcula solo con sus figuras.
            </p>
          </>
        )}
      </main>
    </Carga>
  );
}
