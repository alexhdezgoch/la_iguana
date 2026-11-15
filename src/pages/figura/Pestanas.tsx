// Contenido de cada pestaña de la ficha. Reciben los datos ya leídos por Figura.tsx: aquí no se consulta nada.
import { Link } from 'react-router-dom';
import { ESTADO_EVENTO, compacto, cuando, fecha, num, pct, neto } from '../../lib/formato';
import type { FiguraCampana, Mencion, MencionFigura, Narrativa, SerieDiaria, Tema, TemaFigura } from '../../lib/tipos';
import { DIRECCION, SENTIMIENTO, SerieDia, cargoDe, fechaCorta, type EventoFigura } from './comun';
import { urlSegura } from '../../lib/url';

const COLOR_SENT = { fav: '#3A76C4', neu: '#C5CAC4', unf: '#D07A2D' };

export function Sentimiento({ f }: { f: FiguraCampana }) {
  const total = f.menciones ?? 0;
  const tiene = f.favorable != null && f.neutral != null && f.desfavorable != null;
  const partes = tiene ? [
    { k: 'Favorable', v: f.favorable!, c: COLOR_SENT.fav, cls: 'kv s tf' },
    { k: 'Neutral', v: f.neutral!, c: COLOR_SENT.neu, cls: 'kv s' },
    { k: 'Desfavorable', v: f.desfavorable!, c: COLOR_SENT.unf, cls: 'kv s tu' },
  ] : [];
  return (
    <section className="card c1">
      <div className="ch"><h2>Sentimiento</h2><span className="mu">{num(total)} menciones</span></div>
      {tiene ? (
        <>
          <div className="stack" role="img" aria-label={partes.map((p) => `${p.v}% ${p.k.toLowerCase()}`).join(', ')}>
            {partes.map((p) => <i key={p.k} style={{ width: `${p.v}%`, background: p.c }} />)}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 28px' }}>
            {partes.map((p) => (
              <div key={p.k} style={{ display: 'flex', flexDirection: 'column' }}>
                <span className={p.cls}>{p.v}%</span>
                <span className="mu">{p.k} · {num((total * p.v) / 100)}</span>
              </div>
            ))}
          </div>
        </>
      ) : <p className="mu">Todavía no hay desglose de sentimiento para esta figura en el periodo.</p>}
      <p className="mu well">Favorable y desfavorable se miden respecto a la figura, con el mismo método para propias y rivales.</p>
    </section>
  );
}

export function ListaNarrativas({ narrativas, max, verTodas }: { narrativas: Narrativa[]; max?: number; verTodas?: () => void }) {
  const lista = max ? narrativas.slice(0, max) : narrativas;
  return (
    <section className="card c1">
      <div className="ch">
        <h2>Narrativas{narrativas.length && !max ? ` · ${narrativas.length}` : ''}</h2>
        {verTodas && max && narrativas.length > max ? <button type="button" className="enlace-btn" onClick={verTodas}>Ver las {narrativas.length}</button> : null}
      </div>
      {lista.length ? (
        <div className="list">
          {lista.map((n) => {
            const d = DIRECCION[n.direccion] ?? DIRECCION['Sin dirección'];
            return (
              <div className="li" key={n.id}>
                <div className="gr"><span className="b">{n.nombre}</span><span className="mu">{n.tendencia ?? 'Sin tendencia'}</span></div>
                <span className="b">{num(n.menciones)}</span>
                <span className={d.cls} style={{ flex: '0 0 84px', justifyContent: 'center' }}>{d.texto}</span>
              </div>
            );
          })}
        </div>
      ) : <p className="mu">Todavía no hay narrativas detectadas sobre esta figura.</p>}
    </section>
  );
}

