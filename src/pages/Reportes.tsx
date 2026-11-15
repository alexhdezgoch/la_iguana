// Reportes de una campaña: programados, historial de envíos y plantillas, más el editor y la vista de un envío.
// El envío por correo es de la fase 2: "Enviar ahora", "Aprobar" y "Reenviar" dejan la fila en reporte_envios
// con estado 'Pendiente de envío' y la interfaz lo dice así. Nunca se marca nada como enviado.
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { hoyDe, useCampana, usePagina, useRol } from '../shell/Campana';
import { useSesion } from '../shell/Sesion';
import { useAcciones } from '../shell/Acciones';
import { Carga, Vacio } from '../shell/Estados';
import { useTabla } from '../lib/hooks';
import { db } from '../lib/db';
import { diaEn, fecha, rango } from '../lib/formato';
import type { Evento, Persona, Reporte, ReporteEnvio, ReportePlantilla } from '../lib/tipos';
import { Editor } from './reportes/Editor';
import { VerEnvio } from './reportes/VerEnvio';
import type { Contenido, SeccionCfg } from './reportes/documento';
import { COLA, ESTADO_ENVIO, aLas, descripcionDe, enDias, gmt, listasDe, momento, nombreDest, periodoEnvio, ponerEnCola, resumenDest } from './reportes/util';
import './Reportes.css';

const ORDEN_ESTADOS = ['Pendiente de envío', 'En revisión', 'Borrador', 'Entregado', 'Envío parcial', 'Fallido'];
const ABIERTOS = ['Pendiente de envío', 'En revisión', 'Borrador'];
const TIPO_CORTO: Record<string, string> = { 'Semanal de narrativas': 'Semanal' };

