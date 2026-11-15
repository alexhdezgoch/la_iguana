import { Link } from 'react-router-dom';
import { Vacio } from '../../shell/Estados';
import { useTabla } from '../../lib/hooks';
import { ESTADO_EVENTO, REL, SEVERIDAD, diasEntre, fecha, neto, num, pct } from '../../lib/formato';
import { ALERTAS_ABIERTAS, type Alerta, type Evento, type Narrativa, type Relacion, type SerieDiaria, type Tema } from '../../lib/tipos';
import { CargaSeccion, DIRECCION, Tendencia, plural, totalConversacion, type Ctx } from './comun';
import { narrativasDe } from '../figura/comun';

const SIN_FIGURA = '#B5BCB6';

export default function SecResumen({ c }: { c: Ctx }) {
  const { campana, base, hoy, figuras, propia, puedeEditar } = c;
  const cid = campana.id;
  const propiaId = campana.figura_propia_id;

  const alertas = useTabla<Alerta>('alertas', { eq: { campana_id: cid, estado: ALERTAS_ABIERTAS }, orden: 'orden' });
  const eventos = useTabla<Evento>('eventos', { eq: { campana_id: cid, estado: ['Programado', 'Borrador'] }, desde: { fecha_inicio: hoy }, orden: 'fecha_inicio', limite: 20 });
  const temas = useTabla<Tema>('temas', { eq: { campana_id: cid }, orden: 'orden' });
  // Narrativas sobre la figura propia: misma regla que Figura y Temas (figura_id o detalle.figura_ids), por menciones.
  const narrativas = useTabla<Narrativa>('narrativas', { eq: { campana_id: cid }, orden: 'orden' }, !!propiaId);
  const sobrePropia = propiaId ? narrativasDe(narrativas.datos, propiaId) : [];
  const serie = useTabla<SerieDiaria>('series_diarias', { eq: { campana_id: cid, entidad: 'figura', entidad_id: propiaId ?? '' }, orden: 'fecha' }, !!propiaId);

  const porPart = [...figuras].sort((a, b) => (b.participacion ?? 0) - (a.participacion ?? 0));
  const totalFiguras = figuras.reduce((n, f) => n + f.menciones, 0);
  const conversacion = totalConversacion(propia);
  const unaSola = figuras.length === 1;
  const lugar = propia ? porPart.findIndex((f) => f.figura_id === propia.figura_id) + 1 : 0;
  const otro = porPart.find((f) => f.figura_id !== propiaId) ?? null;
  // Lo que queda de la conversación sin ninguna figura monitoreada (derivado).
  const sumaPart = figuras.reduce((n, f) => n + (f.participacion ?? 0), 0);
  const resto = figuras.length && sumaPart < 99.5 ? 100 - sumaPart : 0;
  const maxPart = Math.max(1, resto, ...figuras.map((f) => f.participacion ?? 0));
  const relaciones = (Object.keys(REL) as Relacion[]).filter((r) => figuras.some((f) => f.relacion === r));
  const maxTema = Math.max(1, ...temas.datos.map((t) => t.porcentaje ?? 0));
  // Un borrador no es un evento confirmado: el "próximo evento" es el primer Programado. Si solo hay borradores, se avisa aparte.
  const proximo = eventos.datos.find((e) => e.estado === 'Programado') ?? null;
  const borrador = proximo ? null : eventos.datos.find((e) => e.estado === 'Borrador') ?? null;
  const enDias = proximo ? diasEntre(hoy, proximo.fecha_inicio) : null;
  const faltan = campana.jornada ? diasEntre(hoy, campana.jornada) : null;
  const lugarTexto = (e: Evento) => {
    const partes = [e.sede, e.ciudad, typeof e.extra?.estado_region === 'string' ? e.extra.estado_region : null].filter((x): x is string => !!x);
    return [...new Set(partes)].join(', ');
  };

  return (
    <CargaSeccion estados={[alertas, eventos, temas, narrativas, serie]}>
      <div className="col fade" style={{ gap: 20 }}>
        <section className="card" aria-label={campana.fase} style={{ gap: 10 }}>
          <div className="ch">
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 10px' }}>
              <span className="chip ring">{campana.fase}</span>
              <span className="b">
                {campana.jornada && faltan != null && faltan >= 0
                  ? `Jornada electoral el ${fecha(campana.jornada, 'dia')} · faltan ${plural(faltan, 'día', 'días')}`
                  : campana.jornada ? `Jornada electoral del ${fecha(campana.jornada, 'largo')}` : 'Sin fecha oficial de jornada electoral'}
              </span>
            </div>
            {!campana.jornada ? <span className="mu">{campana.contienda ? `${campana.contienda} · ` : ''}el reloj electoral se activa cuando se publique la convocatoria</span> : null}
          </div>
          {campana.fase === 'Precampaña' ? (
            <p className="sm" style={{ color: '#454E48', maxWidth: 860 }}>En precampaña no hay cuenta regresiva ni veda. El monitoreo sirve para fijar la línea base de cada figura, seguir los temas locales y medir los primeros eventos antes de que arranque la campaña.</p>
          ) : null}
        </section>

        {propia ? (
          <section className="kpis" aria-label={`Cifras de ${propia.nombre}`}>
            <div className="kpi lead">
              <div className="ch"><span className="kl">Menciones de {propia.nombre}</span><span className="chip own">Propia</span></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px 20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="kv">{num(propia.menciones)}</span>
                  <span className="mu">
                    {unaSola
                      ? (conversacion ? `de ${num(conversacion)} en la conversación de esta campaña` : 'Única figura en seguimiento')
                      : `de ${num(totalFiguras)} entre las ${figuras.length} figuras de esta campaña`}
                  </span>
                </div>
                <Tendencia serie={serie.datos.map((s) => s.menciones)} />
              </div>
            </div>
            <div className="kpi">
              <span className="kl">Participación</span>
              <span className="kv">{pct(propia.participacion)}</span>
              <span className="mu">
                {unaSola
                  ? 'De la conversación de esta campaña, la parte que nombra a la figura. Es la única figura en seguimiento'
                  : <>{lugar === 1 ? 'Primer lugar.' : lugar ? `Lugar ${lugar}.` : ''}{otro ? ` ${otro.nombre} tiene ${pct(otro.participacion)}` : ''}</>}
              </span>
            </div>
            <div className="kpi">
              <span className="kl">Sentimiento neto</span>
              <span className={'kv ' + ((propia.neto ?? 0) >= 0 ? 'tf' : 'tu')}>{neto(propia.neto)}</span>
              <span className="mu">{propia.favorable != null && propia.desfavorable != null ? `${propia.favorable}% favorable menos ${propia.desfavorable}% desfavorable` : 'Sin desglose todavía'}</span>
            </div>
            <div className="kpi">
              <span className="kl">Índice de riesgo</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span className="kv">{propia.riesgo ?? 'Sin datos'}</span>
                {propia.riesgo_nivel ? <span className={'chip ' + (propia.riesgo_nivel === 'Alto' ? 'unf' : propia.riesgo_nivel === 'Medio' ? 'warn' : 'watch')}>{propia.riesgo_nivel}</span> : null}
              </div>
              <span className="mu">Escala de 0 a 100</span>
            </div>
          </section>
        ) : (
          <Vacio titulo="Esta campaña todavía no tiene figura propia">
            {puedeEditar ? <><Link to={`${base}/figuras/nueva`}>Agregar una figura</Link> con relación Propia para ver sus cifras aquí.</> : 'Cuando el equipo agregue una figura con relación Propia, sus cifras aparecen aquí.'}
          </Vacio>
        )}

        <div className="row">
          <section className="card c3">
            <div className="ch">
              <h2>Participación en la conversación</h2>
              <Link className="lk" to={`${base}/figuras`}>Ver figuras</Link>
            </div>
            {figuras.length ? (
              <div className="bars">
                {porPart.map((f) => (
                  <div className="br" key={f.id}>
                    <div style={{ flex: '0 0 176px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                      <Link className="tl sm" to={`${base}/figuras/${f.figura_id}`}>{f.nombre}</Link>
                      <span className="mu">{f.relacion} · neto {neto(f.neto)}</span>
                    </div>
                    <div className="bar"><i style={{ width: `${(((f.participacion ?? 0) / maxPart) * 100).toFixed(1)}%`, background: REL[f.relacion].color }} /></div>
                    <div className="sm b r" style={{ flex: '0 0 48px' }}>{pct(f.participacion)}</div>
                  </div>
                ))}
                {resto > 0 ? (
                  <div className="br">
                    <div style={{ flex: '0 0 176px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                      <span className="sm b">Sin figura en seguimiento</span>
                      <span className="mu">Menciones que no nombran a ninguna figura</span>
                    </div>
                    <div className="bar"><i style={{ width: `${((resto / maxPart) * 100).toFixed(1)}%`, background: SIN_FIGURA }} /></div>
                    <div className="sm b r" style={{ flex: '0 0 48px' }}>{pct(resto)}</div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mu">Sin figuras en seguimiento.{puedeEditar ? <> <Link className="lk" to={`${base}/figuras/nueva`}>Agregar figura</Link></> : null}</p>
            )}
            {unaSola ? (
              <div className="well" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '6px 16px', fontSize: 13, lineHeight: '18px', color: '#454E48' }}>
                <span>Con una sola figura, la participación se calcula sobre {conversacion ? `las ${num(conversacion)} menciones de` : ''} la conversación de esta campaña.</span>
                {puedeEditar ? <Link className="lk" to={`${base}/figuras/nueva`}>Agrega rivales para comparar</Link> : null}
              </div>
            ) : figuras.length ? (
              <div className="well" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', fontSize: 13, lineHeight: '18px', color: '#454E48' }}>
                {relaciones.map((r) => (
                  <span key={r} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span className="d" style={{ background: REL[r].color }} />{r}</span>
                ))}
                <span>{num(totalFiguras)} menciones entre las {figuras.length} figuras de esta campaña</span>
              </div>
            ) : null}
          </section>

          <div className="col c2">
            <section className="card">
              <div className="ch"><h2>Alertas abiertas · {alertas.datos.length}</h2><Link className="lk" to={`${base}/alertas`}>Ver alertas</Link></div>
              {alertas.datos.length ? (
                <div className="list">
                  {alertas.datos.map((a) => (
                    <div className="li" key={a.id} style={{ alignItems: 'flex-start' }}>
                      <span className={SEVERIDAD[a.severidad]} style={{ flex: '0 0 54px', justifyContent: 'center' }}>{a.severidad}</span>
                      <span className="sm">{a.texto}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="mu">Nada que atender por ahora.</p>}
            </section>
            <section className="card" style={{ gap: 6 }}>
              {proximo ? (
                <>
                  <span className="kl">Próximo evento{enDias != null ? (enDias === 0 ? ' · hoy' : ` · en ${plural(enDias, 'día', 'días')}`) : ''}</span>
                  <h2><Link className="tl" to={`${base}/eventos/${proximo.id}`}>{proximo.nombre}</Link></h2>
                  <span className="sm">{fecha(proximo.fecha_inicio, 'dia').replace(/^./, (x) => x.toUpperCase())}{lugarTexto(proximo) ? ` · ${lugarTexto(proximo)}` : ''}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingTop: 6 }}>
                    <span className={ESTADO_EVENTO[proximo.estado] ?? 'chip watch'}>{proximo.estado}</span>
                    <span className="mu">{proximo.tipo} · {proximo.origen.toLowerCase()}</span>
                    <Link className="lk sp" to={`${base}/eventos`}>Ver eventos</Link>
                  </div>
                </>
              ) : (
                <>
                  <span className="kl">Próximo evento</span>
                  <h2>{borrador ? 'Sin eventos programados' : 'Sin eventos por venir'}</h2>
                  {borrador ? <span className="sm">Hay un borrador por completar: <Link className="tl" to={`${base}/eventos/${borrador.id}`}>{borrador.nombre}</Link></span> : null}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', paddingTop: 6 }}>
                    {puedeEditar ? <Link className="lk" to={`${base}/eventos/nuevo`}>Crear evento</Link> : null}
                    <Link className="lk" to={`${base}/eventos`}>Ver eventos</Link>
                  </div>
                </>
              )}
            </section>
          </div>
        </div>

        <div className="row">
          <section className="card c1">
            <div className="ch"><h2>Temas del periodo</h2><Link className="lk" to={`${base}/temas`}>Ver temas y narrativas</Link></div>
            {temas.datos.length ? (
              <div className="bars">
                {temas.datos.map((t) => (
                  <div className="br" key={t.id}>
                    <div className="sm" style={{ flex: '0 0 132px' }}>{t.nombre}</div>
                    <div className="bar"><i style={{ width: `${(((t.porcentaje ?? 0) / maxTema) * 100).toFixed(1)}%` }} /></div>
                    <div className="sm r" style={{ flex: '0 0 96px' }}><span className="b">{pct(t.porcentaje, 0)}</span> · {num(t.menciones)}</div>
                  </div>
                ))}
              </div>
            ) : <p className="mu">Los temas aparecen cuando hay menciones clasificadas.</p>}
          </section>

          <section className="card c1">
            <h2>{propia ? `Narrativas sobre ${propia.nombre}` : 'Narrativas'}</h2>
            {sobrePropia.length ? (
              <div className="list">
                {sobrePropia.map((n) => {
                  const d = DIRECCION[n.direccion] ?? DIRECCION['Sin dirección'];
                  return (
                    <div className="li" key={n.id}>
                      <div className="gr"><span className="b">{n.nombre}</span><span className="mu">{n.tendencia ?? ''}</span></div>
                      <span className="b">{num(n.menciones)}</span>
                      <span className={d.cls} style={{ flex: '0 0 84px', justifyContent: 'center' }}>{d.texto}</span>
                    </div>
                  );
                })}
              </div>
            ) : <p className="mu">Todavía no hay narrativas detectadas.</p>}
          </section>
        </div>

        <p className="mu note">Cada campaña es un espacio separado: sus menciones, eventos y alertas no se mezclan con los de otras campañas. Las figuras se guardan una sola vez y se vinculan a cada campaña con su propia relación.</p>
      </div>
    </CargaSeccion>
  );
}
