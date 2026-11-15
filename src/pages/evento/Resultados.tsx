// Pestaña Resultados: balance, cifras de la ventana, fases, quién ganó, mensajes, cobertura, rivales, hashtags y publicaciones.
// Cada bloque aparece solo si su dato existe. Si no hay medición todavía, se dice cuándo empieza.
import { Link } from 'react-router-dom';
import { useTabla } from '../../lib/hooks';
import { ALERTAS_ABIERTAS, type Alerta, type Evento, type EventoMensaje, type EventoParticipante, type FiguraCampana, type Mencion, type Narrativa } from '../../lib/tipos';
import { REL, SEVERIDAD, compacto, cuando, diaEn, diasEntre, fecha, horaEn, iniciales, neto, num, pct } from '../../lib/formato';
import { useCampana } from '../../shell/Campana';
import { Vacio } from '../../shell/Estados';
import { Aprendizajes, Balance, NotasEquipo } from './Notas';
import { COLOR_LADO, COLOR_REL, ESTADO_MENSAJE, delTipo, diaDe, resultadosDe } from './util';

function ancho(v: number, max: number) {
  return `${(max > 0 ? Math.min(100, (v / max) * 100) : 0).toFixed(1)}%`;
}
function mas(n: number, s: string, p: string) { return `${num(n)} ${n === 1 ? s : p}`; }

