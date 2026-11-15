import { Link } from 'react-router-dom';
import { hoyDe } from '../../shell/Campana';
import { neto, pct } from '../../lib/formato';
import { contienda, reloj, type CampanaPanorama } from './derivar';

/** Tarjeta de una campaña: fase, cifras de la figura propia y pendientes. */
export function TarjetaCampana({ x, severidadMax, puedeEditar, marcarDemo = false }: { x: CampanaPanorama; severidadMax: string | null; puedeEditar: boolean; marcarDemo?: boolean }) {
  const { c, r } = x;
  const base = `/c/${c.id}`;
  const { avance, texto } = reloj(c, hoyDe(c));
  const abiertas = r?.alertas_abiertas ?? 0;
  const porRevisar = r?.menciones_por_revisar ?? 0;
  const figuras = r?.figuras ?? 0;
  const conCifras = r?.menciones != null;

  return (
    <section className="card c1" style={{ gap: 12 }} aria-label={c.nombre}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="sw-b" aria-hidden="true">{c.iniciales}</span>
        <div className="gr">
          <h2><Link className="tl" to={base}>{c.nombre}</Link></h2>
          <span className="mu">{contienda(x)}</span>
        </div>
        <span className={c.fase === 'Campaña' ? 'chip live' : 'chip ring'}>{c.fase}</span>
      </div>
      {marcarDemo ? (
        <span className="chip warn" style={{ alignSelf: 'flex-start' }} title="Personas y partidos reales. Cifras, menciones y eventos inventados para la demostración.">Demo · escenario hipotético</span>
      ) : null}
      <div className="bar" style={{ flex: 'none', height: 6 }}>
        <i style={{ width: `${(avance ?? 0).toFixed(1)}%`, background: '#285A32' }} />
      </div>
      <span className="mu">{texto}</span>
      {conCifras ? (
        <div className="well" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 22px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}><span className="kl">Participación</span><span className="kv s">{pct(r!.participacion)}</span></div>
          <div style={{ display: 'flex', flexDirection: 'column' }}><span className="kl">Neto</span><span className={'kv s ' + ((r!.neto ?? 0) >= 0 ? 'tf' : 'tu')}>{neto(r!.neto)}</span></div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="kl">Riesgo</span>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}><span className="kv s">{r!.riesgo ?? 'Sin datos'}</span>{r!.riesgo_nivel ? <span className="mu">{r!.riesgo_nivel}</span> : null}</span>
          </div>
        </div>
      ) : (
        <div className="well sm">
          {r?.figura_propia_id
            ? 'La figura propia todavía no tiene cifras del periodo.'
            : <>Sin figura propia todavía.{puedeEditar ? <> <Link to={`${base}/figuras/nueva`}>Agregar figura</Link></> : null}</>}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <Link to={`${base}/alertas`} style={{ textDecoration: 'none' }}
          className={abiertas && (severidadMax === 'Alta' || severidadMax === 'Media') ? 'chip unf' : 'chip watch'}>
          {abiertas ? `${abiertas} ${abiertas === 1 ? 'alerta' : 'alertas'}` : 'Sin alertas'}
        </Link>
        <Link to={`${base}/menciones`} style={{ textDecoration: 'none' }} className={porRevisar ? 'chip warn' : 'chip watch'}>
          {porRevisar ? `${porRevisar} por revisar` : 'Nada por revisar'}
        </Link>
        <Link to={`${base}/figuras`} style={{ textDecoration: 'none' }} className="chip watch">
          {figuras ? `${figuras} ${figuras === 1 ? 'figura' : 'figuras'}` : 'Sin figuras'}
        </Link>
      </div>
      <div style={{ marginTop: 'auto', paddingTop: 4 }}>
        <Link className="btn bg" to={base}>Abrir campaña</Link>
      </div>
    </section>
  );
}
