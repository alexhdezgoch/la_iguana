import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAcciones } from '../../shell/Acciones';
import { Vacio } from '../../shell/Estados';
import { useSesion } from '../../shell/Sesion';
import { db } from '../../lib/db';
import { useTabla } from '../../lib/hooks';
import { cuando, num } from '../../lib/formato';
import type { Mencion, Tema } from '../../lib/tipos';
import { CargaSeccion, plural, type Ctx } from './comun';

const SENT: Record<string, [string, string]> = { Favorable: ['chip fav', 'd df'], Neutral: ['chip', 'd'], Desfavorable: ['chip unf', 'd du'] };
const VISTAS = [
  { clave: 'todas', texto: 'Todas' },
  { clave: 'por-revisar', texto: 'Por revisar' },
  { clave: 'revisadas', texto: 'Revisadas' },
] as const;
const TOPE = 50;

/** Mismo criterio que la barra lateral: requiere revisión, no revisada y no descartada. */
const pendiente = (m: Mencion) => m.requiere_revision && !m.revisada && m.estado !== 'Descartada';

export default function SecMenciones({ c }: { c: Ctx }) {
  const { campana, hoy, figuras, puedeEditar } = c;
  const [params, setParams] = useSearchParams();
  const { persona } = useSesion();
  const { aviso, abrirAgregarUrl } = useAcciones();
  const [guardando, setGuardando] = useState<string | null>(null);

  const menciones = useTabla<Mencion>('menciones', { eq: { campana_id: campana.id }, orden: [['publicada_en', 'desc']], limite: TOPE });
  const temas = useTabla<Tema>('temas', { eq: { campana_id: campana.id } });

  const todas = menciones.datos;
  const nPend = todas.filter(pendiente).length;
  const ver = VISTAS.some((v) => v.clave === params.get('ver')) ? params.get('ver')! : 'todas';
  const revisadas = todas.filter((m) => m.revisada).length;
  const lista = todas.filter((m) => ver === 'todas' || (ver === 'por-revisar' ? pendiente(m) : m.revisada));
  const cuentas: Record<string, number> = { todas: todas.length, 'por-revisar': nPend, revisadas };
  const nombreFigura = (id: string | null) => figuras.find((f) => f.figura_id === id)?.nombre ?? null;
  const nombreTema = (id: string | null) => temas.datos.find((t) => t.id === id)?.nombre ?? null;

  const elegir = (clave: string) => {
    const p = new URLSearchParams(params);
    if (clave === 'todas') p.delete('ver'); else p.set('ver', clave);
    setParams(p, { replace: true });
  };

  async function revisar(m: Mencion) {
    setGuardando(m.id);
    try {
      await db.cambiar<Mencion>('menciones', m.id, { revisada: true, revisada_por: persona?.id ?? null, revisada_en: new Date().toISOString() });
      aviso('Mención marcada como revisada');
    } catch (e) {
      aviso(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(null);
    }
  }

  return (
    <CargaSeccion estados={[menciones, temas]}>
      <div className="col fade" style={{ gap: 20 }}>
        {todas.length ? (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="seg" role="group" aria-label="Filtrar por estado">
                {VISTAS.map((v) => (
                  <button key={v.clave} type="button" className="pill" aria-pressed={ver === v.clave} onClick={() => elegir(v.clave)}>{v.texto} · {cuentas[v.clave]}</button>
                ))}
              </div>
              <span className="mu">{lista.length === 1 ? '1 mención' : `${num(lista.length)} menciones`}</span>
            </div>
            <section className="tw" aria-label="Lista de menciones">
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {lista.map((m) => {
                  const s = m.sentimiento_manual ?? m.sentimiento;
                  const [sc, dc] = s ? SENT[s] : ['chip', 'd'];
                  const fig = nombreFigura(m.figura_id), tema = nombreTema(m.tema_id);
                  const pend = pendiente(m);
                  return (
                    <div className="mrow" key={m.id}>
                      <span className="mm mu">
                        <span className="b" style={{ color: '#454E48' }}>{m.fuente ?? 'Sin fuente'}</span>
                        <span>{m.canal}</span>
                        <span>{cuando(m.publicada_en, hoy, campana.zona_horaria)}</span>
                        {m.url ? <a className="lk" href={m.url} target="_blank" rel="noreferrer">Abrir publicación</a> : null}
                      </span>
                      <span className="b" style={{ fontSize: 15, lineHeight: '21px' }}>{m.titulo ?? m.resumen ?? 'Sin título'}</span>
                      <span className="mm">
                        <span className={sc}><span className={dc} />{s ?? 'Sin clasificar'}</span>
                        {fig || tema ? <span className="mu">{[fig, tema].filter(Boolean).join(' · ')}</span> : null}
                        <span className="mm" style={{ marginLeft: 'auto' }}>
                          {m.estado === 'Descartada' ? <span className="chip watch">Descartada</span>
                            : m.estado === 'Por procesar' ? <span className="chip watch">Por procesar</span>
                            : pend ? <span className="chip warn">Por revisar</span>
                            : m.revisada ? <span className="chip ring">Revisada</span> : null}
                          {pend && puedeEditar ? (
                            <button type="button" className="enlace-btn" disabled={guardando === m.id} onClick={() => void revisar(m)}>
                              {guardando === m.id ? 'Guardando…' : 'Marcar revisada'}
                            </button>
                          ) : null}
                        </span>
                      </span>
                    </div>
                  );
                })}
                {!lista.length ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {ver === 'por-revisar'
                      ? <><span className="b">Nada por revisar</span><span className="mu">El equipo ya revisó todas las menciones importantes del periodo.</span></>
                      : <><span className="b">Sin menciones revisadas</span><span className="mu">Las menciones aparecen aquí cuando un analista las revisa.</span></>}
                  </div>
                ) : null}
                <div className="mu" style={{ padding: '12px 16px', background: '#F1F3EF' }}>
                  {todas.length >= TOPE ? `Muestra de las ${TOPE} menciones más recientes` : `${plural(todas.length, 'mención reciente', 'menciones recientes')}`}
                  {nPend ? `; ${nPend === 1 ? '1 espera' : `${nPend} esperan`} revisión de un analista.` : '; ninguna espera revisión.'}
                  {' '}El sentimiento es para la figura nombrada. Las publicaciones de ciudadanos se muestran sin nombre ni usuario.
                </div>
              </div>
            </section>
          </>
        ) : (
          <Vacio titulo="Todavía no hay menciones">
            Las menciones llegan con la ingesta de fuentes.{puedeEditar ? <> También puedes <button type="button" className="enlace-btn" onClick={abrirAgregarUrl}>agregar una URL</button> a mano.</> : null}
          </Vacio>
        )}
      </div>
    </CargaSeccion>
  );
}
