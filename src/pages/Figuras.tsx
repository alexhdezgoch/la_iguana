// Figuras de una campaña: totales, filtro por relación (en la URL) y tabla con las mismas métricas para todas.
// Lee v_figuras_campana. No escribe: la relación y los datos de cada figura se editan en su ficha o al agregarla.
import { Link, useSearchParams } from 'react-router-dom';
import { useCampana, usePagina, useRol } from '../shell/Campana';
import { Carga, Vacio } from '../shell/Estados';
import { useTabla } from '../lib/hooks';
import { REL, RIESGO_PUNTO, compacto, iniciales, neto, num, pct, rango } from '../lib/formato';
import type { FiguraCampana, Relacion } from '../lib/tipos';
import './Figuras.css';

const RELACIONES: Relacion[] = ['Propia', 'Aliada', 'Rival', 'A observar'];
const PLURAL: Record<Relacion, [string, string]> = {
  Propia: ['propia', 'propias'],
  Aliada: ['aliada', 'aliadas'],
  Rival: ['rival', 'rivales'],
  'A observar': ['a observar', 'a observar'],
};

function cargoDe(f: FiguraCampana): string | null {
  const c = f.extra_campana?.cargo;
  return typeof c === 'string' && c.trim() ? c : f.cargo;
}
function sinCorte(f: FiguraCampana): boolean {
  return f.periodo == null;
}
function lista(nombres: string[]): string {
  if (nombres.length <= 1) return nombres.join('');
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

export default function Figuras() {
  usePagina('Figuras');
  const campana = useCampana();
  const cid = campana.id;
  const base = `/c/${cid}`;
  const { puedeEditar } = useRol();
  const [params, setParams] = useSearchParams();

  const figuras = useTabla<FiguraCampana>('v_figuras_campana', { eq: { campana_id: cid }, orden: 'orden' });
  const todas = figuras.datos;

  const pedida = params.get('relacion');
  const sel: Relacion | 'Todas' = RELACIONES.includes(pedida as Relacion) ? (pedida as Relacion) : 'Todas';
  const elegir = (r: Relacion | 'Todas') => {
    const p = new URLSearchParams(params);
    if (r === 'Todas') p.delete('relacion'); else p.set('relacion', r);
    setParams(p, { replace: true });
  };
  const filas = sel === 'Todas' ? todas : todas.filter((f) => f.relacion === sel);

  // Totales derivados de las filas (los cortes por figura ya vienen guardados).
  const conCorte = todas.filter((f) => !sinCorte(f));
  const total = conCorte.reduce((n, f) => n + (f.menciones ?? 0), 0);
  const porPart = [...conCorte].filter((f) => f.participacion != null).sort((a, b) => (b.participacion ?? 0) - (a.participacion ?? 0));
  const lider = porPart[0] ?? null;
  const segunda = porPart[1] ?? null;
  const altas = conCorte.filter((f) => f.riesgo_nivel === 'Alto').sort((a, b) => (b.riesgo ?? 0) - (a.riesgo ?? 0));
  const maxPart = Math.max(1, ...todas.map((f) => f.participacion ?? 0));
  const conteo = RELACIONES
    .map((r) => [r, todas.filter((f) => f.relacion === r).length] as const)
    .filter(([, n]) => n > 0)
    .map(([r, n]) => `${n} ${PLURAL[r][n === 1 ? 0 : 1]}`)
    .join(' · ');

  const agregar = puedeEditar ? (
    <Link className="btn bp" to={`${base}/figuras/nueva`}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      Agregar figura
    </Link>
  ) : null;

  return (
    <Carga estados={[figuras]}>
      <main className="page pg-figuras">
        <div className="ph">
          <div>
            <h1>Figuras</h1>
            <p className="mu">
              {todas.length} {todas.length === 1 ? 'figura' : 'figuras'} en seguimiento
              {campana.periodo_inicio ? ` · ${rango(campana.periodo_inicio, campana.periodo_fin)}` : ''}
            </p>
          </div>
          {agregar}
        </div>

        {todas.length === 0 ? (
          <Vacio titulo="Esta campaña todavía no sigue a ninguna figura">
            {puedeEditar
              ? <><Link to={`${base}/figuras/nueva`}>Agregar una figura</Link>: la propia, sus aliadas, rivales y a observar. Las cifras aparecen cuando lleguen las primeras menciones.</>
              : 'Cuando el equipo agregue figuras, aparecerán aquí con sus cifras.'}
          </Vacio>
        ) : (
          <>
            <section className="kpis" aria-label="Totales">
              <div className="kpi">
                <span className="kl">Figuras</span>
                <span className="kv">{todas.length}</span>
                <span className="mu">{conteo}</span>
              </div>
              <div className="kpi">
                <span className="kl">Menciones atribuidas</span>
                <span className="kv">{conCorte.length ? num(total) : 'Sin datos'}</span>
                <span className="mu">Una mención puede nombrar a varias figuras</span>
              </div>
              <div className="kpi">
                <span className="kl">Mayor participación</span>
                <span className="kv">{lider ? pct(lider.participacion) : 'Sin datos'}</span>
                <span className="mu">
                  {lider
                    ? <><Link className="tl" to={`${base}/figuras/${lider.figura_id}`}>{lider.nombre}</Link>{segunda ? `. ${segunda.nombre} tiene ${pct(segunda.participacion)}` : ''}</>
                    : 'Todavía no hay menciones'}
                </span>
              </div>
              <div className="kpi">
                <span className="kl">Riesgo alto</span>
                <span className="kv">{conCorte.length ? altas.length : 'Sin datos'}</span>
                <span className="mu">
                  {altas.length
                    ? lista(altas.map((f) => `${f.nombre}, índice ${f.riesgo}`))
                    : conCorte.length ? 'Ninguna figura con índice alto' : 'Todavía no hay menciones'}
                </span>
              </div>
            </section>

            <div className="fg-filtros">
              <div className="seg" role="group" aria-label="Filtrar por relación">
                {(['Todas', ...RELACIONES] as const).map((r) => (
                  <button key={r} type="button" className="pill" aria-pressed={sel === r} onClick={() => elegir(r)}>{r}</button>
                ))}
              </div>
              <span className="mu">{filas.length} de {todas.length} {todas.length === 1 ? 'figura' : 'figuras'}</span>
            </div>

            {filas.length === 0 ? (
              <Vacio titulo={`Sin figuras con relación ${sel}`}>
                <button type="button" className="lk fg-lk" onClick={() => elegir('Todas')}>Ver todas</button>
                {puedeEditar ? <> o <Link to={`${base}/figuras/nueva`}>agregar una figura</Link>.</> : null}
              </Vacio>
            ) : (
              <div className="tw"><div>
                <table style={{ minWidth: 1000 }}>
                  <thead>
                    <tr>
                      <th scope="col" style={{ width: '27%' }}>Figura</th>
                      <th scope="col">Partido</th>
                      <th scope="col">Relación</th>
                      <th scope="col" className="r">Menciones</th>
                      <th scope="col" style={{ width: '15%' }}>Participación</th>
                      <th scope="col" className="r">Sentimiento neto</th>
                      <th scope="col" className="r">Alcance</th>
                      <th scope="col" className="r">Interacción</th>
                      <th scope="col">Riesgo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => {
                      const rel = REL[f.relacion] ?? REL['A observar'];
                      const cargo = cargoDe(f);
                      const vacia = sinCorte(f);
                      return (
                        <tr key={f.id}>
                          <td>
                            <div className="who">
                              <span className={`ini ${rel.cls}`} aria-hidden="true">{f.iniciales || iniciales(f.nombre)}</span>
                              <span className="gr">
                                <Link className="tl" to={`${base}/figuras/${f.figura_id}`} style={{ whiteSpace: 'nowrap' }}>{f.nombre}</Link>
                                <span className="mu" style={{ whiteSpace: 'nowrap' }}>
                                  {cargo || 'Sin cargo'}
                                </span>
                              </span>
                            </div>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>{f.partido ?? <span className="mu">Sin partido</span>}</td>
                          <td><span className={`chip ${rel.cls}`}>{f.relacion}</span></td>
                          {vacia ? (
                            <td colSpan={6}><span className="mu">Recopilando. Las cifras aparecen con las primeras menciones.</span></td>
                          ) : (
                            <>
                              <td className="r">{num(f.menciones)}</td>
                              <td>
                                <div className="br">
                                  <div className="bar"><i style={{ width: `${(((f.participacion ?? 0) / maxPart) * 100).toFixed(1)}%`, background: rel.color }} /></div>
                                  <span className="b" style={{ flex: '0 0 44px', textAlign: 'right' }}>{f.participacion != null ? pct(f.participacion) : '–'}</span>
                                </div>
                              </td>
                              <td className="r">
                                {f.neto != null ? <span className={'b ' + (f.neto >= 0 ? 'tf' : 'tu')}>{neto(f.neto)}</span> : <span className="mu">Sin datos</span>}
                                {f.favorable != null && f.neutral != null && f.desfavorable != null
                                  ? <div className="mu" style={{ fontSize: 12 }}>{f.favorable} / {f.neutral} / {f.desfavorable}</div>
                                  : null}
                              </td>
                              <td className="r">{f.alcance != null ? compacto(f.alcance) : <span className="mu">Sin datos</span>}</td>
                              <td className="r">{f.interaccion != null ? pct(f.interaccion) : <span className="mu">Sin datos</span>}</td>
                              <td>
                                {f.riesgo != null ? (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                                    <span className={RIESGO_PUNTO[f.riesgo_nivel ?? ''] ?? 'd'} />
                                    <span className="b">{f.riesgo}</span>
                                    {f.riesgo_nivel ? <span className="mu">{f.riesgo_nivel}</span> : null}
                                  </span>
                                ) : <span className="mu">Sin datos</span>}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div></div>
            )}

            <p className="mu note">
              Sentimiento neto es el porcentaje de menciones favorables para la figura menos el de desfavorables. Debajo aparece la distribución favorable / neutral / desfavorable, con el mismo método para figuras propias y rivales.
            </p>
          </>
        )}
      </main>
    </Carga>
  );
}