export default function Reportes() {
  usePagina('Reportes');
  const campana = useCampana();
  const cid = campana.id;
  const hoy = hoyDe(campana);
  const zona = campana.zona_horaria;
  const { puedeEditar } = useRol();
  const { persona } = useSesion();
  const { aviso, abrirDescarga } = useAcciones();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'prog';
  const ver = params.get('ver');
  const envioId = params.get('envio');
  const fTipo = params.get('ftipo') ?? 'todos';
  const fEst = params.get('festado') ?? 'todos';
  const [ocupado, setOcupado] = useState<string | null>(null);

  const reportes = useTabla<Reporte>('reportes', { eq: { campana_id: cid }, orden: 'orden' });
  const plantillas = useTabla<ReportePlantilla>('reporte_plantillas', { eq: { campana_id: cid }, orden: 'orden' });
  const envios = useTabla<ReporteEnvio>('reporte_envios', { eq: { campana_id: cid }, orden: [['generado_en', 'desc']] });
  const personas = useTabla<Persona>('personas', { eq: { org_id: campana.org_id }, orden: 'nombre' });
  const eventos = useTabla<Evento>('eventos', { eq: { campana_id: cid }, orden: 'fecha_inicio' });

  const listas = listasDe(campana);
  const ir = (cambios: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(cambios)) { if (v == null) p.delete(k); else p.set(k, v); }
    setParams(p);
    window.scrollTo(0, 0);
  };
  const repDe = (id: string) => reportes.datos.find((r) => r.id === id) ?? null;
  const previoDe = (id: string) => envios.datos.find((e) => e.reporte_id === id && e.contenido?.secciones?.length)?.contenido as Contenido | undefined ?? null;

  async function correr(clave: string, fn: () => Promise<unknown>, ok: string, enlace?: { texto: string; a: string }) {
    setOcupado(clave);
    try { await fn(); aviso(ok, enlace); } catch (e) { aviso(e instanceof Error ? e.message : String(e)); } finally { setOcupado(null); }
  }
  const enviarAhora = (r: Reporte) => correr(`env-${r.id}`, () => ponerEnCola(r, { campana, hoy, personaId: persona?.id ?? null, listas, previo: previoDe(r.id) }),
    `"${r.nombre}" quedó pendiente de envío. ${COLA}`, { texto: 'Ver en historial', a: `/c/${cid}/reportes?tab=hist` });
  const pausar = (r: Reporte) => correr(`pau-${r.id}`, () => db.cambiar('reportes', r.id, { estado: r.estado === 'Pausado' ? 'Activo' : 'Pausado' }),
    r.estado === 'Pausado' ? `"${r.nombre}" vuelve a estar activo.` : `"${r.nombre}" quedó en pausa.`);
  const aprobar = (e: ReporteEnvio) => correr(`apr-${e.id}`, () => db.cambiar('reporte_envios', e.id, { estado: 'Pendiente de envío', aprobado_por: persona?.id ?? null, extra: { ...e.extra, nota: 'Aprobado, en cola de envío' } }),
    `Aprobado. ${COLA}`);
  const reenviar = (e: ReporteEnvio) => correr(`ree-${e.id}`, () => db.crear('reporte_envios', {
    campana_id: cid, reporte_id: e.reporte_id, titulo: `${e.titulo ?? 'Reporte'} · reenvío`, periodo_inicio: e.periodo_inicio, periodo_fin: e.periodo_fin,
    estado: 'Pendiente de envío', destinatarios: e.estado === 'Entregado' ? e.destinatarios : Math.max(0, (e.destinatarios ?? 0) - (e.entregados ?? 0)), entregados: 0,
    contenido: e.contenido, extra: { reenvio_de: e.id, nota: e.estado === 'Entregado' ? 'Reenvío a todos, en cola' : 'Reenvío a quienes no lo recibieron, en cola', origen: 'manual', pedido_por: persona?.id ?? null },
  }), `Reenvío pendiente. ${COLA}`);
  const sacarDeCola = (e: ReporteEnvio) => correr(`sac-${e.id}`, () => db.cambiar('reporte_envios', e.id, { estado: 'Borrador', extra: { ...e.extra, nota: 'Sacado de la cola' } }), 'Quedó como borrador, fuera de la cola.');

  // ---------- editor y vista de un envío ----------
  if (ver) {
    const rep = ver === 'nuevo' ? null : repDe(ver);
    if (ver !== 'nuevo' && !rep && !reportes.cargando) {
      return (
        <main className="page pg-reportes">
          <Vacio titulo="Este reporte no está disponible"><button type="button" className="lkb" onClick={() => ir({ ver: null, plantilla: null })}>Volver a reportes</button></Vacio>
        </main>
      );
    }
    return (
      <Carga estados={[reportes, plantillas, personas, eventos, envios]}>
        <Editor
          key={ver + (params.get('plantilla') ?? '')}
          reporte={rep}
          plantilla={plantillas.datos.find((p) => p.id === params.get('plantilla')) ?? null}
          plantillas={plantillas.datos}
          reportes={reportes.datos}
          previo={ver === 'nuevo' ? null : previoDe(ver)}
          personas={personas.datos}
          eventos={eventos.datos}
          volver={() => ir({ ver: null, plantilla: null })}
          abrir={(id) => ir({ ver: id, plantilla: null })}
          enviarAhora={enviarAhora}
          ocupado={ocupado}
        />
      </Carga>
    );
  }
  if (envioId) {
    return (
      <Carga estados={[reportes, envios]}>
        <VerEnvio
          envio={envios.datos.find((e) => e.id === envioId) ?? null}
          reporte={repDe(envios.datos.find((e) => e.id === envioId)?.reporte_id ?? '')}
          volver={() => ir({ envio: null })}
          editar={(id) => ir({ envio: null, ver: id })}
          aprobar={aprobar} reenviar={reenviar} ocupado={ocupado}
        />
      </Carga>
    );
  }

  // ---------- programados ----------
  const enRevision = envios.datos.filter((e) => e.estado === 'En revisión');
  const proximosBorradores = reportes.datos.filter((r) => r.estado === 'Activo' && r.extra?.borrador_hora && r.proximo_envio);
  const vacia = !reportes.datos.length;
  const programados = reportes.datos.filter((r) => r.frecuencia !== 'Una vez');
  const aPedido = reportes.datos.filter((r) => r.frecuencia === 'Una vez');

  // ---------- historial ----------
  const tipoDe = (e: ReporteEnvio) => repDe(e.reporte_id)?.tipo ?? 'Sin tipo';
  const ordenados = [...envios.datos].sort((a, b) => {
    const pa = ABIERTOS.includes(a.estado) ? 0 : 1, pb = ABIERTOS.includes(b.estado) ? 0 : 1;
    return pa - pb || b.generado_en.localeCompare(a.generado_en);
  });
  const tiposHist = [...new Set(envios.datos.map(tipoDe))];
  const estadosHist = ORDEN_ESTADOS.filter((s) => envios.datos.some((e) => e.estado === s));
  const hist = ordenados.filter((e) => (fTipo === 'todos' || tipoDe(e) === fTipo) && (fEst === 'todos' || e.estado === fEst));

  // ---------- plantillas ----------
  const metaPlantilla = (p: ReportePlantilla) => {
    const uso = reportes.datos.find((r) => r.plantilla_id === p.id && r.frecuencia !== 'Una vez' && r.estado === 'Activo');
    if (uso) {
      const h = (uso.hora ?? '').replace(/^0(\d)/, '$1');
      return uso.frecuencia === 'Diario' ? `En uso · diario ${h}` : uso.frecuencia === 'Semanal' ? `En uso · ${uso.extra?.dia ?? 'semanal'} ${h}` : 'En uso · automático';
    }
    return p.usos ? `Usada ${p.usos} ${p.usos === 1 ? 'vez' : 'veces'}` : 'Sin uso todavía';
  };

  const sub = [campana.contienda ?? campana.nombre, `zona horaria ${zona.split('/').pop()?.replace(/_/g, ' ')} (${gmt(zona, hoy)})`, fecha(hoy, 'dia') + ' de ' + hoy.slice(0, 4)].join(' · ');

  return (
    <Carga estados={[reportes, plantillas, envios, personas, eventos]}>
      <main className="page pg-reportes">
        <div className="ph">
          <div>
            <h1>Reportes</h1>
            <p className="mu">{sub}</p>
          </div>
          <div className="acts">
            <button type="button" className="btn bg" onClick={() => abrirDescarga()}>Descargar reporte</button>
            {puedeEditar ? (
              <button type="button" className="btn bp" onClick={() => ir({ ver: 'nuevo' })}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>Nuevo reporte
              </button>
            ) : null}
          </div>
        </div>

        <div className="tabs" role="tablist" aria-label="Secciones de reportes">
          {[['prog', 'Programados'], ['hist', 'Historial'], ['plant', 'Plantillas']].map(([k, t]) => (
            <button key={k} type="button" className="tab" role="tab" aria-selected={tab === k} onClick={() => ir({ tab: k === 'prog' ? null : k })}>{t}</button>
          ))}
        </div>

        {tab === 'prog' ? (
          <div className="col fade" style={{ gap: 20 }}>
            {vacia ? (
              <Vacio titulo="Todavía no hay reportes programados">
                {puedeEditar
                  ? <><button type="button" className="lkb" onClick={() => ir({ ver: 'nuevo' })}>Crear un reporte</button>{plantillas.datos.length ? <> o <button type="button" className="lkb" onClick={() => ir({ tab: 'plant' })}>partir de una plantilla</button></> : null}.</>
                  : 'Cuando el equipo programe un reporte aparecerá aquí.'}
              </Vacio>
            ) : (
              <div className="row" style={{ alignItems: 'stretch' }}>
                {programados.map((r) => {
                  const pausado = r.estado === 'Pausado';
                  const ultimo = envios.datos.filter((e) => e.reporte_id === r.id && e.enviado_en).sort((a, b) => (b.enviado_en ?? '').localeCompare(a.enviado_en ?? ''))[0];
                  const enCola = envios.datos.filter((e) => e.reporte_id === r.id && e.estado === 'Pendiente de envío').length;
                  const evProx = r.extra?.proximo_evento_id ? eventos.datos.find((e) => e.id === r.extra.proximo_evento_id) : null;
                  const facts: Array<[string, string]> = [
                    ['Destinatarios', resumenDest(r.destinatarios, listas, personas.datos)],
                    ['Último envío', ultimo ? (ultimo.extra?.evento_id && eventos.datos.find((e) => e.id === ultimo.extra.evento_id)
                      ? `${fecha(diaEn(ultimo.enviado_en, zona), 'corto')} · ${eventos.datos.find((e) => e.id === ultimo.extra.evento_id)!.nombre}, ${ultimo.entregados ?? 0} de ${ultimo.destinatarios ?? 0}`
                      : `${momento(ultimo.enviado_en, hoy, zona)} · entregado a ${ultimo.entregados ?? 0} de ${ultimo.destinatarios ?? 0}`) : r.ultimo_envio ? momento(r.ultimo_envio, hoy, zona) : 'Sin envíos todavía'],
                    [evProx ? 'Próximo' : 'Próximo envío', pausado ? 'En pausa, no se enviará'
                      : evProx ? `${evProx.nombre}${r.proximo_envio ? ` · borrador el ${fecha(diaEn(r.proximo_envio, zona), 'corto')}` : ''}`
                        : r.proximo_envio ? momento(r.proximo_envio, hoy, zona) : r.frecuencia === 'Una vez' ? 'Se envía cuando lo pidas' : 'Sin programar'],
                  ];
                  return (
                    <section className="card c1" key={r.id} aria-label={`Reporte programado: ${r.nombre}`}>
                      <div className="ch" style={{ alignItems: 'center' }}>
                        <h2>{r.nombre}</h2>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          <span className={pausado ? 'chip warn' : 'chip live'}>{pausado ? 'Pausado' : 'Activo'}</span>
                          {r.requiere_aprobacion ? <span className="chip ring">Requiere aprobación</span> : null}
                        </div>
                      </div>
                      <p className="sm">{descripcionDe(r)}</p>
                      <div className="list">
                        {facts.map(([l, v]) => (
                          <div className="li" key={l} style={{ alignItems: 'baseline', padding: '8px 0' }}><span className="mu" style={{ flex: '0 0 104px' }}>{l}</span><span className="sm" style={{ flex: 1, minWidth: 0 }}>{v}</span></div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 'auto' }}>
                        <button type="button" className="btn bg" onClick={() => ir({ ver: r.id })}>Vista previa</button>
                        {puedeEditar ? (
                          <>
                            <button type="button" className="btn bg" disabled={!!ocupado} onClick={() => enviarAhora(r)}>{ocupado === `env-${r.id}` ? 'Poniendo en cola…' : 'Enviar ahora'}</button>
                            <button type="button" className="btn bg" disabled={!!ocupado} aria-pressed={pausado} onClick={() => pausar(r)}>{pausado ? 'Activar' : 'Pausar'}</button>
                          </>
                        ) : null}
                      </div>
                      {enCola ? (
                        <div className="well sm fade" role="status" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                          <span className="chip ring">En cola</span>
                          <span style={{ flex: '1 1 140px' }}>{enCola === 1 ? '1 envío pendiente' : `${enCola} envíos pendientes`}. {COLA}</span>
                          <button type="button" className="lkb" onClick={() => ir({ tab: 'hist', ftipo: null, festado: 'Pendiente de envío' })}>Ver en historial</button>
                        </div>
                      ) : null}
                    </section>
                  );
                })}
              </div>
            )}

            {aPedido.length ? (
              <section className="card">
                <div className="ch"><h2>A pedido</h2><span className="mu">Sin programación: salen cuando alguien los envía</span></div>
                <div className="list">
                  {aPedido.map((r) => {
                    const ultimo = envios.datos.filter((e) => e.reporte_id === r.id)[0];
                    const enCola = envios.datos.filter((e) => e.reporte_id === r.id && e.estado === 'Pendiente de envío').length;
                    return (
                      <div className="li" key={r.id} style={{ flexWrap: 'wrap' }}>
                        <div className="gr" style={{ flex: '1 1 280px' }}>
                          <span className="b">{r.nombre}</span>
                          <span className="mu">{[r.tipo, resumenDest(r.destinatarios, listas, personas.datos), ultimo ? `último: ${ultimo.estado.toLowerCase()}, ${aLas(ultimo.generado_en, hoy, zona)}` : 'sin envíos todavía', enCola ? `${enCola} en cola` : null].filter(Boolean).join(' · ')}</span>
                        </div>
                        {r.requiere_aprobacion ? <span className="chip ring">Requiere aprobación</span> : null}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          <button type="button" className="btn bg" onClick={() => ir({ ver: r.id })}>Vista previa</button>
                          {puedeEditar ? <button type="button" className="btn bg" disabled={!!ocupado} onClick={() => enviarAhora(r)}>{ocupado === `env-${r.id}` ? 'Poniendo en cola…' : 'Enviar ahora'}</button> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {enRevision.length || proximosBorradores.length ? (
              <section className="card">
                <div className="ch"><h2>Por aprobar</h2><span className="mu">{enRevision.length ? `${enRevision.length} ${enRevision.length === 1 ? 'borrador espera' : 'borradores esperan'} revisión` : 'Nada pendiente hoy'}</span></div>
                <div className="list">
                  {enRevision.map((e) => {
                    const r = repDe(e.reporte_id);
                    const nombres = r ? (r.destinatarios as Array<{ lista?: string; persona_id?: string }>).map((d) => (d.lista ? `la lista "${listas.find((l) => l.id === d.lista)?.nombre ?? d.lista}"` : nombreDest(d, listas, personas.datos).nombre)) : [];
                    const para = nombres.length ? (nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}` : nombres[0]) : null;
                    return (
                      <div className="li" key={e.id} style={{ flexWrap: 'wrap' }}>
                        <div className="gr" style={{ flex: '1 1 280px' }}>
                          <span className="b">{e.titulo ?? r?.nombre}</span>
                          <span className="mu">{[para ? `Para ${para}, ${e.destinatarios ?? 0} ${e.destinatarios === 1 ? 'contacto' : 'contactos'}.` : null, e.extra?.cierra_en ? `Se cierra ${aLas(e.extra.cierra_en, hoy, zona)}.` : null, e.extra?.nota ?? null].filter(Boolean).join(' ')}</span>
                        </div>
                        <span className="chip ring">En revisión</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          <button type="button" className="btn bg" onClick={() => ir({ envio: e.id })}>Revisar</button>
                          {puedeEditar ? <button type="button" className="btn bp" disabled={!!ocupado} onClick={() => aprobar(e)}>Aprobar</button> : null}
                        </div>
                      </div>
                    );
                  })}
                  {proximosBorradores.map((r) => (
                    <div className="li" key={r.id}>
                      <div className="gr">
                        <span className="b">{r.nombre} del {fecha(diaEn(r.proximo_envio, zona), 'dia')}</span>
                        <span className="mu">
                          El borrador se genera a las {String(r.extra.borrador_hora).replace(/^0/, '')}{r.extra.borrador_cierre ? ` y se cierra a las ${String(r.extra.borrador_cierre).replace(/^0/, '')}` : ''}.
                          {r.requiere_aprobacion ? ' Necesita aprobación antes de salir.' : ` No requiere aprobación: queda listo para las ${(r.hora ?? '').replace(/^0/, '')} aunque nadie lo revise.`}
                        </span>
                      </div>
                      <span className="chip watch">{enDias(r.proximo_envio, hoy, zona)}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            {campana.veda_inicio && !vacia ? (
              <p className="mu note">Veda electoral del {rango(campana.veda_inicio, campana.veda_fin).replace(' a ', ' al ')}: los reportes programados deben salir solo a destinatarios internos; los envíos al cliente y los enlaces con acceso no se programan esos días. El monitoreo continúa.</p>
            ) : null}
          </div>
        ) : null}

        {tab === 'hist' ? (
          <div className="col fade">
            {envios.datos.length ? (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px 16px' }}>
                  <div className="seg" role="group" aria-label="Filtrar por tipo">
                    {['todos', ...tiposHist].map((t) => <button key={t} type="button" className="pill" aria-pressed={fTipo === t} onClick={() => ir({ ftipo: t === 'todos' ? null : t })}>{t === 'todos' ? 'Todos' : TIPO_CORTO[t] ?? t}</button>)}
                  </div>
                  <div className="seg" role="group" aria-label="Filtrar por estado">
                    {['todos', ...estadosHist].map((t) => <button key={t} type="button" className="pill" aria-pressed={fEst === t} onClick={() => ir({ festado: t === 'todos' ? null : t })}>{t === 'todos' ? 'Todos' : t}</button>)}
                  </div>
                  <span className="mu sp">{hist.length} de {envios.datos.length} reportes</span>
                </div>
                <div className="tw"><div>
                  <table style={{ minWidth: 1010 }}>
                    <thead><tr><th scope="col">Reporte</th><th scope="col">Periodo cubierto</th><th scope="col">Generado</th><th scope="col">Enviado</th><th scope="col">Entregados</th><th scope="col">Estado</th><th scope="col" className="r">Acciones</th></tr></thead>
                    <tbody>
                      {hist.map((e) => {
                        const conDoc = !!e.contenido?.secciones?.length;
                        const accion = e.estado === 'En revisión' ? ['Aprobar', () => aprobar(e)] as const
                          : e.estado === 'Borrador' ? ['Enviar', () => aprobar(e)] as const
                            : e.estado === 'Pendiente de envío' ? ['Sacar de la cola', () => sacarDeCola(e)] as const
                              : ['Reenviar', () => reenviar(e)] as const;
                        return (
                          <tr key={e.id}>
                            <td><div className="gr"><button type="button" className="lkb tl" style={{ textAlign: 'left' }} onClick={() => ir({ envio: e.id })}>{e.titulo ?? 'Reporte sin título'}</button><span className="mu">{tipoDe(e)}</span></div></td>
                            <td className="sm">{periodoEnvio(e.periodo_inicio, e.periodo_fin, zona)}</td>
                            <td className="sm" style={{ whiteSpace: 'nowrap' }}>{momento(e.generado_en, hoy, zona)}</td>
                            <td className="sm" style={{ whiteSpace: 'nowrap' }}>{e.enviado_en ? momento(e.enviado_en, hoy, zona) : 'Sin enviar'}</td>
                            <td><div className="gr"><span className="b">{e.entregados ?? 0} de {e.destinatarios ?? 0}</span>{e.extra?.nota ? <span className="mu">{e.extra.nota}</span> : null}</div></td>
                            <td><span className={ESTADO_ENVIO[e.estado] ?? 'chip watch'}>{e.estado}</span></td>
                            <td className="r">
                              <div style={{ display: 'inline-flex', gap: 14, whiteSpace: 'nowrap' }}>
                                <button type="button" className="lkb" onClick={() => ir({ envio: e.id })}>{conDoc ? 'Ver' : 'Detalle'}</button>
                                {puedeEditar ? <button type="button" className="lkb" disabled={!!ocupado} onClick={accion[1]}>{accion[0]}</button> : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                  {!hist.length ? <p className="mu" style={{ padding: '20px 16px' }}>Ningún reporte coincide con estos filtros.</p> : null}
                </div>
                <p className="mu note">"Entregados" cuenta destinatarios que recibieron el reporte, no aperturas. Los envíos pendientes esperan en cola: el envío por correo todavía no está conectado. En un envío parcial o fallido, "Reenviar" pone en cola solo a quienes no lo recibieron.</p>
              </>
            ) : (
              <Vacio titulo="Todavía no hay envíos">Cada vez que un reporte se genere o se ponga en cola aparecerá aquí.</Vacio>
            )}
          </div>
        ) : null}

        {tab === 'plant' ? (
          <div className="col fade">
            {plantillas.datos.length ? (
              <div className="row" style={{ alignItems: 'stretch' }}>
                {plantillas.datos.map((p) => (
                  <section className="card" key={p.id} aria-label={`Plantilla: ${p.nombre}`} style={{ flex: '1 1 220px', minWidth: 0 }}>
                    <div className="ch" style={{ alignItems: 'center' }}><h2>{p.nombre}</h2>{p.etiqueta ? <span className={p.etiqueta === 'Base' ? 'chip watch' : p.etiqueta === 'Tuya' ? 'chip live' : 'chip ring'}>{p.etiqueta}</span> : null}</div>
                    {p.descripcion ? <p className="mu">{p.descripcion}</p> : null}
                    <ol className="secs">{(p.secciones as SeccionCfg[]).map((s) => <li key={s.id}>{s.titulo}</li>)}</ol>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 'auto' }}>
                      {puedeEditar ? <button type="button" className="btn bg" onClick={() => ir({ ver: 'nuevo', plantilla: p.id })}>Usar plantilla</button> : null}
                      <span className="mu">{metaPlantilla(p)}</span>
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <Vacio titulo="Todavía no hay plantillas">
                {puedeEditar ? <>Arma un reporte y usa "Guardar como plantilla". <button type="button" className="lkb" onClick={() => ir({ ver: 'nuevo' })}>Crear un reporte</button></> : 'Las plantillas del equipo aparecerán aquí.'}
              </Vacio>
            )}
            <p className="mu note">Ninguna plantilla incluye valor monetario de medios: la cobertura se cuenta por medio y por tono. Las plantillas y las listas de destinatarios son de esta campaña y no se comparten con otras.</p>
          </div>
        ) : null}
        {!puedeEditar ? <p className="mu note">Tu rol en esta campaña permite ver y descargar reportes, no programarlos ni enviarlos.</p> : null}
      </main>
    </Carga>
  );
}
