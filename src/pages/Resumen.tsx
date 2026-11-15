// Resumen de una campaña. Pantalla de referencia: las demás siguen este patrón.
//   1. usePagina(título)  2. hooks de datos filtrados por campana_id  3. <Carga> mientras llegan
//   4. todo texto y cifra sale de los datos; lo que no existe muestra un estado vacío, nunca un valor inventado.
import { Link } from 'react-router-dom';
import { hoyDe, useCampana, usePagina, useRol } from '../shell/Campana';
import { Carga, Vacio } from '../shell/Estados';
import { useTabla } from '../lib/hooks';
import { REL, SEVERIDAD, diasEntre, fecha, neto, num, pct, rango } from '../lib/formato';
import { ALERTAS_ABIERTAS, type Alerta, type Evento, type FiguraCampana, type Narrativa, type SerieDiaria, type Tema } from '../lib/tipos';
import { narrativasDe } from './figura/comun';

const DIRECCION: Record<string, { texto: string; cls: string }> = {
  Favorable: { texto: 'A favor', cls: 'chip fav' },
  Desfavorable: { texto: 'En contra', cls: 'chip unf' },
  Posicionamiento: { texto: 'Posicionamiento', cls: 'chip watch' },
  'Sin dirección': { texto: 'Sin dirección', cls: 'chip watch' },
};

