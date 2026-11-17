// Pantalla del Informe (/c/:campanaId/reportes/informe/:reporteId): vista previa A4 y panel de configuración.
// Lee informe_datos (rpc), reportes, ejes, muestras y eventos. Guarda la configuración en reportes.extra.informe y
// "Generar edición" crea una fila de reporte_envios congelada ('Pendiente de envío': no se envía nada por correo).
// ?envio=<id> muestra una edición guardada de ESTE reporte y esta campaña (si no, "no disponible"); &vista=impresion reemplaza la página por el documento autónomo
// (lo usa rig/informe-pdf.mjs para el PDF sin pantalla).
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { hoyDe, useCampana, usePagina, useRol } from '../../shell/Campana';
import { useSesion } from '../../shell/Sesion';
import { useAcciones } from '../../shell/Acciones';
import { Carga, Vacio } from '../../shell/Estados';
import { useConsulta, useFila, useTabla } from '../../lib/hooks';
import { db } from '../../lib/db';
import { fecha } from '../../lib/formato';
import type { Eje, Evento, Muestra, Reporte, ReporteEnvio } from '../../lib/tipos';
import { descargar, nombreArchivo } from '../../lib/reportes/documento';
import { AVISO_DEMO } from '../../lib/reportes/marca';
import { Informe, SECCIONES, armar, seccionesDe, tablasDe } from '../../lib/informe/Informe';
import { textoAuto } from '../../lib/informe/hallazgos';
import { tablasCsv } from '../../lib/informe/Tabla';
import { informeHtml, imprimirInforme } from '../../lib/informe/servidor';
import { EDICION_ILEGIBLE, cargarInforme, configEvento, esDocInforme, esEdicionInforme, generarEdicion } from '../../lib/informe/edicion';
import { IlegibleInforme, LimiteInforme } from '../../lib/informe/Limite';
import type { InformeConfig, InformeDatos, SeccionConfig } from '../../lib/informe/tipos';
import { COLA, contarDest, desfase, listasDe } from './util';
import '../../lib/informe/informe.css';
import '../Reportes.css';
import './InformePagina.css';

/** Tablas cuyo cambio vuelve a pedir informe_datos. */
const TABLAS = ['reportes', 'menciones', 'mencion_ejes', 'ejes', 'muestras', 'codificaciones', 'comentarios', 'recolecciones', 'autores'];

const fechaDe = (s?: string) => (s ? s.slice(0, 10) : '');
const horaDe = (s?: string) => (s && s.length > 10 ? s.slice(11, 16) : '');
function juntar(dia: string, hora: string, zona: string): string | undefined {
  if (!dia) return undefined;
  return hora ? `${dia}T${hora}:00${desfase(zona, dia)}` : dia;
}