export function Cobertura({ f }: { f: FiguraCampana }) {
  const c = f.detalle?.cobertura as { favorables?: number; neutrales?: number; desfavorables?: number; por_medio?: Array<{ medio: string; notas: number }> } | undefined;
  const medios = Array.isArray(c?.por_medio) ? [...c!.por_medio].sort((a, b) => b.notas - a.notas) : [];
  const max = Math.max(1, ...medios.map((m) => m.notas));
  return (
    <section className="card c1">
      <div className="ch"><h2>Cobertura en medios</h2>{f.notas_medios != null ? <span className="mu">{num(f.notas_medios)} notas</span> : null}</div>
      {c && (c.favorables != null || medios.length) ? (
        <>
          {c.favorables != null ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <span className="chip fav">{num(c.favorables)} favorables</span>
              <span className="chip watch">{num(c.neutrales ?? 0)} neutrales</span>
              <span className="chip unf">{num(c.desfavorables ?? 0)} desfavorables</span>
            </div>
          ) : null}
          {medios.length ? (
            <div className="bars">
              {medios.map((m) => (
                <div className="br" key={m.medio}>
                  <div className="sm fg-medio">{m.medio}</div>
                  <div className="bar"><i style={{ width: `${((m.notas / max) * 100).toFixed(1)}%` }} /></div>
                  <div className="sm b r" style={{ flex: '0 0 36px' }}>{num(m.notas)}</div>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : <p className="mu">Sin notas de prensa, radio o TV contadas para esta figura en el periodo.</p>}
      <p className="mu">Las notas se cuentan. No se les asigna valor en dinero.</p>
    </section>
  );
}

export function ListaEventos({ eventos, nombre, base, max }: { eventos: EventoFigura[]; nombre: string; base: string; max?: number }) {
  const lista = max ? eventos.slice(0, max) : eventos;
  return (
    <section className="card c1">
      <div className="ch"><h2>{max ? 'Eventos recientes' : `Eventos · ${eventos.length}`}</h2><Link className="lk" to={`${base}/eventos`}>Ver eventos</Link></div>
      {lista.length ? (
        <>
          <div className="list">
            {lista.map(({ evento: e, neto: n, rol }) => (
              <div className="li" key={e.id}>
                <div className="gr">
                  <Link className="tl" to={`${base}/eventos/${e.id}`}>{e.nombre}</Link>
                  <span className="mu">{[e.tipo, fechaCorta(e.fecha_inicio, e.fecha_fin), max ? e.estado : null, rol].filter(Boolean).join(' · ')}</span>
                </div>
                {!max ? <span className={ESTADO_EVENTO[e.estado] ?? 'chip watch'}>{e.estado}</span> : null}
                <span className={n == null ? 'mu' : n >= 0 ? 'b tf' : 'b tu'} style={{ fontSize: n == null ? undefined : 17, flex: 'none' }}>{neto(n)}</span>
              </div>
            ))}
          </div>
          <p className="mu">La cifra es el sentimiento neto de {nombre} en la ventana de cada evento.</p>
        </>
      ) : <p className="mu">Sin eventos registrados con esta figura hasta hoy.</p>}
    </section>
  );
}

export function Conversacion({ f, serie }: { f: FiguraCampana; serie: SerieDiaria[] }) {
  const canales = (Array.isArray(f.detalle?.canales) ? f.detalle.canales : []) as Array<{ canal: string; menciones: number }>;
  const totalCanal = canales.reduce((s, c) => s + (c.menciones ?? 0), 0);
  const maxCanal = Math.max(1, ...canales.map((c) => c.menciones ?? 0));
  return (
    <div className="col fade" style={{ gap: 20 }}>
      <section className="card">
        <div className="ch"><h2>Menciones por día</h2>{serie.length ? <span className="mu">{num(serie.reduce((s, p) => s + p.menciones, 0))} en {serie.length} días</span> : null}</div>
        {serie.length > 1 ? <SerieDia puntos={serie.map((s) => ({ fecha: s.fecha, menciones: s.menciones }))} />
          : <p className="mu">Sin serie diaria para esta figura en el periodo. El total de {num(f.menciones)} menciones viene del corte de 30 días.</p>}
      </section>
      <div className="row">
        <section className="card c1">
          <div className="ch"><h2>Por canal</h2>{totalCanal ? <span className="mu">{num(totalCanal)} menciones</span> : null}</div>
          {canales.length ? (
            <div className="bars">
              {canales.map((c) => (
                <div className="br" key={c.canal}>
                  <div className="sm fg-medio">{c.canal}</div>
                  <div className="bar"><i style={{ width: `${(((c.menciones ?? 0) / maxCanal) * 100).toFixed(1)}%` }} /></div>
                  <div className="sm r" style={{ flex: '0 0 112px' }}><span className="b">{pct(totalCanal ? ((c.menciones ?? 0) / totalCanal) * 100 : null, 0)}</span> · {num(c.menciones)}</div>
                </div>
              ))}
            </div>
          ) : <p className="mu">Sin desglose por canal para esta figura en el periodo.</p>}
        </section>
        <Sentimiento f={f} />
      </div>
    </div>
  );
}

export function TemasNarrativas({ temaFiguras, temas, narrativas, base }: { temaFiguras: TemaFigura[]; temas: Tema[]; narrativas: Narrativa[]; base: string }) {
  const filas = temaFiguras
    .map((tf) => ({ tf, tema: temas.find((t) => t.id === tf.tema_id) }))
    .sort((a, b) => (a.tema?.orden ?? 999) - (b.tema?.orden ?? 999));
  const conNeto = filas.some((x) => x.tf.neto != null);
  const max = Math.max(1, ...filas.map((x) => x.tf.porcentaje_propias ?? 0));
  return (
    <div className="col fade" style={{ gap: 20 }}>
      <section className="card">
        <div className="ch"><h2>Temas de la figura</h2><Link className="lk" to={`${base}/temas`}>Ver temas y narrativas</Link></div>
        {filas.length ? (
          <div className="tw fg-plano"><div>
            <table style={{ minWidth: 560 }}>
              <thead>
                <tr>
                  <th scope="col">Tema</th>
                  <th scope="col" style={{ width: '34%' }}>De sus publicaciones</th>
                  <th scope="col" className="r">Del tema</th>
                  <th scope="col" className="r">Menciones</th>
                  {conNeto ? <th scope="col" className="r">Neto</th> : null}
                </tr>
              </thead>
              <tbody>
                {filas.map(({ tf, tema }) => (
                  <tr key={tf.id}>
                    <td className="b">{tema?.nombre ?? 'Tema'}</td>
                    <td><div className="br"><div className="bar"><i style={{ width: `${(((tf.porcentaje_propias ?? 0) / max) * 100).toFixed(1)}%` }} /></div><span className="b" style={{ flex: '0 0 44px', textAlign: 'right' }}>{pct(tf.porcentaje_propias, 0)}</span></div></td>
                    <td className="r">{pct(tf.porcentaje, 0)}</td>
                    <td className="r">{num(tf.menciones)}</td>
                    {conNeto ? <td className="r"><span className={tf.neto == null ? 'mu' : tf.neto >= 0 ? 'b tf' : 'b tu'}>{neto(tf.neto)}</span></td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div></div>
        ) : <p className="mu">Los temas aparecen cuando hay menciones de esta figura clasificadas por tema.</p>}
        {filas.length ? <p className="mu">“De sus publicaciones”: qué parte de lo que publica la figura toca cada tema. “Del tema”: qué parte de la conversación del tema la menciona.</p> : null}
      </section>
      <div className="row"><ListaNarrativas narrativas={narrativas} /></div>
    </div>
  );
}

export function Publicaciones({ menciones, enlaces, figuraId, hoy, zona, base }: { menciones: Mencion[]; enlaces: MencionFigura[]; figuraId: string; hoy: string; zona: string; base: string }) {
  return (
    <section className="card fade">
      <div className="ch"><h2>Menciones recientes{menciones.length ? ` · ${menciones.length}` : ''}</h2><Link className="lk" to={`${base}/menciones`}>Ver menciones</Link></div>
      {menciones.length ? (
        <div className="list">
          {menciones.map((m) => {
            const e = enlaces.find((x) => x.mencion_id === m.id && x.figura_id === figuraId);
            const s = e?.sentimiento_manual ?? e?.sentimiento ?? (m.figura_id === figuraId ? m.sentimiento_manual ?? m.sentimiento : null);
            return (
              <div className="li fg-mencion" key={m.id}>
                <div className="gr">
                  <span className="mu">{[m.canal, m.fuente, cuando(m.publicada_en, hoy, zona)].filter(Boolean).join(' · ')}</span>
                  {urlSegura(m.url) ? <a className="tl" href={urlSegura(m.url)!} target="_blank" rel="noopener noreferrer">{m.titulo ?? m.resumen ?? 'Publicación'}</a> : <span className="b">{m.titulo ?? m.resumen ?? 'Publicación'}</span>}
                  {m.titulo && m.resumen ? <span className="sm fg-gris">{m.resumen}</span> : null}
                </div>
                <div className="fg-lado">
                  {s ? <span className={SENTIMIENTO[s]}>{s}</span> : <span className="chip ring">Sin clasificar</span>}
                  {m.alcance != null ? <span className="mu">{compacto(m.alcance)} de alcance</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : <p className="mu">Todavía no hay menciones registradas de esta figura.</p>}
    </section>
  );
}

export function Audiencia({ f, hoy }: { f: FiguraCampana; hoy: string }) {
  const cuentas = Array.isArray(f.cuentas) ? f.cuentas : [];
  const datos: Array<[string, string | null]> = [
    ['Cargo', cargoDe(f)], ['Partido', f.partido], ['Coalición', f.coalicion], ['Territorio', f.territorio], ['Tipo', f.tipo],
  ];
  const conDato = datos.filter(([, v]) => v);
  return (
    <div className="col fade" style={{ gap: 20 }}>
      <div className="row">
        <section className="card c1">
          <div className="ch"><h2>Cuentas monitoreadas{cuentas.length ? ` · ${cuentas.length}` : ''}</h2>{f.seguidores != null ? <span className="mu">{compacto(f.seguidores)} seguidores · medido el {fecha(hoy, 'largo')}</span> : null}</div>
          {cuentas.length ? (
            <div className="list">
              {cuentas.map((c) => (
                <div className="li" key={`${c.red}-${c.usuario}`}>
                  <div className="gr"><span className="b">{c.usuario}</span><span className="mu">{c.red}{c.verificada ? ' · verificada' : ''}</span></div>
                  <span className="b">{c.seguidores == null ? <span className="mu">Sin datos</span> : compacto(c.seguidores)}</span>
                </div>
              ))}
            </div>
          ) : <p className="mu">Esta figura no tiene cuentas registradas. Sin cuentas no hay publicaciones propias que medir.</p>}
        </section>
        <section className="card c1">
          <h2>Perfil</h2>
          {conDato.length ? (
            <div className="fg-dl">
              {conDato.map(([k, v]) => <div key={k}><span className="mu">{k}</span><span className="b">{v}</span></div>)}
            </div>
          ) : null}
          {f.trayectoria ? <p className="fg-txt">{f.trayectoria}</p> : null}
          {!conDato.length && !f.trayectoria ? <p className="mu">Sin datos de perfil registrados.</p> : null}
        </section>
      </div>
    </div>
  );
}