export function Resultados({ evento, participantes, mensajes, figuras, narrativas, puedeEditar, hoy }: {
  evento: Evento; participantes: EventoParticipante[]; mensajes: EventoMensaje[]; figuras: FiguraCampana[]; narrativas: Narrativa[]; puedeEditar: boolean; hoy: string;
}) {
  const campana = useCampana();
  const base = `/c/${campana.id}`;
  const zona = campana.zona_horaria;
  const r = resultadosDe(evento);
  const porFigura = new Map(figuras.map((f) => [f.figura_id, f]));
  const narr = new Map(narrativas.map((n) => [n.id, n]));

  const alertas = useTabla<Alerta>('alertas', { eq: { campana_id: campana.id, evento_id: evento.id }, orden: [['detectada_en', 'desc']] });
  const menciones = useTabla<Mencion>('menciones', { eq: { campana_id: campana.id, evento_id: evento.id }, neq: { estado: 'Descartada' }, orden: [['publicada_en', 'desc']], limite: 5 });
  const proximos = useTabla<Evento>('eventos', { eq: { campana_id: campana.id, tipo: evento.tipo, estado: ['Programado', 'Borrador'] }, desde: { fecha_inicio: hoy }, orden: 'fecha_inicio', limite: 1 });
  const proximo = proximos.datos.find((e) => e.id !== evento.id) ?? null;

  const ventana = evento.ventana_horas;
  const enCurso = evento.estado === 'En curso';
  const propiaId = campana.figura_propia_id;
  const propia = propiaId ? porFigura.get(propiaId) ?? null : null;

  // ---------- sin medición todavía ----------
  const sinCifras = evento.menciones == null && evento.alcance == null && evento.neto == null && evento.notas_medios == null && evento.menciones_antes == null;
  if (sinCifras && !evento.veredicto && !participantes.some((p) => p.menciones != null)) {
    let titulo = 'Todavía no hay resultados';
    let texto: string;
    if (evento.estado === 'Cancelado') { titulo = 'Evento cancelado'; texto = 'Un evento cancelado no se mide.'; }
    else if (evento.estado === 'Borrador' || evento.estado === 'Programado') {
      const desde = evento.fecha_inicio ? new Date(new Date(`${evento.fecha_inicio}T00:00:00`).getTime() - ventana * 3600_000) : null;
      const falta = desde ? diasEntre(hoy, desde) : null;
      texto = desde
        ? `La medición empieza ${ventana} horas antes del evento, el ${fecha(desde, 'dia')}${falta != null && falta > 0 ? ` (en ${falta} ${falta === 1 ? 'día' : 'días'})` : ''}, y sigue ${ventana} horas después.`
        : `La medición empieza ${ventana} horas antes del evento. Falta definir la fecha.`;
      if (evento.estado === 'Borrador') texto += ' Un borrador no se mide hasta que se programe.';
    } else {
      texto = 'La ventana del evento todavía no se ha procesado. Las cifras aparecen aquí en cuanto lleguen las menciones.';
    }
    return (
      <div className="col fade" style={{ gap: 20 }}>
        <Vacio titulo={titulo}>{texto}{mensajes.length === 0 && evento.estado !== 'Cancelado' ? <> Mientras tanto, define los <Link to="?tab=ficha">mensajes clave</Link> y los <Link to="?tab=participantes">participantes</Link>.</> : null}</Vacio>
        <Relacionado alertas={alertas.datos} menciones={menciones.datos} base={base} hoy={hoy} zona={zona} />
        {evento.estado !== 'Cancelado' ? <NotasEquipo evento={evento} puedeEditar={puedeEditar} /> : null}
      </div>
    );
  }

  // ---------- KPIs ----------
  const dif = evento.neto != null && evento.neto_antes != null ? evento.neto - evento.neto_antes : null;
  const kpis: Array<{ l: string; v: string; s: string; cls?: string }> = [];
  if (evento.menciones != null) kpis.push({ l: 'Menciones', v: num(evento.menciones), s: enCurso ? 'Hasta hoy, cifra parcial' : 'En la ventana de medición' });
  if (evento.alcance != null) kpis.push({ l: 'Alcance', v: compacto(evento.alcance), s: 'Cuentas únicas estimadas' });
  if (evento.neto != null) kpis.push({
    l: propia ? `Sentimiento neto de ${propia.nombre}` : 'Sentimiento neto', v: neto(evento.neto), cls: evento.neto >= 0 ? 'tf' : 'tu',
    s: dif == null ? 'Sin medición previa para comparar' : dif === 0 ? `Igual que antes ${delTipo(evento.tipo)}` : `${Math.abs(dif)} ${Math.abs(dif) === 1 ? 'punto' : 'puntos'} ${dif > 0 ? 'más' : 'menos'} que antes ${delTipo(evento.tipo)}`,
  });
  if (evento.notas_medios != null) kpis.push({ l: 'Notas en medios', v: num(evento.notas_medios), s: 'Prensa digital, radio y TV' });
  if (evento.asistencia != null) kpis.push({ l: 'Asistencia', v: num(evento.asistencia), s: 'Personas registradas' });

  // ---------- antes / durante / después ----------
  const dia = enCurso ? diaDe(evento, hoy) : null;
  const fases = ([
    ['Antes', `${ventana} horas previas`, evento.menciones_antes, '#B5BCB6'],
    ['Durante', enCurso ? (dia ? `Hasta hoy, día ${dia.dia} de ${dia.dias}` : 'Hasta hoy') : evento.tipo === 'Debate' ? 'Transmisión del debate' : `Mientras duró ${delTipo(evento.tipo).replace(/^del /, 'el ').replace(/^de la /, 'la ')}`, evento.menciones_durante, '#285A32'],
    ['Después', `${ventana} horas posteriores`, evento.menciones_despues, '#454E48'],
  ] as const).filter((f) => f[2] != null) as unknown as Array<[string, string, number, string]>;
  const maxFase = Math.max(0, ...fases.map((f) => f[2]));
  const pico = r.pico?.por_minuto != null && r.pico.en ? r.pico : null;
  const picoDia = pico ? diaEn(pico.en, zona) : null;

  // ---------- quién ganó ----------
  const medidos = participantes.filter((p) => p.menciones != null).sort((a, b) => (b.participacion ?? 0) - (a.participacion ?? 0));
  const ganadores = medidos.map((p) => {
    const f = porFigura.get(p.figura_id);
    return { id: p.figura_id, nombre: f?.nombre ?? p.figura_id, part: p.participacion, men: p.menciones, neto: p.neto, color: f ? COLOR_REL[f.relacion] : '#8A928C', fav: p.favorable, neu: p.neutral, des: p.desfavorable };
  });
  const maxGan = Math.max(0, ...ganadores.map((g) => g.part ?? 0), r.otros?.participacion ?? 0);
  const desglose = ganadores.filter((g) => g.fav != null).map((g) => `${g.nombre} ${g.fav} / ${g.neu ?? 0} / ${g.des ?? 0}`);

  // ---------- mensajes ----------
  const protagonista = participantes.find((p) => p.figura_id === propiaId && p.menciones != null) ?? null;
  const filasMsj = mensajes.filter((m) => m.menciones != null || m.porcentaje != null || m.estado);
  const sinMsj = r.sin_mensaje?.menciones != null || r.sin_mensaje?.porcentaje != null ? r.sin_mensaje : null;
  const maxMsj = Math.max(0, ...filasMsj.map((m) => m.porcentaje ?? 0), sinMsj?.porcentaje ?? 0);
  const pendientesMsj = mensajes.filter((m) => !filasMsj.includes(m));

  // ---------- cobertura, rivales, hashtags, publicaciones ----------
  const cob = r.cobertura ?? null;
  const cobTotal = cob ? (cob.digitales ?? 0) + (cob.radio ?? 0) + (cob.television ?? 0) : 0;
  const reacciones = r.reacciones ?? [];
  const hashtags = (r.hashtags ?? []).filter((h) => h.menciones != null);
  const maxHash = Math.max(0, ...hashtags.map((h) => h.menciones ?? 0));
  const publicaciones = r.publicaciones ?? [];

  const hayDesglose = fases.length || ganadores.length || filasMsj.length || cob || reacciones.length || hashtags.length || publicaciones.length;

  return (
    <div className="col fade" style={{ gap: 20 }}>
      {enCurso || evento.estado === 'En análisis' ? (
        <div className="well sm">{enCurso ? 'El evento sigue en curso: las cifras son parciales y cambian con cada corte.' : 'Resultados preliminares: el análisis del equipo sigue abierto.'}</div>
      ) : null}

      <Balance evento={evento} puedeEditar={puedeEditar} />

      {kpis.length ? (
        <section className="kpis" aria-label="Cifras del evento">
          {kpis.map((k) => (
            <div className="kpi" key={k.l}>
              <span className="kl">{k.l}</span>
              <span className={'kv' + (k.cls ? ' ' + k.cls : '')}>{k.v}</span>
              <span className="mu">{k.s}</span>
            </div>
          ))}
        </section>
      ) : null}

      {fases.length || ganadores.length ? (
        <div className="row">
          {fases.length ? (
            <section className="card c1">
              <h2>Antes, durante y después</h2>
              <div className="bars">
                {fases.map(([n, w, c, color]) => (
                  <div className="br" key={n}>
                    <div className="ev-et"><span className="sm b">{n}</span><span className="mu">{w}</span></div>
                    <div className="bar" style={{ height: 12 }}><i style={{ width: ancho(c, maxFase), background: color }} /></div>
                    <div className="sm b r" style={{ flex: '0 0 52px' }}>{num(c)}</div>
                  </div>
                ))}
              </div>
              {enCurso && evento.menciones_despues == null ? <p className="mu">El después se mide al terminar el evento.</p> : null}
              {pico ? (
                <p className="mu well">
                  Pico de {num(pico.por_minuto)} menciones por minuto {picoDia && picoDia !== evento.fecha_inicio ? `el ${fecha(picoDia, 'corto')} ` : ''}a las {horaEn(pico.en, zona)}{pico.contexto ? `, ${pico.contexto}` : ''}.
                </p>
              ) : null}
            </section>
          ) : null}

          {ganadores.length ? (
            <section className="card c1">
              <h2>{enCurso ? 'Quién lleva la conversación' : 'Quién ganó la conversación'}</h2>
              <div className="bars">
                {ganadores.map((g) => (
                  <div className="br" key={g.id}>
                    <div className="ev-et">
                      <Link className="tl sm" to={`${base}/figuras/${g.id}`}>{g.nombre}</Link>
                      {g.neto != null ? <span className={g.neto >= 0 ? 'sm tf' : 'sm tu'}>Neto {neto(g.neto)}</span> : <span className="mu">Sin sentimiento</span>}
                    </div>
                    <div className="bar" style={{ height: 12 }}><i style={{ width: ancho(g.part ?? 0, maxGan), background: g.color }} /></div>
                    <div className="sm r" style={{ flex: '0 0 92px' }}><span className="b">{pct(g.part, 0)}</span> · {num(g.men)}</div>
                  </div>
                ))}
                {r.otros?.menciones != null ? (
                  <div className="br">
                    <div className="ev-et"><span className="sm b">Otros</span><span className="mu">Sin figura asignada</span></div>
                    <div className="bar" style={{ height: 12 }}><i style={{ width: ancho(r.otros.participacion ?? 0, maxGan), background: '#B5BCB6' }} /></div>
                    <div className="sm r" style={{ flex: '0 0 92px' }}><span className="b">{pct(r.otros.participacion, 0)}</span> · {num(r.otros.menciones)}</div>
                  </div>
                ) : null}
              </div>
              {desglose.length ? <p className="mu well">Favorable / neutral / desfavorable: {desglose.join(' · ')}.</p> : null}
            </section>
          ) : null}
        </div>
      ) : null}

      {filasMsj.length || sinMsj ? (
        <div className="tw"><div>
          <table style={{ minWidth: 700 }}>
            <thead>
              <tr>
                <th scope="col">Mensaje clave</th>
                <th scope="col" style={{ width: '36%' }}>{protagonista && propia ? `Parte de las ${num(protagonista.menciones)} menciones de ${propia.nombre}` : 'Parte de las menciones'}</th>
                <th scope="col" className="r">Menciones</th>
                <th scope="col">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {filasMsj.map((m) => (
                <tr key={m.id}>
                  <td className="b">{m.texto}</td>
                  <td><div className="br"><div className="bar"><i style={{ width: ancho(m.porcentaje ?? 0, maxMsj) }} /></div><span className="b" style={{ flex: '0 0 36px', textAlign: 'right' }}>{pct(m.porcentaje, 0)}</span></div></td>
                  <td className="r">{num(m.menciones)}</td>
                  <td>{m.estado ? <span className={ESTADO_MENSAJE[m.estado] ?? 'chip watch'}>{m.estado}</span> : <span className="mu">Sin evaluar</span>}</td>
                </tr>
              ))}
              {sinMsj ? (
                <tr>
                  <td className="b">Menciones sin mensaje clave</td>
                  <td><div className="br"><div className="bar"><i style={{ width: ancho(sinMsj.porcentaje ?? 0, maxMsj) }} /></div><span className="b" style={{ flex: '0 0 36px', textAlign: 'right' }}>{pct(sinMsj.porcentaje ?? null, 0)}</span></div></td>
                  <td className="r">{num(sinMsj.menciones ?? null)}</td>
                  <td><span className="chip watch">Sin mensaje</span></td>
                </tr>
              ) : null}
              {pendientesMsj.map((m) => (
                <tr key={m.id}>
                  <td className="b">{m.texto}</td>
                  <td colSpan={2}><span className="mu">Sin medir todavía</span></td>
                  <td><span className="mu">Pendiente</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      ) : null}

      {cob || reacciones.length ? (
        <div className="row">
          {cob ? (
            <section className="card c1">
              <div className="ch"><h2>Cobertura en medios</h2><span className="mu">{mas(evento.notas_medios ?? cobTotal, 'nota', 'notas')}</span></div>
              {cobTotal ? (
                <div className="stack" role="img" aria-label={`${cob.digitales ?? 0} notas digitales, ${cob.radio ?? 0} de radio, ${cob.television ?? 0} de televisión`}>
                  <i style={{ width: ancho(cob.digitales ?? 0, cobTotal), background: '#454E48' }} />
                  <i style={{ width: ancho(cob.radio ?? 0, cobTotal), background: '#8A928C' }} />
                  <i style={{ width: ancho(cob.television ?? 0, cobTotal), background: '#C5CAC4' }} />
                </div>
              ) : null}
              <div className="ev-cifras">
                <div><span className="kv s">{num(cob.digitales ?? 0)}</span><span className="mu">Medios digitales</span></div>
                <div><span className="kv s">{num(cob.radio ?? 0)}</span><span className="mu">Radio</span></div>
                <div><span className="kv s">{num(cob.television ?? 0)}</span><span className="mu">Televisión</span></div>
              </div>
              {cob.favorables != null ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <span className="chip fav">{mas(cob.favorables, 'favorable', 'favorables')}</span>
                  <span className="chip watch">{mas(cob.neutrales ?? 0, 'neutral', 'neutrales')}</span>
                  <span className="chip unf">{mas(cob.desfavorables ?? 0, 'desfavorable', 'desfavorables')}</span>
                </div>
              ) : null}
            </section>
          ) : null}
          {reacciones.length ? (
            <section className="card c1">
              <h2>Reacciones de rivales</h2>
              <div className="list">
                {reacciones.map((x) => {
                  const f = porFigura.get(x.figura_id);
                  const n = x.narrativa_id ? narr.get(x.narrativa_id) : null;
                  const nombre = f?.nombre ?? x.figura_id;
                  return (
                    <div className="li" key={x.figura_id}>
                      <span className={`ini ${f ? REL[f.relacion].cls : 'watch'}`} aria-hidden="true">{f?.iniciales ?? iniciales(nombre)}</span>
                      <div className="gr">
                        <span className="b">{nombre}{x.publicaciones != null ? ` · ${mas(x.publicaciones, 'publicación', 'publicaciones')}` : ''}</span>
                        <span className="mu">{n ? `Contra-narrativa "${n.nombre}"${x.menciones != null ? `: ${num(x.menciones)} menciones en la ventana.` : '.'}` : 'Sin contra-narrativa detectada.'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {hashtags.length || publicaciones.length ? (
        <div className="row">
          {hashtags.length ? (
            <section className="card c1">
              <h2>Hashtags</h2>
              <div className="bars">
                {hashtags.map((h) => (
                  <div className="br" key={h.hashtag}>
                    <div className="sm ev-hash">{h.hashtag}</div>
                    <div className="bar"><i style={{ width: ancho(h.menciones ?? 0, maxHash), background: COLOR_LADO[(h.lado ?? 'neutral').toLowerCase()] ?? COLOR_LADO.neutral }} /></div>
                    <div className="sm b r" style={{ flex: '0 0 52px' }}>{num(h.menciones)}</div>
                  </div>
                ))}
              </div>
              {hashtags.filter((h) => h.nota).map((h) => <p className="mu" key={h.hashtag}>{h.hashtag}: {h.nota}.</p>)}
              <div className="ev-ley">
                <span><span className="d" style={{ background: COLOR_LADO.propio }} />Propio</span>
                <span><span className="d" style={{ background: COLOR_LADO.rival }} />Rival</span>
                <span><span className="d" style={{ background: COLOR_LADO.neutral }} />Neutral</span>
              </div>
            </section>
          ) : null}
          {publicaciones.length ? (
            <section className="card c1">
              <h2>Publicaciones destacadas</h2>
              <div className="list">
                {publicaciones.map((p, i) => (
                  <div className="li" key={i}>
                    <div className="gr"><span className="b">{p.titulo}</span><span className="mu">{[p.canal, p.origen ? (p.origen === 'Propia' ? 'publicación propia' : p.origen.toLowerCase()) : null].filter(Boolean).join(' · ')}</span></div>
                    {p.valor != null ? <span className="sm b" style={{ whiteSpace: 'nowrap' }}>{p.valor >= 100_000 ? compacto(p.valor) : num(p.valor)}{p.metrica ? ` ${p.metrica}` : ''}</span> : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {!hayDesglose ? (
        <p className="mu note">El desglose por fase, participantes, mensajes y medios aparece cuando se procese la ventana de medición del evento.</p>
      ) : null}

      <Relacionado alertas={alertas.datos} menciones={menciones.datos} base={base} hoy={hoy} zona={zona} />

      <Aprendizajes evento={evento} puedeEditar={puedeEditar} proximo={proximo ? `el ${proximo.nombre.charAt(0).toLowerCase()}${proximo.nombre.slice(1)}` : null} />
      <NotasEquipo evento={evento} puedeEditar={puedeEditar} />
    </div>
  );
}

/** Alertas y menciones enlazadas al evento (alertas.evento_id, menciones.evento_id). */
function Relacionado({ alertas, menciones, base, hoy, zona }: { alertas: Alerta[]; menciones: Mencion[]; base: string; hoy: string; zona: string }) {
  if (!alertas.length && !menciones.length) return null;
  const abiertas = alertas.filter((a) => ALERTAS_ABIERTAS.includes(a.estado));
  return (
    <div className="row">
      {alertas.length ? (
        <section className="card c1">
          <div className="ch"><h2>Alertas del evento</h2><Link className="lk" to={`${base}/alertas`}>Ver alertas</Link></div>
          <div className="list">
            {alertas.map((a) => (
              <div className="li" key={a.id} style={{ alignItems: 'flex-start' }}>
                <span className={SEVERIDAD[a.severidad]} style={{ flex: '0 0 54px', justifyContent: 'center' }}>{a.severidad}</span>
                <div className="gr"><span className="sm">{a.texto}</span><span className="mu">{a.estado} · {cuando(a.detectada_en, hoy, zona)}</span></div>
              </div>
            ))}
          </div>
          {abiertas.length ? null : <span className="mu">Ninguna sigue abierta.</span>}
        </section>
      ) : null}
      {menciones.length ? (
        <section className="card c1">
          <div className="ch"><h2>Menciones del evento</h2><Link className="lk" to={`${base}/menciones`}>Ver menciones</Link></div>
          <div className="list">
            {menciones.map((m) => (
              <div className="li" key={m.id} style={{ alignItems: 'flex-start' }}>
                <div className="gr">
                  <span className="sm b">{m.titulo ?? m.resumen ?? 'Mención sin título'}</span>
                  <span className="mu">{[m.canal, m.fuente, cuando(m.publicada_en, hoy, zona)].filter(Boolean).join(' · ')}</span>
                </div>
                {m.alcance != null ? <span className="sm" style={{ whiteSpace: 'nowrap' }}>{compacto(m.alcance)}</span> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
