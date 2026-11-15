// Editor de un reporte programado (o nuevo): secciones, vista previa con datos actuales, programación, destinatarios y marca.
// Los cambios se guardan en `reportes` con "Guardar cambios"; "Guardar como plantilla" crea una fila en `reporte_plantillas`.
import { useMemo, useState } from 'react';
import { hoyDe, useCampana, useRol } from '../../shell/Campana';
import { useSesion } from '../../shell/Sesion';
import { useAcciones } from '../../shell/Acciones';
import { useConsulta } from '../../lib/hooks';
import { db } from '../../lib/db';
import { fecha, rango } from '../../lib/formato';
import type { Evento, Persona, Reporte, ReportePlantilla } from '../../lib/tipos';
import { Documento, imprimir, paginas } from './Documento';
import {
  ANALISIS_TIPO, DIAS_SEMANA, FORMATOS_DEST, FRECUENCIAS, SECCIONES_TIPO, TABLAS_DOC, TIPOS_REPORTE,
  cargarDatos, construir, eventoPorDefecto, type Contenido, type SeccionCfg,
} from './documento';
import { contarDest, listasDe, marcaDe, nombreDest, pieDe, proximoEnvio, textoProgramacion, type Destinatario } from './util';

interface Form {
  nombre: string; tipo: string; frecuencia: string; hora: string; dia: string; destinatarios: Destinatario[]; secciones: SeccionCfg[];
  requiere_aprobacion: boolean; marca: 'Consultora' | 'Cliente'; confidencial: boolean; seccion_analisis: string; texto_analisis: string; evento_id: string | null;
}
const PROGRAMA: Record<string, { frecuencia: string; hora: string; dia: string }> = {
  'Corte diario': { frecuencia: 'Diario', hora: '07:00', dia: 'lunes' },
  'Semanal de narrativas': { frecuencia: 'Semanal', hora: '08:00', dia: 'lunes' },
  'Post-evento': { frecuencia: 'Por evento', hora: '', dia: 'lunes' },
  'A la medida': { frecuencia: 'Una vez', hora: '', dia: 'lunes' },
};
const ETIQ_FREC: Record<string, string> = { Diario: 'Diario', Semanal: 'Semanal', 'Por evento': 'Por evento', 'Una vez': 'Una vez' };
const ETIQ_TIPO: Record<string, string> = { 'Corte diario': 'Diario', 'Semanal de narrativas': 'Semanal', 'Post-evento': 'Post-evento', 'A la medida': 'A la medida' };

function textoPrevio(previo: Contenido | null, id: string): string {
  return previo?.secciones?.find((s) => s.id === id)?.texto ?? '';
}
function seccionesBase(tipo: string, plantillas: ReportePlantilla[]): SeccionCfg[] {
  const p = plantillas.find((x) => x.tipo === tipo && x.etiqueta === 'Base') ?? null;
  const l = (p?.secciones as SeccionCfg[] | undefined) ?? SECCIONES_TIPO[tipo] ?? SECCIONES_TIPO['A la medida'];
  return l.map((s) => ({ id: s.id, titulo: s.titulo, ia: !!s.ia, activa: true }));
}
function inicial(r: Reporte | null, p: ReportePlantilla | null, previo: Contenido | null, plantillas: ReportePlantilla[]): Form {
  if (r) {
    const ana = r.extra?.seccion_analisis ?? ANALISIS_TIPO[r.tipo] ?? '';
    return {
      nombre: r.nombre, tipo: r.tipo, frecuencia: r.frecuencia ?? 'Una vez', hora: r.hora ?? '', dia: r.extra?.dia ?? 'lunes',
      destinatarios: (r.destinatarios as Destinatario[]) ?? [], secciones: (r.secciones as SeccionCfg[]).map((s) => ({ ...s, activa: s.activa !== false })),
      requiere_aprobacion: r.requiere_aprobacion, marca: r.extra?.marca === 'Cliente' ? 'Cliente' : 'Consultora', confidencial: r.extra?.confidencial !== false,
      seccion_analisis: ana, texto_analisis: r.extra?.texto_analisis ?? textoPrevio(previo, ana), evento_id: r.evento_id,
    };
  }
  const tipo = p?.tipo ?? 'Corte diario';
  const prog = PROGRAMA[tipo] ?? PROGRAMA['A la medida'];
  return {
    nombre: p?.nombre ?? 'Reporte sin título', tipo, ...prog, destinatarios: [],
    secciones: p ? (p.secciones as SeccionCfg[]).map((s) => ({ id: s.id, titulo: s.titulo, ia: !!s.ia, activa: true })) : seccionesBase(tipo, plantillas),
    requiere_aprobacion: tipo !== 'Corte diario', marca: p?.marca ?? 'Consultora', confidencial: true, seccion_analisis: ANALISIS_TIPO[tipo] ?? '', texto_analisis: '', evento_id: null,
  };
}

