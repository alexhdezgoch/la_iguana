import { Link } from 'react-router-dom';
import { useCampanas } from '../../shell/Campana';
import { Vacio } from '../../shell/Estados';
import { Icono } from '../../shell/Iconos';
import { useTabla } from '../../lib/hooks';
import { REL, RIESGO_PUNTO, iniciales, neto, num, pct } from '../../lib/formato';
import type { FiguraCampana } from '../../lib/tipos';
import { CargaSeccion, cargoDe, enLista, type Ctx } from './comun';

export default function SecFiguras({ c }: { c: Ctx }) {
  const { campana, base, figuras, propia, puedeEditar } = c;
  const { campanas } = useCampanas();
  const ids = figuras.map((f) => f.figura_id);
  // Las mismas figuras en otras campañas visibles: para "de 21,560 en total".
  const todas = useTabla<FiguraCampana>('v_figuras_campana', { eq: { figura_id: ids } }, ids.length > 0);

  const porPart = [...figuras].sort((a, b) => (b.participacion ?? 0) - (a.participacion ?? 0));
  const maxPart = Math.max(1, ...figuras.map((f) => f.participacion ?? 0));
  const otras = (fid: string) => todas.datos.filter((t) => t.figura_id === fid && t.campana_id !== campana.id);
  const compartidas = porPart.filter((f) => otras(f.figura_id).length > 0);
  const nombresCampanas = [...new Set(compartidas.flatMap((f) => otras(f.figura_id).map((o) => {
    const k = campanas.find((x) => x.id === o.campana_id);
    return k?.contienda ?? k?.nombre ?? '';
  })))].filter(Boolean);

  if (!figuras.length) {
    return (
      <div className="col fade" style={{ gap: 20 }}>
        <Vacio titulo="Esta campaña todavía no sigue a ninguna figura">
          {puedeEditar ? <><Link to={`${base}/figuras/nueva`}>Agregar una figura</Link> para medir su conversación.</> : 'Cuando el equipo agregue figuras, aparecen aquí con sus cifras.'}
        </Vacio>
      </div>
    );
  }

  return (
    <CargaSeccion estados={[todas]}>
      <div className="col fade" style={{ gap: 20 }}>
        <div className="tw"><div>
          <table style={{ minWidth: 920 }}>
            <thead>
              <tr>
                <th scope="col" style={{ width: '28%' }}>Figura</th>
                <th scope="col">Partido</th>
                <th scope="col">Relación</th>
                <th scope="col" className="r">Menciones</th>
                <th scope="col" style={{ width: '18%' }}>Participación</th>
                <th scope="col" className="r">Sentimiento neto</th>
                <th scope="col">Riesgo</th>
              </tr>
            </thead>
            <tbody>
              {porPart.map((f) => {
                const o = otras(f.figura_id);
                const total = f.menciones + o.reduce((n, x) => n + x.menciones, 0);
                const cls = REL[f.relacion].cls;
                return (
                  <tr key={f.id}>
                    <td><div className="who">
                      <span className={'ini ' + cls} aria-hidden="true">{f.iniciales ?? iniciales(f.nombre)}</span>
                      <span className="gr">
                        <Link className="tl" style={{ whiteSpace: 'nowrap' }} to={`${base}/figuras/${f.figura_id}`}>{f.nombre}</Link>
                        <span className="mu" style={{ whiteSpace: 'nowrap' }}>{cargoDe(f) ?? 'Sin cargo'}</span>
                      </span>
                    </div></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{f.partido ?? <span className="mu">Sin partido</span>}</td>
                    <td><span className={'chip ' + cls}>{f.relacion}</span></td>
                    <td className="r">{num(f.menciones)}<div className="mu" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{o.length ? `de ${num(total)} en total` : 'solo en esta campaña'}</div></td>
                    <td><div className="br"><div className="bar"><i style={{ width: `${(((f.participacion ?? 0) / maxPart) * 100).toFixed(1)}%`, background: REL[f.relacion].color }} /></div><span className="b" style={{ flex: '0 0 44px', textAlign: 'right' }}>{pct(f.participacion)}</span></div></td>
                    <td className="r">
                      <span className={f.neto == null ? 'mu' : f.neto >= 0 ? 'b tf' : 'b tu'}>{neto(f.neto)}</span>
                      {f.favorable != null ? <div className="mu" style={{ fontSize: 12 }}>{f.favorable} / {f.neutral ?? 0} / {f.desfavorable ?? 0}</div> : null}
                    </td>
                    <td>
                      {f.riesgo != null ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                          <span className={RIESGO_PUNTO[f.riesgo_nivel ?? 'Bajo']} /><span className="b">{f.riesgo}</span><span className="mu">{f.riesgo_nivel ?? ''}</span>
                        </span>
                      ) : <span className="mu">Sin datos</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div></div>

        {figuras.length === 1 ? (
          <section className="card" style={{ alignItems: 'center', textAlign: 'center', padding: '36px 20px', gap: 8 }}>
            <span className="ini" aria-hidden="true" style={{ background: '#E7F0E8', color: '#285A32' }}><Icono d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6" /></span>
            <h2>Agrega rivales para comparar</h2>
            <p className="mu" style={{ maxWidth: 520 }}>Esta campaña sigue solo a su figura propia. Al sumar rivales o aliadas, la participación y el sentimiento se comparan entre figuras con las mismas métricas.</p>
            {puedeEditar ? <Link className="btn bg" to={`${base}/figuras/nueva`} style={{ marginTop: 6 }}><Icono n="mas" g={2} />Agregar una figura rival</Link> : null}
          </section>
        ) : null}

        <p className="mu note">
          {compartidas.length
            ? `${enLista(compartidas.map((f) => f.nombre))} también ${compartidas.length === 1 ? 'está' : 'están'} en ${enLista(nombresCampanas)}. Aquí solo se cuenta la parte de sus menciones que pertenece a la conversación de esta campaña; su total en todas las campañas aparece en "Todas las campañas". `
            : ''}
          Sentimiento neto es el porcentaje de menciones favorables menos el de desfavorables, con la distribución favorable / neutral / desfavorable debajo.
          {figuras.length === 1 && propia ? ` La participación de ${propia.nombre} es la parte de la conversación de esta campaña que nombra a la figura.` : ''}
        </p>
      </div>
    </CargaSeccion>
  );
}
