// Columna "Vista previa": se arma solo con lo que hay en el borrador. Sin estimaciones de volumen (llegan con la ingesta).
import { REL, diasEntre } from '../../lib/formato';
import { COLOR_FASE, diasFase, fd, figurasOrdenadas, inicialesCampana, rangoFase, territorio } from './modelo';
import { lineaEquipo, nombreFigura, type Ctx } from './Pasos';

export function VistaPrevia({ d, hoy, cal, bad, directorio, otras }: Ctx & { otras: number }) {
  const terr = territorio(d);
  const fase = cal.actual >= 0 ? d.fases[cal.actual].nombre : null;
  const clsFase = fase === 'Campaña' ? 'chip live' : fase === 'Veda' ? 'chip warn' : 'chip ring';
  const faltanDias = d.campana.jornada ? diasEntre(hoy, d.campana.jornada) : null;
  const reloj = cal.faltan
    ? 'Completa las fechas para ver el reloj electoral.'
    : cal.actual < 0
      ? `Hoy, ${fd(hoy, true)}, queda fuera del calendario.`
      : `Hoy, ${fd(hoy, true)} · faltan ${faltanDias} ${faltanDias === 1 ? 'día' : 'días'} para la jornada.`;
  const figs = figurasOrdenadas(d.figuras);
  const maxT = Math.max(1, ...figs.map((f) => f.terminos.length));
  const camT = d.terminos.filter((t) => t.tipo !== 'Exclusión').length, excl = d.terminos.length - camT;
  const todo: Array<[boolean, string]> = [
    [!bad[0], 'Nombre y territorio'],
    [cal.ok, 'Calendario sin errores'],
    [figs.some((f) => f.relacion === 'Propia'), 'Figura propia elegida'],
    [d.confirmo_personas_publicas && figs.length > 0, 'Personas públicas confirmadas'],
    [!bad[3] && figs.length > 0, 'Términos para cada figura'],
    [!bad[4], 'Equipo con correo en cada invitación'],
  ];
  const faltan = todo.filter(([ok]) => !ok).length;

  return (
    <aside className="card c1 pv" aria-label="Vista previa de la campaña">
      <div className="ch"><h2>Vista previa</h2><span className="mu">Cambia mientras editas</span></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="sw-b">{inicialesCampana(d.campana.nombre)}</span>
        <div className="gr"><span className="b">{d.campana.nombre.trim() || 'Campaña sin nombre'}</span><span className="mu">{d.campana.tipo_eleccion}{terr ? ` · ${terr}` : ''}</span></div>
      </div>

      <div className="blk" style={{ gap: 6 }}>
        <div className="tg" style={{ justifyContent: 'space-between' }}><span className="kl">Fases electorales</span><span className={clsFase}>{fase ?? 'Sin fase hoy'}</span></div>
        <div className="pb" role="img" aria-label={`Fases electorales en una línea de tiempo. Hoy: ${fase ?? 'sin fase'}`}>
          {d.fases.map((p, i) => {
            const n = diasFase(p);
            const esHoy = i === cal.actual;
            const x = esHoy ? Math.round(((diasEntre(p.inicio, hoy) ?? 0) / Math.max(n - 1, 1)) * 100) : 0;
            return (
              <i key={p.nombre + i} style={{ flex: `${Math.max(n, 1)} 1 20px`, background: COLOR_FASE[p.nombre] ?? '#A8AFA9' }} title={`${p.nombre} · ${rangoFase(p)}`}>
                {esHoy ? <b className="hoy" style={{ left: `${x}%` }} /> : null}
              </i>
            );
          })}
        </div>
        <div className="blk" style={{ gap: 2, marginTop: 4 }}>
          {d.fases.map((p, i) => (
            <span className="sm" key={p.nombre + i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="d" style={{ background: COLOR_FASE[p.nombre] ?? '#A8AFA9' }} /><span>{p.nombre}</span><span className="mu" style={{ marginLeft: 'auto' }}>{rangoFase(p)}</span></span>
          ))}
        </div>
        <span className="mu">{reloj}</span>
      </div>

      <div className="blk" style={{ gap: 6 }}>
        <span className="kl">Términos de búsqueda</span>
        {!figs.length ? <span className="mu">Aún sin figuras.</span> : null}
        {figs.map((f) => {
          const nombre = nombreFigura(f, directorio);
          const n = f.terminos.length;
          return (
            <div className="blk" style={{ gap: 4 }} key={f.figura_id ?? f.clave}>
              <span className="sm" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre}</span>
                {n ? <span className="b">{n} {n === 1 ? 'término' : 'términos'}</span> : <span className="chip unf">Sin términos</span>}
              </span>
              <div className="bar" style={{ flex: 'none', height: 6 }}><i style={{ width: `${n ? Math.max(3, Math.round((n / maxT) * 100)) : 0}%`, background: REL[f.relacion].color }} /></div>
            </div>
          );
        })}
        <span className="mu">{camT} de la campaña · {excl} {excl === 1 ? 'exclusión' : 'exclusiones'} · {d.temas.length} {d.temas.length === 1 ? 'tema' : 'temas'}. El volumen de menciones se ve en el Resumen cuando empieza la recolección.</span>
      </div>

      <div className="blk" style={{ gap: 4 }}>
        <span className="kl">Equipo y aislamiento</span>
        <span className="sm">{lineaEquipo(d)}</span>
        <span className="mu" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4" /></svg>
          {otras ? `Espacio aislado de las otras ${otras} ${otras === 1 ? 'campaña' : 'campañas'}` : 'Espacio aislado de cualquier otra campaña'}
        </span>
      </div>

      <div className="blk" style={{ gap: 4 }}>
        <span className="kl">{faltan ? `Falta para crear · ${faltan}` : 'Lista para crear'}</span>
        {todo.map(([ok, t]) => <span className="ck" key={t}><span className={ok ? 'd dok' : 'd'} /><span className={ok ? 'sm' : 'sm b'}>{t}</span></span>)}
      </div>
    </aside>
  );
}