/** Línea de menciones por día, en el estilo de la demo. */
function Tendencia({ serie }: { serie: number[] }) {
  if (serie.length < 2) return null;
  const max = Math.max(...serie), min = Math.min(...serie);
  const y = (v: number) => (max === min ? 28 : 46 - ((v - min) / (max - min)) * 36);
  const pts = serie.map((v, i) => `${((i / (serie.length - 1)) * 220).toFixed(1)} ${y(v).toFixed(1)}`);
  const linea = 'M' + pts.join(' L');
  return (
    <svg viewBox="0 0 220 56" height="56" preserveAspectRatio="none" role="img" aria-label={`Menciones por día en los últimos ${serie.length} días`} style={{ flex: '1 1 200px', minWidth: 0, maxWidth: 340 }}>
      <path d={`${linea} L220 56 L0 56 Z`} fill="#E7F0E8" />
      <path d={linea} fill="none" stroke="#285A32" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function Resumen() {
  usePagina('Resumen');
  const campana = useCampana();
  const cid = campana.id;
  const hoy = hoyDe(campana);
  const base = `/c/${cid}`;
  const { puedeEditar } = useRol();

  const figuras = useTabla<FiguraCampana>('v_figuras_campana', { eq: { campana_id: cid }, orden: [['participacion', 'desc'], ['orden', 'asc']] });
  const alertas = useTabla<Alerta>('alertas', { eq: { campana_id: cid, estado: ALERTAS_ABIERTAS }, orden: 'orden' });
  const eventos = useTabla<Evento>('eventos', { eq: { campana_id: cid, estado: ['Programado', 'Borrador'] }, desde: { fecha_inicio: hoy }, orden: 'fecha_inicio', limite: 20 });
  const temas = useTabla<Tema>('temas', { eq: { campana_id: cid }, orden: 'orden' });
  const propiaId = campana.figura_propia_id;
  // Narrativas sobre la figura propia: misma regla que Figura y Temas (figura_id o detalle.figura_ids), por menciones.
  const narrativas = useTabla<Narrativa>('narrativas', { eq: { campana_id: cid }, orden: 'orden' }, !!propiaId);
  const sobrePropia = propiaId ? narrativasDe(narrativas.datos, propiaId) : [];
  const serie = useTabla<SerieDiaria>('series_diarias', { eq: { campana_id: cid, entidad: 'figura', entidad_id: propiaId ?? '' }, orden: 'fecha' }, !!propiaId);

  const propia = figuras.datos.find((f) => f.figura_id === propiaId) ?? null;
  const total = figuras.datos.reduce((n, f) => n + f.menciones, 0);
  const maxPart = Math.max(1, ...figuras.datos.map((f) => f.participacion ?? 0));
  // Con corte: la figura propia tiene participación guardada. Sin corte (campaña nueva), no hay lugar ni comparación.
  const conCorte = !!propia && propia.participacion != null;
  const conPart = figuras.datos.filter((f) => f.participacion != null);
  const lugar = conCorte ? conPart.findIndex((f) => f.figura_id === propia!.figura_id) + 1 : 0;
  const rival = conCorte ? conPart.find((f) => f.figura_id !== propiaId) ?? null : null;
  const conMetricas = figuras.datos.filter((f) => f.periodo != null).length;
  const maxTema = Math.max(1, ...temas.datos.map((t) => t.porcentaje ?? 0));
  // Un borrador no es un evento confirmado: el "próximo evento" es el primer Programado. Si solo hay borradores, se avisa aparte.
  const proximo = eventos.datos.find((e) => e.estado === 'Programado') ?? null;
  const borrador = proximo ? null : eventos.datos.find((e) => e.estado === 'Borrador') ?? null;
  const enDias = proximo ? diasEntre(hoy, proximo.fecha_inicio) : null;

  // Fase electoral: día de campaña y cuenta regresiva, solo si la campaña tiene calendario.
  const dia = campana.inicio_campana ? (diasEntre(campana.inicio_campana, hoy) ?? 0) + 1 : null;
  const dias = campana.inicio_campana && campana.fin_campana ? (diasEntre(campana.inicio_campana, campana.fin_campana) ?? 0) + 1 : null;
  const faltan = campana.jornada ? diasEntre(hoy, campana.jornada) : null;
  const enCampana = campana.fase === 'Campaña' && dia != null && dias != null && dia >= 1 && dia <= dias;

  return (
    <Carga estados={[figuras, alertas, temas]}>
      <main className="page">
        <div className="ph">
          <div>
            <h1>Resumen</h1>
            <p className="mu">{fecha(hoy, 'completo')}{campana.periodo_inicio ? ` · ${rango(campana.periodo_inicio, campana.periodo_fin)}` : ''}</p>
          </div>
        </div>

        <section className="card" aria-label="Fase electoral" style={{ gap: 12 }}>
          <div className="ch">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className={enCampana ? 'chip live' : 'chip ring'}>{campana.fase}</span>
              {enCampana ? <span className="b">Día {dia} de {dias}</span> : null}
            </div>
            <span className="mu">
              {faltan != null && faltan >= 0
                ? `Faltan ${faltan} días para la jornada electoral del ${fecha(campana.jornada, 'dia')}`
                : 'Sin fecha oficial de jornada electoral'}
              {campana.veda_inicio ? ` · veda del ${rango(campana.veda_inicio, campana.veda_fin).replace(' a ', ' al ')}` : ''}
            </span>
          </div>
          {enCampana ? <div className="bar" style={{ flex: 'none', height: 6 }}><i style={{ width: `${((dia! / dias!) * 100).toFixed(1)}%`, background: '#285A32' }} /></div> : null}
        </section>

        {propia ? (
          <section className="kpis" aria-label={`Cifras de ${propia.nombre}`}>
            <div className="kpi lead">
              <div className="ch"><span className="kl">Menciones de {propia.nombre}</span><span className="chip own">Propia</span></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px 20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="kv">{propia.periodo != null ? num(propia.menciones) : 'Sin datos'}</span>
                  <span className="mu">
                    {propia.periodo != null
                      ? `de ${num(total)} entre ${conMetricas === 1 ? 'la figura monitoreada' : `las ${conMetricas} figuras monitoreadas`}`
                      : 'Las cifras aparecen con las primeras menciones'}
                  </span>
                </div>
                <Tendencia serie={serie.datos.map((s) => s.menciones)} />
              </div>
            </div>
            <div className="kpi">
              <span className="kl">Participación</span>
              <span className="kv">{pct(propia.participacion)}</span>
              <span className="mu">
                {conCorte
                  ? <>{lugar === 1 ? 'Primer lugar.' : lugar ? `Lugar ${lugar}.` : ''}{rival ? ` ${rival.nombre} tiene ${pct(rival.participacion)}` : ''}</>
                  : 'Todavía sin menciones medidas'}
              </span>
            </div>
            <div className="kpi">
              <span className="kl">Sentimiento neto</span>
              <span className={'kv' + (propia.neto == null ? '' : propia.neto >= 0 ? ' tf' : ' tu')}>{neto(propia.neto)}</span>
              <span className="mu">{propia.favorable != null ? `${propia.favorable}% favorable menos ${propia.desfavorable}% desfavorable` : 'Sin desglose todavía'}</span>
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
            {puedeEditar
              ? <><Link to={`${base}/figuras/nueva`}>Agregar una figura</Link> con relación Propia para ver sus cifras aquí.</>
              : 'Cuando el equipo defina la figura propia, sus cifras aparecerán aquí.'}
          </Vacio>
        )}

        <div className="row">
          <section className="card c3">
            <div className="ch">
              <h2>Participación en la conversación</h2>
              <Link className="lk" to={`${base}/figuras`}>Ver figuras</Link>
            </div>
            {figuras.datos.length ? (
              <div className="bars">
                {figuras.datos.map((f) => (
                  <div className="br" key={f.id}>
                    <div style={{ flex: '0 0 176px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                      <Link className="tl sm" to={`${base}/figuras/${f.figura_id}`}>{f.nombre}</Link>
                      <span className="mu">{f.relacion}{f.neto != null ? ` · neto ${neto(f.neto)}` : ''}</span>
                    </div>
                    <div className="bar"><i style={{ width: `${(((f.participacion ?? 0) / maxPart) * 100).toFixed(1)}%`, background: REL[f.relacion].color }} /></div>
                    <div className={f.participacion != null ? 'sm b r' : 'sm mu r'} style={{ flex: '0 0 48px' }} title={f.participacion != null ? undefined : 'Sin datos todavía'}>{f.participacion != null ? pct(f.participacion) : '–'}</div>
                  </div>
                ))}
              </div>
            ) : <p className="mu">Sin figuras en seguimiento.</p>}
            <div className="well" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', fontSize: 13, lineHeight: '18px', color: '#454E48' }}>
              {(Object.keys(REL) as Array<keyof typeof REL>).map((r) => (
                <span key={r} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span className="d" style={{ background: REL[r].color }} />{r}</span>
              ))}
            </div>
          </section>

          <div className="col c2">
            <section className="card">
              <div className="ch"><h2>Alertas abiertas · {alertas.datos.length}</h2><Link className="lk" to={`${base}/alertas`}>Ver alertas</Link></div>
              {alertas.datos.length ? (
                <div className="list">
                  {alertas.datos.map((a) => (
                    <div className="li" key={a.id} style={{ alignItems: 'flex-start' }}>
                      <span className={SEVERIDAD[a.severidad]} style={{ flex: '0 0 54px', justifyContent: 'center' }}>{a.severidad}</span>
                      <Link className="sm tl" style={{ fontWeight: 400 }} to={`${base}/alertas?alerta=${encodeURIComponent(a.id)}`}>{a.texto}</Link>
                    </div>
                  ))}
                </div>
              ) : <p className="mu">Nada que atender por ahora.</p>}
            </section>
            <section className="card" style={{ gap: 6 }}>
              {proximo ? (
                <>
                  <span className="kl">Próximo evento{enDias != null ? (enDias === 0 ? ' · hoy' : ` · en ${enDias} ${enDias === 1 ? 'día' : 'días'}`) : ''}</span>
                  <h2>{proximo.nombre}</h2>
                  <span className="sm">{fecha(proximo.fecha_inicio, 'dia').replace(/^./, (c) => c.toUpperCase())}{proximo.sede ? ` · ${[proximo.sede, proximo.ciudad].filter(Boolean).join(', ')}` : ''}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingTop: 6 }}>
                    <span className={proximo.estado === 'Programado' ? 'chip ring' : 'chip watch'}>{proximo.estado}</span>
                    <span className="mu">{proximo.tipo} · {proximo.origen.toLowerCase()}</span>
                    <Link className="lk sp" to={`${base}/eventos`}>Ver eventos</Link>
                  </div>
                </>
              ) : (
                <>
                  <span className="kl">Próximo evento</span>
                  <h2>{borrador ? 'Sin eventos programados' : 'Sin eventos por venir'}</h2>
                  {borrador ? <span className="sm">Hay un borrador por completar: <Link className="tl" to={`${base}/eventos/${borrador.id}`}>{borrador.nombre}</Link></span> : null}
                  <div style={{ paddingTop: 6 }}>{puedeEditar ? <Link className="lk" to={`${base}/eventos/nuevo`}>Crear evento</Link> : <Link className="lk" to={`${base}/eventos`}>Ver eventos</Link>}</div>
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
                      <div className="gr"><span className="b">{n.nombre}</span><span className="mu">{n.tendencia}</span></div>
                      <span className="b">{num(n.menciones)}</span>
                      <span className={d.cls} style={{ flex: '0 0 84px', justifyContent: 'center' }}>{d.texto}</span>
                    </div>
                  );
                })}
              </div>
            ) : <p className="mu">Todavía no hay narrativas detectadas.</p>}
          </section>
        </div>
      </main>
    </Carga>
  );
}
