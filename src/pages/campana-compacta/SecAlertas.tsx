import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAcciones } from '../../shell/Acciones';
import { useCampanas } from '../../shell/Campana';
import { Vacio } from '../../shell/Estados';
import { useSesion } from '../../shell/Sesion';
import { db } from '../../lib/db';
import { useTabla } from '../../lib/hooks';
import { SEVERIDAD, cuando } from '../../lib/formato';
import { ALERTAS_ABIERTAS, type Alerta, type AlertaActividad, type EstadoAlerta, type Evento, type Narrativa, type Tema } from '../../lib/tipos';
import { CargaSeccion, enLista, type Ctx } from './comun';

const ESTADO_CLS: Record<EstadoAlerta, string> = {
  Nueva: 'chip warn', 'En revisión': 'chip live', Pospuesta: 'chip watch', Resuelta: 'chip ring', Descartada: 'chip watch',
};
const VISTAS = [{ clave: 'abiertas', texto: 'Abiertas' }, { clave: 'atendidas', texto: 'Atendidas' }] as const;

interface Paso { texto: string; estado: EstadoAlerta; bitacora: string }
/** Acciones disponibles según el estado. Cada una guarda el estado y deja constancia en la bitácora de la alerta. */
function pasos(a: Alerta): Paso[] {
  if (a.estado === 'Resuelta' || a.estado === 'Descartada') return [{ texto: 'Reabrir', estado: 'En revisión', bitacora: 'reabrió la alerta · En revisión' }];
  const cierre: Paso[] = [
    { texto: 'Resolver', estado: 'Resuelta', bitacora: 'resolvió la alerta' },
    { texto: 'Descartar', estado: 'Descartada', bitacora: 'descartó la alerta' },
  ];
  return a.estado === 'Nueva' ? [{ texto: 'Tomar', estado: 'En revisión', bitacora: 'tomó la alerta · En revisión' }, ...cierre] : cierre;
}

