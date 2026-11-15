// Tabla "frente a otras figuras": mismas métricas del corte para varias figuras de la campaña.
import { Link } from 'react-router-dom';
import { REL, RIESGO_PUNTO, compacto, iniciales, neto, pct } from '../../lib/formato';
import type { FiguraCampana } from '../../lib/tipos';

export function Comparacion({ titulo, filas, actual, base }: { titulo: string; filas: FiguraCampana[]; actual: string; base: string }) {
  const max = Math.max(1, ...filas.map((f) => f.participacion ?? 0));
  return (
    <div className="tw"><div>
      <table style={{ minWidth: 760 }}>
        <thead>
          <tr>
            <th scope="col">{titulo}</th>
            <th scope="col" style={{ width: '30%' }}>Participación</th>
            <th scope="col" className="r">Sentimiento neto</th>
            <th scope="col" className="r">Alcance</th>
            <th scope="col" className="r">Interacción</th>
            <th scope="col">Riesgo</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => {
            const rel = REL[f.relacion] ?? REL['A observar'];
            const esta = f.figura_id === actual;
            return (
              <tr key={f.id} aria-current={esta ? 'true' : undefined} className={esta ? 'fg-actual' : undefined}>
                <td>
                  <div className="who">
                    <span className={`ini ${rel.cls}`} aria-hidden="true">{f.iniciales || iniciales(f.nombre)}</span>
                    <span className="gr">
                      {esta ? <span className="b">{f.nombre}</span> : <Link className="tl" to={`${base}/figuras/${f.figura_id}`}>{f.nombre}</Link>}
                      <span className="mu">{[f.partido, f.relacion].filter(Boolean).join(' · ')}</span>
                    </span>
                  </div>
                </td>
                <td>
                  <div className="br">
                    <div className="bar"><i style={{ width: `${(((f.participacion ?? 0) / max) * 100).toFixed(1)}%`, background: rel.color }} /></div>
                    <span className="b" style={{ flex: '0 0 64px', textAlign: 'right' }}>{pct(f.participacion)}</span>
                  </div>
                </td>
                <td className="r"><span className={f.neto == null ? 'mu' : f.neto >= 0 ? 'b tf' : 'b tu'}>{neto(f.neto)}</span></td>
                <td className="r">{f.alcance == null ? <span className="mu">Sin datos</span> : compacto(f.alcance)}</td>
                <td className="r">{f.interaccion == null ? <span className="mu">Sin datos</span> : pct(f.interaccion)}</td>
                <td>
                  {f.riesgo == null ? <span className="mu">Sin datos</span> : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                      <span className={f.riesgo_nivel ? RIESGO_PUNTO[f.riesgo_nivel] : 'd'} />
                      <span className="b">{f.riesgo}</span>
                      {f.riesgo_nivel ? <span className="mu">{f.riesgo_nivel}</span> : null}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div></div>
  );
}