export default function InformePagina() {
  const { reporteId = '' } = useParams();
  const [params] = useSearchParams();
  const envioId = params.get('envio');
  const impresion = params.get('vista') === 'impresion';
  const campana = useCampana();
  const hoy = hoyDe(campana);
  const { puedeEditar } = useRol();
  const { persona } = useSesion();
  const { aviso } = useAcciones();
  const rep = useFila<Reporte>('reportes', reporteId);
  const envio = useFila<ReporteEnvio>('reporte_envios', envioId);
  usePagina(rep.datos?.nombre ?? 'Informe', [{ texto: 'Reportes', a: `/c/${campana.id}/reportes` }]);
  const datos = useConsulta<InformeDatos | null>(() => (envioId ? Promise.resolve(null) : cargarInforme(reporteId)), [reporteId, envioId], null, TABLAS);
  const ejes = useTabla<Eje>('ejes', { eq: { campana_id: campana.id }, orden: 'orden' });
  const muestras = useTabla<Muestra>('muestras', { eq: { campana_id: campana.id }, orden: 'orden' });
  const eventos = useTabla<Evento>('eventos', { eq: { campana_id: campana.id }, orden: 'fecha_inicio' });

  // Solo una edición de este reporte y de esta campaña: un ?envio= de otro reporte se trata como no encontrado.
  const envioPropio = !!envio.datos && envio.datos.reporte_id === reporteId && envio.datos.campana_id === campana.id;
  const ilegible = envioPropio && esDocInforme(envio.datos!.contenido) && !esEdicionInforme(envio.datos!.contenido);
  const edicion = envioId && envioPropio && esEdicionInforme(envio.datos!.contenido) ? envio.datos!.contenido as unknown as { datos: InformeDatos; textos: Record<string, string>; titulo: string } : null;
  const [errorImpresion, setErrorImpresion] = useState(false);

  // ---------- formulario ----------
  const guardado = (rep.datos?.extra?.informe ?? {}) as InformeConfig;
  const base = useMemo(() => ({ nombre: rep.datos?.nombre ?? '', cfg: guardado }), [rep.datos]); // eslint-disable-line react-hooks/exhaustive-deps
  const [form, setForm] = useState(base);
  useEffect(() => { setForm(base); }, [base]);
  const cfg = form.cfg;
  const set = (c: Partial<InformeConfig>) => setForm((f) => ({ ...f, cfg: { ...f.cfg, ...c } }));
  const [ocupado, setOcupado] = useState<string | null>(null);
  const ro = !puedeEditar;

  // Datos para la vista previa: los de la base con la portada, las secciones y los textos del formulario (sin guardar).
  const vista: InformeDatos | null = useMemo(() => {
    if (edicion) return edicion.datos;
    const d = datos.datos;
    if (!d) return null;
    return {
      ...d,
      portada: { ...d.portada, titulo: cfg.titulo || form.nombre || d.portada.titulo, subtitulo: cfg.subtitulo || null, nota_portada: cfg.nota_portada || null, nota_version: cfg.nota_version || null, fecha_informe: cfg.fecha_informe || d.portada.fecha_informe },
      secciones: cfg.secciones ?? d.secciones,
    };
  }, [edicion, datos.datos, cfg, form.nombre]);
  const secciones: SeccionConfig[] = vista ? seccionesDe(vista) : [];
  const textos = edicion?.textos;

  const sucio = JSON.stringify(form) !== JSON.stringify(base);

  // Vista de impresión: reemplaza la página por el documento autónomo (sin diálogo de impresión).
  useEffect(() => {
    if (!impresion || !vista) return;
    let html: string;
    try { html = informeHtml({ datos: vista, textos }); } catch (e) { console.error('Informe:', e); setErrorImpresion(true); return; }
    document.open(); document.write(html); document.close();
  }, [impresion, vista, textos]);

  const volver = <Link className="lkb" to={`/c/${campana.id}/reportes${envioId ? '?tab=hist' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>Volver a reportes
  </Link>;

  if (!rep.cargando && !rep.datos) {
    return <main className="page pg-reportes pg-informe"><Vacio titulo="Este informe no está disponible"><Link className="lkb" to={`/c/${campana.id}/reportes`}>Volver a reportes</Link></Vacio></main>;
  }
  if (rep.datos && rep.datos.tipo !== 'Informe') {
    return <main className="page pg-reportes pg-informe"><Vacio titulo="Este reporte no es un Informe"><Link className="lkb" to={`/c/${campana.id}/reportes?ver=${rep.datos.id}`}>Abrir en el editor de reportes</Link></Vacio></main>;
  }
  if (envioId && !envio.cargando && ilegible) {
    return <main className="page pg-reportes pg-informe"><div className="ph"><div>{volver}<h1>{EDICION_ILEGIBLE}</h1></div></div><section className="card"><IlegibleInforme /></section></main>;
  }
  if (impresion && errorImpresion) {
    return <main className="page pg-reportes pg-informe"><IlegibleInforme titulo={envioId ? EDICION_ILEGIBLE : 'Este informe no se puede mostrar'} detalle="El documento no se pudo armar con estos datos." /></main>;
  }
  if (envioId && !envio.cargando && !edicion) {
    return <main className="page pg-reportes pg-informe"><Vacio titulo="Esta edición no está disponible">Puede que se haya borrado o que no sea una edición de un Informe. <Link className="lkb" to={`/c/${campana.id}/reportes?tab=hist`}>Ver el historial</Link></Vacio></main>;
  }

  const base_archivo = vista ? `${vista.portada.titulo}` : 'informe';
  const fechaArch = vista?.portada.fecha_informe ?? hoy;
  function pdf() {
    if (!vista) return;
    if (!imprimirInforme({ datos: vista, textos })) aviso('El navegador bloqueó la ventana nueva. Permite ventanas emergentes para este sitio y vuelve a intentarlo.');
  }
  function html() {
    if (!vista) return;
    const n = nombreArchivo(base_archivo, fechaArch, 'html');
    descargar(n, informeHtml({ datos: vista, textos }), 'text/html;charset=utf-8');
    aviso(`Se descargó "${n}".`);
  }
  function csv() {
    if (!vista) return;
    const t = tablasDe(armar(vista, textos));
    const n = nombreArchivo(base_archivo, fechaArch, 'csv');
    descargar(n, tablasCsv(t, vista.campana.es_demo ? AVISO_DEMO : undefined), 'text/csv;charset=utf-8');
    aviso(`Se descargó "${n}" con ${t.length} ${t.length === 1 ? 'tabla' : 'tablas'}.`);
  }
  async function guardar() {
    if (!rep.datos || !datos.datos) return;
    setOcupado('guardar');
    try {
      // Los textos iguales a los automáticos no se guardan: así siguen a los datos.
      const d = vista ?? datos.datos;
      const secs = cfg.secciones?.map((s) => ({ ...s, texto: s.texto && s.texto.trim() && s.texto !== textoAuto(d, s.id) ? s.texto : undefined }));
      const limpio: InformeConfig = Object.fromEntries(Object.entries({ ...cfg, secciones: secs }).filter(([, v]) => v !== undefined && v !== '')) as InformeConfig;
      await db.cambiar<Reporte>('reportes', rep.datos.id, { nombre: form.nombre.trim() || rep.datos.nombre, extra: { ...rep.datos.extra, informe: limpio } });
      aviso('Configuración del informe guardada.');
    } catch (e) { aviso(e instanceof Error ? e.message : String(e)); } finally { setOcupado(null); }
  }
  async function edicionNueva() {
    if (!rep.datos) return;
    setOcupado('edicion');
    try {
      const e = await generarEdicion({ reporte: rep.datos, personaId: persona?.id ?? null, destinatarios: contarDest(rep.datos.destinatarios, listasDe(campana)) });
      aviso(`Edición guardada, pendiente de envío. ${COLA}`, { texto: 'Ver edición', a: `/c/${campana.id}/reportes?envio=${e.id}` });
    } catch (e) { aviso(e instanceof Error ? e.message : String(e)); } finally { setOcupado(null); }
  }

  const cambiarSeccion = (id: string, c: Partial<SeccionConfig>) => {
    const l = (cfg.secciones?.length ? cfg.secciones : secciones.map((s) => ({ id: s.id, activa: s.activa }))).map((s) => ({ ...s }));
    const i = l.findIndex((s) => s.id === id);
    if (i >= 0) l[i] = { ...l[i], ...c }; else l.push({ id, activa: true, ...c });
    set({ secciones: l });
  };
  const ejesSel = cfg.ejes ?? [];
  const muestrasSel = cfg.muestras ?? [];
  const alternar = (l: string[], id: string) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]);
  const evSel = eventos.datos.find((e) => e.id === cfg.evento_id) ?? null;
  const z = vista?.zona ?? campana.zona_horaria;

  return (
    <Carga estados={[rep, ejes, muestras, eventos]}>
      <main className="page pg-reportes pg-informe">
        <div className="ph">
          <div>
            {volver}
            <h1>{edicion ? edicion.titulo : form.nombre || 'Informe'}</h1>
            <p className="mu">
              {edicion ? `Edición congelada · generada ${envio.datos ? fecha(envio.datos.generado_en.slice(0, 10), 'medio') : ''} · ${envio.datos?.estado ?? ''}`
                : `Informe · modo ${(vista?.modo ?? cfg.modo ?? 'evento') === 'tema' ? 'tema' : 'evento'}${sucio ? ' · cambios sin guardar' : ''}`}
            </p>
          </div>
          <div className="acts" style={{ alignItems: 'center' }}>
            <button type="button" className="btn bg" disabled={!vista} onClick={pdf}>Imprimir / Guardar PDF</button>
            <button type="button" className="btn bg" disabled={!vista} onClick={html}>Descargar HTML</button>
            <button type="button" className="btn bg" disabled={!vista} onClick={csv}>Descargar CSV</button>
            {!ro && !edicion ? <button type="button" className="btn bg" disabled={!!ocupado || sucio || !vista} title={sucio ? 'Guarda los cambios antes de generar la edición' : undefined} onClick={edicionNueva}>{ocupado === 'edicion' ? 'Generando…' : 'Generar edición'}</button> : null}
            {!ro && !edicion ? <button type="button" className="btn bp" disabled={!!ocupado || !sucio} onClick={guardar}>{ocupado === 'guardar' ? 'Guardando…' : 'Guardar cambios'}</button> : null}
          </div>
        </div>
        {edicion ? <p className="mu note">Copia guardada del informe tal como se generó: no cambia aunque cambien los datos. {envio.datos?.estado === 'Pendiente de envío' ? COLA : ''}</p> : null}

        <div className="row fade inf-fila">
          <section className="card pv inf-pv" aria-label="Vista previa del informe">
            {datos.error ? <p className="mu" style={{ padding: '40px 0' }}>No se pudo armar el informe: {datos.error}</p>
              : !vista ? <p className="mu" style={{ padding: '40px 0' }}>{datos.cargando || envio.cargando ? 'Armando el informe…' : 'No hay datos para este informe.'}</p>
                : <LimiteInforme key={envioId ?? `vivo-${vista.generado_en}`} titulo={edicion ? EDICION_ILEGIBLE : 'Este informe no se puede mostrar'}
                    detalle={edicion ? undefined : 'El documento no se pudo armar con estos datos. Revisa la configuración o vuelve a intentarlo.'}>
                    <Informe datos={vista} textos={textos} />
                  </LimiteInforme>}
          </section>

          {!edicion ? (
            <div className="col inf-panel">
              {ro ? <p className="mu note">Tu rol en esta campaña permite ver y descargar el informe, no cambiarlo.</p> : <p className="mu">El periodo, el modo, los ejes y las muestras cambian las cifras al guardar. La portada, las secciones y los textos se ven al instante.</p>}
              <section className="card">
                <h2>Portada</h2>
                <div className="fld"><label className="kl" htmlFor="inf-nombre">Nombre del reporte</label><input id="inf-nombre" className="ta" value={form.nombre} disabled={ro} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} /></div>
                <div className="fld"><label className="kl" htmlFor="inf-tit">Título</label><input id="inf-tit" className="ta" value={cfg.titulo ?? ''} placeholder={form.nombre} disabled={ro} onChange={(e) => set({ titulo: e.target.value })} /></div>
                <div className="fld"><label className="kl" htmlFor="inf-sub">Subtítulo</label><input id="inf-sub" className="ta" value={cfg.subtitulo ?? ''} disabled={ro} onChange={(e) => set({ subtitulo: e.target.value })} /></div>
                <div className="fld"><label className="kl" htmlFor="inf-np">Nota de portada</label><textarea id="inf-np" className="ta" rows={2} value={cfg.nota_portada ?? ''} disabled={ro} onChange={(e) => set({ nota_portada: e.target.value })} /></div>
                <div className="fila2">
                  <div className="fld"><label className="kl" htmlFor="inf-fi">Fecha del informe</label><input id="inf-fi" type="date" className="sel" value={cfg.fecha_informe ?? ''} disabled={ro} onChange={(e) => set({ fecha_informe: e.target.value || undefined })} /></div>
                  <div className="fld"><label className="kl" htmlFor="inf-nv">Versión</label><input id="inf-nv" className="ta" value={cfg.nota_version ?? ''} placeholder="Versión 1" disabled={ro} onChange={(e) => set({ nota_version: e.target.value })} /></div>
                </div>
              </section>

              <section className="card">
                <h2>Periodo y modo</h2>
                <div className="fld"><span className="kl">Modo</span>
                  <div className="seg" role="group" aria-label="Modo del informe">
                    {(['evento', 'tema'] as const).map((m) => <button key={m} type="button" className="pill" aria-pressed={(cfg.modo ?? 'evento') === m} disabled={ro} onClick={() => set({ modo: m })}>{m === 'evento' ? 'Impacto de un evento' : 'Tema en el tiempo'}</button>)}
                  </div>
                </div>
                {(cfg.modo ?? 'evento') === 'evento' ? (
                  <div className="fld"><label className="kl" htmlFor="inf-ev">Evento</label>
                    <select id="inf-ev" className="sel" value={cfg.evento_id ?? ''} disabled={ro} onChange={(e) => { const ev = eventos.datos.find((x) => x.id === e.target.value); setForm((f) => ({ ...f, cfg: ev ? configEvento(f.cfg, ev) : { ...f.cfg, evento_id: undefined } })); }}>
                      <option value="">Sin evento de la agenda</option>
                      {eventos.datos.map((e) => <option key={e.id} value={e.id}>{e.nombre}{e.fecha_inicio ? ` · ${fecha(e.fecha_inicio, 'corto')}` : ''}</option>)}
                    </select>
                    {evSel ? <span className="mu">Elegir un evento propone el día base (el anterior) y el periodo.</span> : null}
                  </div>
                ) : null}
                <div className="fila2">
                  <div className="fld"><label className="kl" htmlFor="inf-pi">Desde</label><input id="inf-pi" type="date" className="sel" value={fechaDe(cfg.periodo_inicio)} disabled={ro} onChange={(e) => set({ periodo_inicio: juntar(e.target.value, horaDe(cfg.periodo_inicio), z) })} /></div>
                  <div className="fld"><label className="kl" htmlFor="inf-pih">Hora</label><input id="inf-pih" type="time" className="sel" value={horaDe(cfg.periodo_inicio)} disabled={ro} onChange={(e) => set({ periodo_inicio: juntar(fechaDe(cfg.periodo_inicio), e.target.value, z) })} /></div>
                </div>
                <div className="fila2">
                  <div className="fld"><label className="kl" htmlFor="inf-pf">Hasta</label><input id="inf-pf" type="date" className="sel" value={fechaDe(cfg.periodo_fin)} disabled={ro} onChange={(e) => set({ periodo_fin: juntar(e.target.value, horaDe(cfg.periodo_fin), z) })} /></div>
                  <div className="fld"><label className="kl" htmlFor="inf-pfh">Hora (excluida)</label><input id="inf-pfh" type="time" className="sel" value={horaDe(cfg.periodo_fin)} disabled={ro} onChange={(e) => set({ periodo_fin: juntar(fechaDe(cfg.periodo_fin), e.target.value, z) })} /></div>
                </div>
                <span className="mu">Sin hora: el día completo. Máximo 93 días. Hora de {z.split('/').pop()?.replace(/_/g, ' ')}.</span>
                {(cfg.modo ?? 'evento') === 'evento' ? (
                  <>
                    <div className="fila2">
                      <div className="fld"><label className="kl" htmlFor="inf-db">Día base</label><input id="inf-db" type="date" className="sel" value={cfg.dia_base ?? ''} disabled={ro} onChange={(e) => set({ dia_base: e.target.value || undefined })} /></div>
                      <div className="fld"><label className="kl" htmlFor="inf-de">Día del evento</label><input id="inf-de" type="date" className="sel" value={cfg.dia_evento ?? ''} disabled={ro} onChange={(e) => set({ dia_evento: e.target.value || undefined })} /></div>
                    </div>
                    <div className="fila2">
                      <div className="fld"><label className="kl" htmlFor="inf-vi">Evento desde</label><input id="inf-vi" type="time" className="sel" value={horaDe(cfg.ventana_evento?.inicio)} disabled={ro || !(cfg.dia_evento ?? evSel?.fecha_inicio)} onChange={(e) => { const dia = cfg.dia_evento ?? fechaDe(evSel?.fecha_inicio ?? ''); const ini = juntar(dia, e.target.value, z); set({ ventana_evento: ini && e.target.value ? { inicio: ini, fin: cfg.ventana_evento?.fin ?? ini, estimada: cfg.ventana_evento?.estimada ?? true } : undefined }); }} /></div>
                      <div className="fld"><label className="kl" htmlFor="inf-vf">hasta</label><input id="inf-vf" type="time" className="sel" value={horaDe(cfg.ventana_evento?.fin)} disabled={ro || !cfg.ventana_evento} onChange={(e) => { if (!cfg.ventana_evento) return; const fin = juntar(fechaDe(cfg.ventana_evento.inicio), e.target.value, z); set({ ventana_evento: { ...cfg.ventana_evento, fin: fin ?? cfg.ventana_evento.inicio } }); }} /></div>
                    </div>
                    {cfg.ventana_evento ? <label className="ck"><input type="checkbox" checked={!!cfg.ventana_evento.estimada} disabled={ro} onChange={(e) => set({ ventana_evento: { ...cfg.ventana_evento!, estimada: e.target.checked } })} /> <span className="sm">Hora estimada</span></label> : null}
                  </>
                ) : null}
              </section>

              <section className="card">
                <h2>Ejes</h2>
                {!ejes.datos.length ? <p className="mu">La campaña todavía no tiene ejes: el informe cuenta todo lo recolectado.</p> : (cfg.modo ?? 'evento') === 'evento' ? (
                  <>
                    {([['eje_conversacion', 'Conversación (sobre la figura o el evento)'], ['eje_foco', 'Foco (sobre el evento)']] as const).map(([k, t]) => (
                      <div className="fld" key={k}><label className="kl" htmlFor={`inf-${k}`}>{t}</label>
                        <select id={`inf-${k}`} className="sel" value={(cfg[k] as string | undefined) ?? ''} disabled={ro} onChange={(e) => set({ [k]: e.target.value || undefined } as Partial<InformeConfig>)}>
                          <option value="">Sin eje</option>
                          {ejes.datos.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                        </select>
                      </div>
                    ))}
                    <div className="fld"><label className="kl" htmlFor="inf-cmp">Comparación</label>
                      <select id="inf-cmp" className="sel" value={cfg.comparacion?.eje_id ?? ''} disabled={ro} onChange={(e) => set({ comparacion: e.target.value ? { eje_id: e.target.value, etiqueta: cfg.comparacion?.etiqueta } : undefined })}>
                        <option value="">Sin comparación</option>
                        {ejes.datos.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                      </select>
                      {cfg.comparacion ? <input className="ta" aria-label="Rótulo de la comparación" value={cfg.comparacion.etiqueta ?? ''} placeholder="Rótulo, p. ej. Nombra al medio anfitrión" disabled={ro} onChange={(e) => set({ comparacion: { ...cfg.comparacion!, etiqueta: e.target.value || undefined } })} /> : null}
                    </div>
                  </>
                ) : (
                  <div className="cks">
                    {ejes.datos.map((e) => <label className="ck" key={e.id}><input type="checkbox" checked={ejesSel.includes(e.id)} disabled={ro} onChange={() => set({ ejes: alternar(ejesSel, e.id) })} /> <span className="sm">{e.nombre}</span></label>)}
                    <span className="mu">{ejesSel.length ? `${ejesSel.length} de ${ejes.datos.length} ejes.` : 'Ninguno marcado: entran todos los ejes de la campaña.'}</span>
                  </div>
                )}
              </section>

              <section className="card">
                <h2>Muestras</h2>
                {muestras.datos.length ? (
                  <div className="cks">
                    {muestras.datos.map((m) => <label className="ck" key={m.id}><input type="checkbox" checked={muestrasSel.includes(m.id)} disabled={ro} onChange={() => set({ muestras: alternar(muestrasSel, m.id) })} /> <span className="sm">{m.nombre}{m.tamano != null ? ` · ${m.tamano}` : ''}</span></label>)}
                    <span className="mu">{muestrasSel.length ? `${muestrasSel.length} de ${muestras.datos.length} muestras.` : 'Ninguna marcada: entran todas.'}</span>
                  </div>
                ) : <p className="mu">Sin muestras codificadas en la campaña: la sección de sentimiento queda vacía.</p>}
              </section>

              <section className="card">
                <div className="ch"><h2>Secciones y textos</h2><span className="mu">{secciones.filter((s) => s.activa).length} de {SECCIONES.length}</span></div>
                <div className="list">
                  {secciones.map((s) => {
                    const auto = vista ? textoAuto(vista, s.id) : '';
                    const propio = (cfg.secciones ?? []).find((x) => x.id === s.id)?.texto;
                    const valor = propio ?? auto;
                    return (
                      <div className="li inf-sl" key={s.id}>
                        <div className="inf-slh">
                          <button type="button" className="tg" aria-pressed={s.activa} aria-label={(s.activa ? 'Quitar ' : 'Incluir ') + s.titulo} disabled={ro} onClick={() => cambiarSeccion(s.id, { activa: !s.activa })} />
                          <span className={s.activa ? 'sm b' : 'sm off'} style={{ flex: 1 }}>{s.titulo}</span>
                          {propio != null && propio !== auto && !ro ? <button type="button" className="lkb" onClick={() => cambiarSeccion(s.id, { texto: undefined })}>Usar automático</button> : null}
                        </div>
                        {s.activa ? (
                          <>
                            <textarea className="ta" rows={s.id === 'resumen' ? 7 : 3} aria-label={`Texto de ${s.titulo}`} value={valor} disabled={ro}
                              placeholder={s.id === 'metodologia' ? 'Notas de quien analiza sobre la recolección y sus límites.' : 'Sin hallazgos automáticos: escribe el texto de la sección.'}
                              onChange={(e) => cambiarSeccion(s.id, { texto: e.target.value })} />
                            <span className="mu">{propio != null && propio !== auto ? 'Texto editado.' : s.id === 'metodologia' ? 'El resto de la sección se arma con el registro de recolecciones, ejes y muestras.' : 'Hallazgos automáticos con las cifras actuales.'}{s.id === 'resumen' ? ' Un hallazgo por línea.' : ' Una línea vacía separa párrafos.'}</span>
                          </>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
              {!ro ? <p className="mu note">"Generar edición" guarda una copia congelada en el historial, pendiente de envío. {COLA}</p> : null}
            </div>
          ) : null}
        </div>
      </main>
    </Carga>
  );
}