export default function SecAlertas({ c }: { c: Ctx }) {
  const { campana, base, hoy, figuras, puedeEditar } = c;
  const cid = campana.id;
  const [params, setParams] = useSearchParams();
  const { persona } = useSesion();
  const { aviso } = useAcciones();
  const [guardando, setGuardando] = useState<string | null>(null);

  const alertas = useTabla<Alerta>('alertas', { eq: { campana_id: cid }, orden: [['detectada_en', 'desc']] });
  const temas = useTabla<Tema>('temas', { eq: { campana_id: cid } });
  const eventos = useTabla<Evento>('eventos', { eq: { campana_id: cid } });
  const narrativas = useTabla<Narrativa>('narrativas', { eq: { campana_id: cid } });
  // La misma alerta (texto + figura) en otras campañas visibles: pasa con figuras vinculadas a varias campañas.
  const figIds = [...new Set(alertas.datos.map((a) => a.figura_id).filter((x): x is string => !!x))];
  const ajenas = useTabla<Alerta>('alertas', { eq: { figura_id: figIds }, neq: { campana_id: cid } }, figIds.length > 0);
  const { campanas } = useCampanas();

  const abierta = (a: Alerta) => ALERTAS_ABIERTAS.includes(a.estado);
  const nAbiertas = alertas.datos.filter(abierta).length;
  const ver = params.get('ver') === 'atendidas' ? 'atendidas' : 'abiertas';
  const lista = alertas.datos.filter((a) => (ver === 'abiertas') === abierta(a));
  const cuentas: Record<string, number> = { abiertas: nAbiertas, atendidas: alertas.datos.length - nAbiertas };

  const repetidas = alertas.datos.flatMap((a) => {
    const otras = ajenas.datos.filter((o) => o.figura_id === a.figura_id && o.texto === a.texto);
    if (!otras.length) return [];
    const fig = figuras.find((f) => f.figura_id === a.figura_id)?.nombre;
    const donde = [...new Set(otras.map((o) => { const k = campanas.find((x) => x.id === o.campana_id); return k?.contienda ?? k?.nombre ?? ''; }))].filter(Boolean);
    return fig && donde.length ? [`La alerta sobre ${fig} aparece también en ${enLista(donde)} porque la figura está vinculada a ${donde.length === 1 ? 'las dos campañas' : 'varias campañas'}.`] : [];
  });

  const elegir = (clave: string) => {
    const p = new URLSearchParams(params);
    if (clave === 'abiertas') p.delete('ver'); else p.set('ver', clave);
    setParams(p, { replace: true });
  };

  function sobre(a: Alerta) {
    const ev = a.evento_id ? eventos.datos.find((e) => e.id === a.evento_id) : null;
    if (ev) return <>Evento · <Link className="tl" to={`${base}/eventos/${ev.id}`}>{ev.nombre}</Link></>;
    // Orden: evento, figura (salvo la propia), tema, figura propia. Así "Rival en tema propio" muestra al rival
    // y una nota sobre un tema muestra el tema aunque también nombre a la figura propia.
    const fi = a.figura_id ? figuras.find((f) => f.figura_id === a.figura_id) : null;
    const lkFigura = fi ? <>Figura · <Link className="tl" to={`${base}/figuras/${fi.figura_id}`}>{fi.nombre}</Link></> : null;
    if (fi && fi.relacion !== 'Propia') return lkFigura;
    const te = a.tema_id ? temas.datos.find((t) => t.id === a.tema_id) : null;
    if (te) return <>Tema · <Link className="tl" to={`${base}/temas`}>{te.nombre}</Link></>;
    if (lkFigura) return lkFigura;
    const na = a.narrativa_id ? narrativas.datos.find((n) => n.id === a.narrativa_id) : null;
    if (na) return <>Narrativa · <Link className="tl" to={`${base}/temas`}>{na.nombre}</Link></>;
    return <span className="mu">{a.tipo ?? 'Sin vínculo'}</span>;
  }

  async function aplicar(a: Alerta, p: Paso) {
    setGuardando(a.id);
    try {
      const cerrar = p.estado === 'Resuelta' || p.estado === 'Descartada';
      const cambios: Partial<Alerta> = { estado: p.estado, resuelta_en: cerrar ? new Date().toISOString() : null, pospuesta_hasta: null };
      if (p.estado === 'En revisión' && persona && !a.responsable_id) cambios.responsable_id = persona.id;
      if (!cerrar) cambios.motivo_cierre = null;
      await db.cambiar<Alerta>('alertas', a.id, cambios);
      await db.crear<AlertaActividad>('alerta_actividad', { campana_id: cid, alerta_id: a.id, persona_id: persona?.id ?? null, texto: p.bitacora });
      aviso(cerrar ? `Alerta ${p.estado === 'Resuelta' ? 'resuelta' : 'descartada'}` : 'Alerta en revisión');
    } catch (e) {
      aviso(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(null);
    }
  }

  return (
    <CargaSeccion estados={[alertas, temas, eventos, narrativas, ajenas]}>
      <div className="col fade" style={{ gap: 20 }}>
        {alertas.datos.length ? (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="seg" role="group" aria-label="Filtrar alertas">
                {VISTAS.map((v) => (
                  <button key={v.clave} type="button" className="pill" aria-pressed={ver === v.clave} onClick={() => elegir(v.clave)}>{v.texto} · {cuentas[v.clave]}</button>
                ))}
              </div>
              <span className="mu">{lista.length === 1 ? '1 alerta' : `${lista.length} alertas`}</span>
            </div>
            <div className="tw"><div>
              <table style={{ minWidth: 820 }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ width: '46%' }}>Alerta</th>
                    <th scope="col">Nivel</th>
                    <th scope="col">Sobre</th>
                    <th scope="col">Detectada</th>
                    <th scope="col">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((a) => (
                    <tr key={a.id}>
                      <td><span className="b">{a.texto}</span>{a.explicacion ? <div className="mu">{a.explicacion}</div> : null}</td>
                      <td><span className={SEVERIDAD[a.severidad] ?? 'chip watch'}>{a.severidad}</span></td>
                      <td style={{ minWidth: 150 }}>{sobre(a)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{cuando(a.detectada_en, hoy, campana.zona_horaria).replace(/^./, (x) => x.toUpperCase())}</td>
                      <td>
                        <div className="acciones-alerta">
                          <span className={ESTADO_CLS[a.estado] ?? 'chip watch'}>{a.estado}</span>
                          {puedeEditar ? (
                            <span className="mm">
                              {guardando === a.id ? <span className="mu">Guardando…</span> : pasos(a).map((p) => (
                                <button key={p.texto} type="button" className="enlace-btn" onClick={() => void aplicar(a, p)}>{p.texto}</button>
                              ))}
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!lista.length ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '32px 20px' }}>
                      <span className="b">{ver === 'abiertas' ? 'Nada que atender por ahora' : 'Todavía no hay alertas atendidas'}</span>
                    </td></tr>
                  ) : null}
                </tbody>
              </table>
            </div></div>
          </>
        ) : (
          <Vacio titulo="Todavía no hay alertas">
            Las alertas aparecen cuando una regla detecta un cambio brusco en la conversación de esta campaña.
          </Vacio>
        )}
        <p className="mu note">Una alerta avisa de un cambio brusco: un tema que crece, un sentimiento que cae o una nota relevante. Sigue abierta hasta que alguien del equipo la atiende.{repetidas.length ? ` ${[...new Set(repetidas)].join(' ')}` : ''}</p>
      </div>
    </CargaSeccion>
  );
}
