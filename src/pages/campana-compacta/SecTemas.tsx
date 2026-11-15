
import { useTabla } from '../../lib/hooks';
import { diasEntre, num, pct } from '../../lib/formato';
import type { Narrativa, Tema } from '../../lib/tipos';
import { CargaSeccion, DIRECCION, plural, totalConversacion, type Ctx } from './comun';

/** "Creció 38% en 48 h" cuando hay cambio guardado; si no, la tendencia. */
function tendenciaTema(t: Tema): { texto: string; cls: string } {
  if (t.cambio != null && t.cambio !== 0) {
    const ventana = typeof t.detalle?.cambio_ventana === 'string' ? t.detalle.cambio_ventana : '7 días';
    return { texto: `${t.cambio > 0 ? 'Creció' : 'Bajó'} ${Math.abs(t.cambio)}% en ${ventana}`, cls: t.cambio > 0 ? 'sm tu' : 'mu' };
  }
  return { texto: t.tendencia ?? 'Sin tendencia', cls: 'mu' };
}

export default function SecTemas({ c }: { c: Ctx }) {
  const { campana, propia } = c;
  const cid = campana.id;
  const propiaId = campana.figura_propia_id;
  const temas = useTabla<Tema>('temas', { eq: { campana_id: cid }, orden: 'orden' });
  const narrativas = useTabla<Narrativa>('narrativas', { eq: { campana_id: cid, figura_id: propiaId ?? '' }, orden: [['menciones', 'desc'], ['orden', 'asc']] }, !!propiaId);

  const maxTema = Math.max(1, ...temas.datos.map((t) => t.porcentaje ?? 0));
  const total = totalConversacion(propia);
  const dias = campana.periodo_inicio && campana.periodo_fin ? (diasEntre(campana.periodo_inicio, campana.periodo_fin) ?? 0) + 1 : null;
  const activas = narrativas.datos.filter((n) => n.estado === 'Activa').length;
  const nota = typeof campana.extra?.nota_temas === 'string' ? campana.extra.nota_temas : null;

  return (
    <CargaSeccion estados={[temas, narrativas]}>
      <div className="col fade" style={{ gap: 20 }}>
        <div className="row">
          <section className="card c1">
            <div className="ch">
              <h2>Temas de la conversación</h2>
              <span className="mu">{[total ? `${num(total)} menciones` : '', dias ? `últimos ${dias} días` : ''].filter(Boolean).join(' · ')}</span>
            </div>
            {temas.datos.length ? (
              <div className="bars">
                {temas.datos.map((t) => {
                  const tr = tendenciaTema(t);
                  return (
                    <div className="br" key={t.id}>
                      <div style={{ flex: '0 0 132px', minWidth: 0, display: 'flex', flexDirection: 'column' }}><span className="sm b">{t.nombre}</span><span className={tr.cls}>{tr.texto}</span></div>
                      <div className="bar"><i style={{ width: `${(((t.porcentaje ?? 0) / maxTema) * 100).toFixed(1)}%` }} /></div>
                      <div className="sm r" style={{ flex: '0 0 96px' }}><span className="b">{pct(t.porcentaje, 0)}</span> · {num(t.menciones)}</div>
                    </div>
                  );
                })}
              </div>
            ) : <p className="mu">Los temas aparecen cuando hay menciones clasificadas.</p>}
            {nota ? <div className="well sm" style={{ color: '#454E48' }}>{nota}</div> : null}
          </section>
          <section className="card c1">
            <div className="ch">
              <h2>{propia ? `Narrativas sobre ${propia.nombre}` : 'Narrativas'}</h2>
              {narrativas.datos.length ? <span className="mu">{plural(activas, 'activa', 'activas')}</span> : null}
            </div>
            {narrativas.datos.length ? (
              <div className="list">
                {narrativas.datos.map((n) => {
                  const d = DIRECCION[n.direccion] ?? DIRECCION['Sin dirección'];
                  return (
                    <div className="li" key={n.id} style={{ alignItems: 'flex-start' }}>
                      <div className="gr">
                        <span className="b">{n.nombre}</span>
                        {n.descripcion ? <span className="mu">{n.descripcion}</span> : null}
                        <span className="mu">{num(n.menciones)} menciones{n.tendencia ? ` · ${n.tendencia}` : ''}</span>
                      </div>
                      <span className={d.cls} style={{ flex: '0 0 84px', justifyContent: 'center' }}>{d.texto}</span>
                    </div>
                  );
                })}
              </div>
            ) : <p className="mu">{propia ? 'Todavía no hay narrativas detectadas.' : 'Las narrativas se siguen sobre la figura propia de la campaña.'}</p>}
          </section>
        </div>
        <p className="mu note">Un tema es el asunto del que se habla; una narrativa es la historia que se repite sobre la figura, a favor o en contra. Los temas de esta campaña son locales y no se comparten con otras campañas.</p>
      </div>
    </CargaSeccion>
  );
}
