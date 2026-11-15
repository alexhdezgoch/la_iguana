import { Link } from 'react-router-dom';
import { Vacio } from '../../shell/Estados';
import { useTabla } from '../../lib/hooks';
import { ESTADO_EVENTO, aFecha, corto, diasEntre, fecha, neto, num } from '../../lib/formato';
import type { Evento } from '../../lib/tipos';
import { CargaSeccion, enLista, plural, type Ctx } from './comun';

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "En 5 días", "Hace 7 días", "Día 2 de 3": derivado de las fechas contra el hoy de la campaña. */
function notaEstado(e: Evento, hoy: string): string {
  if (e.nota_estado) return e.nota_estado;
  if (!e.fecha_inicio) return '';
  const ini = diasEntre(hoy, e.fecha_inicio) ?? 0;
  const fin = e.fecha_fin ? diasEntre(hoy, e.fecha_fin) ?? ini : ini;
  if (ini > 0) return ini === 1 ? 'Mañana' : `En ${ini} días`;
  if (fin >= 0) {
    const total = (diasEntre(e.fecha_inicio, e.fecha_fin ?? e.fecha_inicio) ?? 0) + 1;
    return total > 1 ? `Día ${1 - ini} de ${total}` : 'Hoy';
  }
  return fin === -1 ? 'Ayer' : `Hace ${-fin} días`;
}

export default function SecEventos({ c }: { c: Ctx }) {
  const { campana, base, hoy, propia, puedeEditar } = c;
  const eventos = useTabla<Evento>('eventos', { eq: { campana_id: campana.id }, orden: [['fecha_inicio', 'desc']] });
  const lista = eventos.datos;

  const porVenir = lista.filter((e) => e.fecha_inicio && e.fecha_inicio >= hoy && e.estado !== 'Cancelado').length;
  const cuenta = (estado: string) => lista.filter((e) => e.estado === estado && !(e.fecha_inicio && e.fecha_inicio >= hoy)).length;
  const partes = [
    porVenir ? `${porVenir} por venir` : '',
    cuenta('En curso') ? `${cuenta('En curso')} en curso` : '',
    cuenta('En análisis') ? `${cuenta('En análisis')} en análisis` : '',
    cuenta('Cerrado') ? `${cuenta('Cerrado')} ${cuenta('Cerrado') === 1 ? 'cerrado' : 'cerrados'}` : '',
    cuenta('Cancelado') ? `${cuenta('Cancelado')} ${cuenta('Cancelado') === 1 ? 'cancelado' : 'cancelados'}` : '',
  ].filter(Boolean);
  const ventanas = [...new Set(lista.map((e) => e.ventana_horas))];

  return (
    <CargaSeccion estados={[eventos]}>
      <div className="col fade" style={{ gap: 20 }}>
        {lista.length ? (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="mu">{plural(lista.length, 'evento', 'eventos')}{partes.length ? ` · ${enLista(partes)}` : ''}</span>
              {puedeEditar ? <Link className="lk" to={`${base}/eventos/nuevo`}>Crear evento</Link> : null}
            </div>
            <div className="tw"><div>
              <table style={{ minWidth: 860 }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ width: '40%' }}>Evento</th>
                    <th scope="col">Tipo y origen</th>
                    <th scope="col">Estado</th>
                    <th scope="col" className="r">Menciones</th>
                    <th scope="col" className="r">{propia ? `Neto de ${corto(propia)}` : 'Sentimiento neto'}</th>
                    <th scope="col" className="r">Notas en medios</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((e) => {
                    const d = aFecha(e.fecha_inicio);
                    const lugar = [...new Set([e.sede, e.ciudad].filter((x): x is string => !!x))].join(', ');
                    return (
                      <tr key={e.id}>
                        <td><div className="who">
                          <span className="ini" aria-hidden="true" style={{ width: 44, height: 44, flexDirection: 'column', gap: 2, lineHeight: 1 }}>
                            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.04em' }}>{d ? MES[d.getMonth()] : '—'}</span>
                            <span style={{ fontSize: 15, color: '#1B211D' }}>{d ? d.getDate() : ''}</span>
                          </span>
                          <span className="gr">
                            <Link className="tl" to={`${base}/eventos/${e.id}`}>{e.nombre}</Link>
                            <span className="mu">{e.fecha_inicio ? fecha(e.fecha_inicio, 'dia').replace(/^./, (x) => x.toUpperCase()) : 'Sin fecha'}{lugar ? ` · ${lugar}` : ''}</span>
                          </span>
                        </div></td>
                        <td>{e.tipo}<div className="mu">{e.origen}</div></td>
                        <td><span className={ESTADO_EVENTO[e.estado] ?? 'chip watch'}>{e.estado}</span><div className="mu" style={{ paddingTop: 2, whiteSpace: 'nowrap' }}>{notaEstado(e, hoy)}</div></td>
                        <td className={e.menciones == null ? 'r mu' : 'r'} style={{ whiteSpace: 'nowrap' }}>{num(e.menciones)}</td>
                        <td className="r" style={{ whiteSpace: 'nowrap' }}><span className={e.neto == null ? 'mu' : e.neto >= 0 ? 'b tf' : 'b tu'}>{neto(e.neto)}</span></td>
                        <td className={e.notas_medios == null ? 'r mu' : 'r'} style={{ whiteSpace: 'nowrap' }}>{num(e.notas_medios)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div></div>
          </>
        ) : (
          <Vacio titulo="Todavía no hay eventos">
            {puedeEditar ? <><Link to={`${base}/eventos/nuevo`}>Crear un evento</Link> para medir la conversación antes, durante y después.</> : 'Cuando el equipo registre eventos, aparecen aquí con sus cifras.'}
          </Vacio>
        )}
        <p className="mu note">
          {campana.fase === 'Precampaña' ? 'En precampaña los eventos son pocos y pequeños. ' : ''}
          {ventanas.length === 1 ? `Cada evento se mide ${ventanas[0]} horas antes y después. ` : 'Cada evento se mide antes y después, según su ventana de análisis. '}
          Lo que no se midió aparece como "Sin datos", nunca como cero.
        </p>
      </div>
    </CargaSeccion>
  );
}