export interface PropsEditor {
  reporte: Reporte | null; plantilla: ReportePlantilla | null; plantillas: ReportePlantilla[]; reportes: Reporte[];
  previo: Contenido | null; personas: Persona[]; eventos: Evento[];
  volver: () => void; abrir: (id: string) => void; enviarAhora: (r: Reporte) => Promise<void>; ocupado: string | null;
}

export function Editor({ reporte, plantilla, plantillas, reportes, previo, personas, eventos, volver, abrir, enviarAhora, ocupado }: PropsEditor) {
  const campana = useCampana();
  const cid = campana.id;
  const hoy = hoyDe(campana);
  const zona = campana.zona_horaria;
  const { puedeEditar } = useRol();
  const { org } = useSesion();
  const { aviso } = useAcciones();
  const listas = listasDe(campana);
  const base = useMemo(() => inicial(reporte, plantilla, previo, plantillas), [reporte, plantilla, previo, plantillas]);
  const [form, setForm] = useState<Form>(base);
  const [guardando, setGuardando] = useState(false);
  const [plantillaGuardada, setPlantillaGuardada] = useState(false);
  const sucio = JSON.stringify(form) !== JSON.stringify(base);
  const nuevo = !reporte;
  const ro = !puedeEditar;
  const cambiar = (c: Partial<Form>) => setForm((f) => ({ ...f, ...c }));

  const datos = useConsulta(
    () => cargarDatos(campana, hoy, { eventoId: form.evento_id, conEvento: form.tipo === 'Post-evento' }),
    [cid, hoy, form.evento_id, form.tipo], null, TABLAS_DOC,
  );
  const contenido = datos.datos ? construir(datos.datos, {
    tipo: form.tipo, nombre: form.nombre || 'Reporte', secciones: form.secciones, marca: form.marca,
    analisis: form.seccion_analisis ? { id: form.seccion_analisis, texto: form.texto_analisis } : null, previo,
  }) : null;
  const pags = contenido ? paginas(contenido) : [];
  const marca = marcaDe(form.marca, campana, org);
  const pie = pieDe(form.marca, form.confidencial, campana, org);
  const activas = form.secciones.filter((s) => s.activa !== false);
  const anaSec = form.secciones.find((s) => s.id === form.seccion_analisis) ?? null;
  const totalDest = contarDest(form.destinatarios, listas);

  if (!nuevo && !reporte) {
    return (
      <main className="page pg-reportes">
        <div className="card vacio"><h2>Este reporte ya no existe</h2><div className="mu"><button type="button" className="lkb" onClick={volver}>Volver a reportes</button></div></div>
      </main>
    );
  }

  const cambiarTipo = (tipo: string) => {
    const prog = PROGRAMA[tipo] ?? PROGRAMA['A la medida'];
    const ana = ANALISIS_TIPO[tipo] ?? '';
    cambiar({ tipo, secciones: seccionesBase(tipo, plantillas), seccion_analisis: ana, texto_analisis: '', frecuencia: prog.frecuencia, hora: prog.hora || form.hora, evento_id: null });
  };
  const ciclar = (i: number) => {
    const l = [...form.destinatarios];
    const k = FORMATOS_DEST.indexOf((l[i].formato ?? FORMATOS_DEST[0]) as typeof FORMATOS_DEST[number]);
    l[i] = { ...l[i], formato: FORMATOS_DEST[(k + 1) % FORMATOS_DEST.length] };
    cambiar({ destinatarios: l });
  };
  const agregar = (v: string) => {
    if (!v) return;
    const [k, id] = [v.slice(0, 2), v.slice(2)];
    cambiar({ destinatarios: [...form.destinatarios, k === 'l:' ? { lista: id, formato: 'Correo con PDF' } : { persona_id: id, formato: 'Correo con PDF' }] });
  };
  const opcionesDest = [
    ...listas.filter((l) => !form.destinatarios.some((d) => d.lista === l.id)).map((l) => ({ v: `l:${l.id}`, t: `Lista "${l.nombre}"${l.personas != null ? ` · ${l.personas} personas` : ''}` })),
    ...personas.filter((p) => p.activa && p.rol_org !== 'externo' && !form.destinatarios.some((d) => d.persona_id === p.id)).map((p) => ({ v: `p:${p.id}`, t: p.nombre })),
  ];
  const proximosEventos = eventos.filter((e) => e.estado !== 'Cancelado' && e.fecha_inicio && e.fecha_inicio > hoy);
  const eventoAuto = datos.datos?.evento ?? (form.tipo === 'Post-evento' ? eventoPorDefecto(eventos, hoy) : null);

  async function guardar() {
    setGuardando(true);
    try {
      const prog = !reporte || reporte.frecuencia !== form.frecuencia || (reporte.hora ?? '') !== form.hora || (reporte.extra?.dia ?? 'lunes') !== form.dia;
      const evProx = form.frecuencia === 'Por evento' ? proximosEventos[0] ?? null : null;
      const hora = form.frecuencia === 'Diario' || form.frecuencia === 'Semanal' ? form.hora || '07:00' : form.hora || null;
      const extra: Record<string, unknown> = { ...(reporte?.extra ?? {}), marca: form.marca, confidencial: form.confidencial, seccion_analisis: form.seccion_analisis || undefined };
      if (form.texto_analisis.trim() && form.texto_analisis !== textoPrevio(previo, form.seccion_analisis)) extra.texto_analisis = form.texto_analisis;
      else delete extra.texto_analisis;
      if (form.frecuencia === 'Semanal') extra.dia = form.dia; else delete extra.dia;
      if (prog) {
        extra.descripcion = textoProgramacion(form.frecuencia, hora, form.dia);
        if (evProx) extra.proximo_evento_id = evProx.id; else delete extra.proximo_evento_id;
        if (form.frecuencia !== 'Diario') { delete extra.borrador_hora; delete extra.borrador_cierre; }
      }
      const fila: Partial<Reporte> = {
        nombre: form.nombre.trim() || 'Reporte sin título', tipo: form.tipo, frecuencia: form.frecuencia, hora,
        destinatarios: form.destinatarios as Reporte['destinatarios'], secciones: form.secciones as Reporte['secciones'],
        requiere_aprobacion: form.requiere_aprobacion, evento_id: form.tipo === 'Post-evento' ? form.evento_id : null, extra,
      };
      if (prog) fila.proximo_envio = proximoEnvio(form.frecuencia, hora, form.dia, hoy, zona, evProx?.fecha_fin ?? evProx?.fecha_inicio);
      if (reporte) {
        await db.cambiar('reportes', reporte.id, fila);
        aviso('Cambios guardados.');
      } else {
        const r = await db.crear<Reporte>('reportes', {
          ...fila, campana_id: cid, formato: 'PDF', estado: 'Activo', plantilla_id: plantilla?.id ?? null,
          orden: Math.max(0, ...reportes.map((x) => x.orden)) + 1,
        });
        if (plantilla) await db.cambiar('reporte_plantillas', plantilla.id, { usos: (plantilla.usos ?? 0) + 1 }).catch(() => {});
        aviso(`Reporte "${r.nombre}" creado.`);
        abrir(r.id);
      }
    } catch (e) {
      aviso(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }
  async function comoPlantilla() {
    try {
      await db.crear('reporte_plantillas', {
        campana_id: cid, nombre: form.nombre.trim() || 'Plantilla sin nombre', etiqueta: 'Tuya',
        descripcion: `Guardada desde el editor el ${fecha(hoy, 'medio')}, con ${activas.length} ${activas.length === 1 ? 'sección' : 'secciones'}.`,
        tipo: form.tipo, secciones: activas.map((s) => ({ id: s.id, titulo: s.titulo, ia: !!s.ia })), marca: form.marca,
        orden: Math.max(0, ...plantillas.map((p) => p.orden)) + 1,
      });
      setPlantillaGuardada(true);
      aviso('Guardada en Plantillas.');
    } catch (e) { aviso(e instanceof Error ? e.message : String(e)); }
  }
  const pdf = () => {
    if (!contenido) return;
    if (!imprimir({ contenido, marca, pie })) aviso('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para este sitio.');
  };

  const periodoTexto = form.tipo === 'Post-evento'
    ? (eventoAuto ? `Ventana del evento · ${eventoAuto.nombre}` : 'Sin evento ocurrido todavía')
    : reporte?.extra?.periodo_texto && !sucio ? reporte.extra.periodo_texto
      : [campana.periodo_inicio ? rango(campana.periodo_inicio, campana.periodo_fin) : null,
        datos.datos?.figura ? `${datos.datos.figura.nombre} frente a ${datos.datos.figuras.filter((f) => f.relacion === 'Rival').length} rivales` : null].filter(Boolean).join(' · ') || 'Periodo de la campaña';

  return (
    <main className="page pg-reportes">
      <div className="ph">
        <div>
          <button type="button" className="lkb" onClick={volver} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>Volver a reportes
          </button>
          <h1>{form.nombre || 'Reporte sin título'}</h1>
          <p className="mu">{form.tipo} · {pags.length} {pags.length === 1 ? 'página' : 'páginas'}{nuevo ? ' · sin guardar' : sucio ? ' · cambios sin guardar' : ''}</p>
        </div>
        <div className="acts" style={{ alignItems: 'center' }}>
          <button type="button" className="btn bg" onClick={pdf} disabled={!contenido || !pags.length}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>Descargar PDF
          </button>
          {!ro && reporte ? (
            <button type="button" className="btn bg" disabled={sucio || !!ocupado} title={sucio ? 'Guarda los cambios antes de enviar' : undefined} onClick={() => enviarAhora(reporte)}>
              {ocupado === `env-${reporte.id}` ? 'Poniendo en cola…' : 'Enviar ahora'}
            </button>
          ) : null}
          {!ro ? <button type="button" className="btn bp" disabled={guardando || (!nuevo && !sucio)} onClick={guardar}>{guardando ? 'Guardando…' : nuevo ? 'Crear reporte' : 'Guardar cambios'}</button> : null}
        </div>
      </div>

      <div className="row fade">
        <section className="card" style={{ flex: '1 1 200px', minWidth: 0, gap: 10 }}>
          <div className="ch"><h2>Secciones del reporte</h2><span className="mu">{activas.length} de {form.secciones.length}</span></div>
          <div className="list">
            {form.secciones.map((s, i) => {
              const on = s.activa !== false;
              return (
                <div className="li" key={s.id} style={{ padding: '8px 0', gap: 10 }}>
                  <button type="button" className="tg" aria-pressed={on} aria-label={(on ? 'Quitar ' : 'Incluir ') + s.titulo} disabled={ro}
                    onClick={() => cambiar({ secciones: form.secciones.map((x, j) => (j === i ? { ...x, activa: !on } : x)) })} />
                  <span className={on ? 'sm' : 'sm off'} style={{ flex: 1, minWidth: 0 }}>{s.titulo}</span>
                  {s.ia ? <span className="chip warn" title="Texto de análisis, revisar">IA</span> : null}
                </div>
              );
            })}
          </div>
          <p className="mu">Apagar una sección la quita de la vista previa, del PDF y del envío.</p>
        </section>

        <section className="card pv" aria-label="Vista previa del reporte" style={{ flex: '3 1 400px', minWidth: 0 }}>
          {datos.error ? <p className="mu" style={{ padding: '40px 0' }}>No se pudo armar la vista previa: {datos.error}</p>
            : !contenido ? <p className="mu" style={{ padding: '40px 0' }}>Armando la vista previa…</p>
              : pags.length ? <Documento contenido={contenido} marca={marca} pie={pie} />
                : <p className="mu" style={{ padding: '40px 0' }}>Todas las secciones están apagadas. Enciende al menos una para ver el reporte.</p>}
          <p className="mu" style={{ textAlign: 'center', maxWidth: 560 }}>Así lo recibe el destinatario, con los datos de hoy. Las notas internas, la bitácora de alertas y los aprendizajes no marcados como publicables nunca se exportan.</p>
        </section>

        <div className="col" style={{ flex: '1 1 280px', minWidth: 0 }}>
          <section className="card">
            <h2>Configuración</h2>
            <div className="fld"><label htmlFor="rep-nombre" className="kl">Nombre</label><input id="rep-nombre" className="ta" type="text" value={form.nombre} disabled={ro} onChange={(e) => cambiar({ nombre: e.target.value })} /></div>
            <div className="fld"><span className="kl">Tipo</span>
              <div className="seg" role="group" aria-label="Tipo de reporte">
                {TIPOS_REPORTE.map((t) => <button key={t} type="button" className="pill" aria-pressed={form.tipo === t} disabled={ro} onClick={() => form.tipo !== t && cambiarTipo(t)}>{ETIQ_TIPO[t]}</button>)}
              </div>
            </div>
            {form.tipo === 'Post-evento' ? (
              <div className="fld"><label htmlFor="rep-evento" className="kl">Evento cubierto</label>
                <select id="rep-evento" className="sel" value={form.evento_id ?? ''} disabled={ro} onChange={(e) => cambiar({ evento_id: e.target.value || null })}>
                  <option value="">El último evento ocurrido{eventoPorDefecto(eventos, hoy) ? ` (${eventoPorDefecto(eventos, hoy)!.nombre})` : ''}</option>
                  {eventos.filter((e) => e.fecha_inicio && e.fecha_inicio <= hoy).map((e) => <option key={e.id} value={e.id}>{e.nombre} · {fecha(e.fecha_inicio, 'corto')}</option>)}
                </select>
              </div>
            ) : null}
            <div className="fld"><span className="kl">Periodo y figuras</span><span className="sm">{periodoTexto}</span></div>
            <div className="fld"><span className="kl">Programación</span>
              <div className="seg" role="group" aria-label="Frecuencia de envío">
                {FRECUENCIAS.map((f) => <button key={f} type="button" className="pill" aria-pressed={form.frecuencia === f} disabled={ro} onClick={() => cambiar({ frecuencia: f, hora: form.hora || (f === 'Diario' || f === 'Semanal' ? '07:00' : '') })}>{ETIQ_FREC[f]}</button>)}
              </div>
              {form.frecuencia === 'Diario' || form.frecuencia === 'Semanal' ? (
                <div className="fila">
                  {form.frecuencia === 'Semanal' ? (
                    <select className="sel" aria-label="Día de envío" value={form.dia} disabled={ro} onChange={(e) => cambiar({ dia: e.target.value })}>
                      {DIAS_SEMANA.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  ) : null}
                  <input className="sel" type="time" aria-label="Hora de envío" value={form.hora} disabled={ro} onChange={(e) => cambiar({ hora: e.target.value })} />
                </div>
              ) : null}
              <span className="mu">{textoProgramacion(form.frecuencia, form.hora, form.dia)} Hora de {zona.split('/').pop()?.replace(/_/g, ' ')}.</span>
            </div>
            {anaSec ? (
              <div className="fld">
                <label htmlFor="rep-texto" className="kl">Texto de análisis · {anaSec.titulo}</label>
                <textarea id="rep-texto" className="ta" rows={4} value={form.texto_analisis} disabled={ro} placeholder="Escribe el análisis que acompaña al reporte." onChange={(e) => cambiar({ texto_analisis: e.target.value })} />
                <span className="mu">{form.texto_analisis && form.texto_analisis === textoPrevio(previo, form.seccion_analisis) ? 'Borrador IA del último reporte, revisar. ' : ''}Lo que edites aquí cambia en la vista previa.</span>
              </div>
            ) : null}
          </section>

          <section className="card">
            <div className="ch"><h2>Destinatarios</h2><span className="mu">{totalDest} {totalDest === 1 ? 'persona' : 'personas'}</span></div>
            {form.destinatarios.length ? (
              <div className="list">
                {form.destinatarios.map((d, i) => {
                  const n = nombreDest(d, listas, personas);
                  return (
                    <div className="li" key={(d.lista ?? d.persona_id ?? d.email ?? '') + i} style={{ flexWrap: 'wrap', gap: '6px 10px', padding: '8px 0' }}>
                      <div className="gr" style={{ flex: '1 1 120px' }}><span className="sm b">{n.nombre}</span><span className="mu">{n.quien}</span></div>
                      <button type="button" className="chip ring fmt" disabled={ro} onClick={() => ciclar(i)} title="Cambiar formato">{d.formato ?? FORMATOS_DEST[0]}</button>
                      {!ro ? <button type="button" className="lkb" aria-label={`Quitar ${n.nombre}`} onClick={() => cambiar({ destinatarios: form.destinatarios.filter((_, j) => j !== i) })}>Quitar</button> : null}
                    </div>
                  );
                })}
              </div>
            ) : <p className="mu">Sin destinatarios todavía.</p>}
            {!ro && opcionesDest.length ? (
              <select className="sel" aria-label="Agregar destinatario" value="" onChange={(e) => agregar(e.target.value)}>
                <option value="">Agregar destinatario…</option>
                {opcionesDest.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
              </select>
            ) : null}
            <p className="mu">Toca el formato para cambiarlo: correo con PDF, enlace con acceso o resumen por WhatsApp.</p>
          </section>

          <section className="card">
            <h2>Marca y pie</h2>
            <div className="fld"><span className="kl">Logo y portada</span>
              <div className="seg" role="group" aria-label="Marca del reporte">
                {(['Consultora', 'Cliente'] as const).map((m) => <button key={m} type="button" className="pill" aria-pressed={form.marca === m} disabled={ro} onClick={() => cambiar({ marca: m })}>{m}</button>)}
              </div>
            </div>
            <div className="li" style={{ padding: 0, border: 0, gap: 10 }}><button type="button" className="tg" aria-pressed={form.confidencial} aria-label='Pie "Confidencial"' disabled={ro} onClick={() => cambiar({ confidencial: !form.confidencial })} /><span className="sm">Pie "Confidencial"</span></div>
            <div className="li" style={{ padding: 0, border: 0, gap: 10 }}><button type="button" className="tg" aria-pressed={form.requiere_aprobacion} aria-label="Requiere aprobación" disabled={ro} onClick={() => cambiar({ requiere_aprobacion: !form.requiere_aprobacion })} /><span className="sm">Requiere aprobación antes de enviar</span></div>
            {!ro ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingTop: 4 }}>
                <button type="button" className="btn bg" disabled={plantillaGuardada || !activas.length} onClick={comoPlantilla}>Guardar como plantilla</button>
                {plantillaGuardada ? <span className="mu fade" role="status">Guardada en Plantillas</span> : null}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}
