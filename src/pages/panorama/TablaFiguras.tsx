import { Link } from 'react-router-dom';
import { REL, RIESGO_PUNTO, iniciales as inicialesDe, neto, num } from '../../lib/formato';
import type { FiguraPanorama } from './derivar';

/** Tabla de figuras de todas las campañas. Cada nombre y cada chip de campaña enlaza a la ficha en esa campaña. */
export function TablaFiguras({ filas, cortoDe }: { filas: FiguraPanorama[]; cortoDe: (campanaId: string) => string }) {
  return (
    <div className="tw"><div>
      <table style={{ minWidth: 900 }}>
        <thead>
          <tr>
            <th scope="col" style={{ width: '26%' }}>Figura</th>
            <th scope="col">Campañas y relación</th>
            <th scope="col" className="r">Menciones</th>
            <th scope="col" className="r">Sentimiento neto</th>
            <th scope="col">Riesgo</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => {
            const principal = f.vinculos[0];
            return (
              <tr key={f.figura_id}>
                <td>
                  <div className="who">
                    <span className={'ini ' + REL[principal.relacion].cls} aria-hidden="true">{f.iniciales ?? inicialesDe(f.nombre)}</span>
                    <span className="gr">
                      <Link className="tl" to={`/c/${principal.campana_id}/figuras/${f.figura_id}`} style={{ whiteSpace: 'nowrap' }}>{f.nombre}</Link>
                      {f.partido ? <span className="mu">{f.partido}</span> : null}
                    </span>
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {f.vinculos.map((v) => (
                      <Link key={v.campana_id} className={'chip ' + REL[v.relacion].cls} style={{ textDecoration: 'none' }}
                        to={`/c/${v.campana_id}/figuras/${f.figura_id}`}>
                        {cortoDe(v.campana_id)} · {v.relacion}
                      </Link>
                    ))}
                  </div>
                </td>
                <td className="r">{f.menciones ? num(f.menciones) : <span className="mu">Sin menciones</span>}</td>
                <td className="r">{f.neto != null ? <span className={(f.neto >= 0 ? 'b tf' : 'b tu')}>{neto(f.neto)}</span> : <span className="mu">Sin datos</span>}</td>
                <td>
                  {f.riesgo != null ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                      <span className={RIESGO_PUNTO[f.riesgo_nivel ?? ''] ?? 'd'} />
                      <span className="b">{f.riesgo}</span>
                      {f.riesgo_nivel ? <span className="mu">{f.riesgo_nivel}</span> : null}
                    </span>
                  ) : <span className="mu">Sin datos</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div></div>
  );
}
