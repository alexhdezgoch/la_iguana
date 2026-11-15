// Un envío del historial: la copia guardada del documento (reporte_envios.contenido) y su estado de entrega.
import { hoyDe, useCampana, useRol } from '../../shell/Campana';
import { useSesion } from '../../shell/Sesion';
import { useAcciones } from '../../shell/Acciones';
import { useNombres, useTabla } from '../../lib/hooks';
import type { Persona, Reporte, ReporteEnvio } from '../../lib/tipos';
import { Documento, imprimir, paginas } from '../../lib/reportes/Documento';
import type { Contenido } from '../../lib/reportes/documento';
import { COLA, ESTADO_ENVIO, marcaDe, momento, periodoEnvio, pieDe } from './util';

export function VerEnvio({ envio, reporte, volver, editar, aprobar, reenviar, ocupado }: {
  envio: ReporteEnvio | null; reporte: Reporte | null; volver: () => void; editar: (id: string) => void;
  aprobar: (e: ReporteEnvio) => Promise<void>; reenviar: (e: ReporteEnvio) => Promise<void>; ocupado: string | null;
}) {
  const campana = useCampana();
  const hoy = hoyDe(campana);
  const zona = campana.zona_horaria;
  const { puedeEditar } = useRol();
  const { org } = useSesion();
  const { aviso } = useAcciones();
  const personas = useTabla<Persona>('personas', { eq: { org_id: campana.org_id } });
  // Cliente no lee personas: quien aprobó sale de v_personas_campana.
  const { nombres } = useNombres();

  const atras = (
    <button type="button" className="lkb" onClick={volver} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>Volver a reportes
    </button>
  );
  if (!envio) {
    return <main className="page pg-reportes"><div className="ph"><div>{atras}<h1>Envío no disponible</h1><p className="mu">Puede que se haya borrado o que tu rol no lo vea.</p></div></div></main>;
  }
  const contenido = envio.contenido as Contenido;
  const conDoc = !!contenido?.secciones?.length;
  const pags = conDoc ? paginas(contenido) : [];
  const marca = marcaDe(contenido?.marca, campana, org);
  const pie = pieDe(contenido?.marca, reporte?.extra?.confidencial !== false, campana, org);
  const aprobo = personas.datos.find((p) => p.id === envio.aprobado_por)?.nombre ?? (envio.aprobado_por ? nombres.get(envio.aprobado_por)?.nombre_corto : undefined);
  const facts: Array<[string, string]> = [
    ['Periodo', periodoEnvio(envio.periodo_inicio, envio.periodo_fin, zona)],
    ['Generado', momento(envio.generado_en, hoy, zona)],
    ['Enviado', envio.enviado_en ? momento(envio.enviado_en, hoy, zona) : envio.estado === 'Pendiente de envío' ? 'En cola, sin enviar' : 'Sin enviar'],
    ['Entregados', `${envio.entregados ?? 0} de ${envio.destinatarios ?? 0}`],
  ];
  if (aprobo) facts.push(['Aprobado por', aprobo]);
  if (envio.extra?.nota) facts.push(['Nota', envio.extra.nota]);
  const accion = !puedeEditar ? null
    : envio.estado === 'En revisión' ? { t: 'Aprobar', f: () => aprobar(envio) }
      : envio.estado === 'Borrador' ? { t: 'Enviar', f: () => aprobar(envio) }
        : envio.estado === 'Pendiente de envío' ? null
          : { t: 'Reenviar', f: () => reenviar(envio) };

  return (
    <main className="page pg-reportes">
      <div className="ph">
        <div>
          {atras}
          <h1>{envio.titulo ?? reporte?.nombre ?? 'Reporte'}</h1>
          <p className="mu">{reporte?.tipo ?? 'Reporte'} · {conDoc ? `${pags.length} ${pags.length === 1 ? 'página' : 'páginas'}` : 'sin copia del documento'}</p>
        </div>
        <div className="acts" style={{ alignItems: 'center' }}>
          {conDoc ? (
            <button type="button" className="btn bg" onClick={() => { if (!imprimir({ contenido, marca, pie })) aviso('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para este sitio.'); }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>Descargar PDF
            </button>
          ) : null}
          {accion ? <button type="button" className="btn bp" disabled={!!ocupado} onClick={accion.f}>{accion.t}</button> : null}
        </div>
      </div>
      <div className="row fade">
        <section className="card" style={{ flex: '1 1 200px', minWidth: 0, gap: 10 }}>
          <div className="ch"><h2>Envío</h2><span className={ESTADO_ENVIO[envio.estado] ?? 'chip watch'}>{envio.estado}</span></div>
          <div className="list">
            {facts.map(([l, v]) => <div className="li" key={l} style={{ alignItems: 'baseline', padding: '8px 0' }}><span className="mu" style={{ flex: '0 0 96px' }}>{l}</span><span className="sm" style={{ flex: 1, minWidth: 0 }}>{v}</span></div>)}
          </div>
          {envio.estado === 'Pendiente de envío' ? <p className="mu">{COLA}</p> : null}
          {conDoc ? (
            <>
              <h2 style={{ paddingTop: 6 }}>Secciones</h2>
              <ol className="secs">{contenido.secciones!.map((s) => <li key={s.id}>{s.titulo}</li>)}</ol>
            </>
          ) : null}
          {reporte ? <div><button type="button" className="btn bg" onClick={() => editar(reporte.id)}>{puedeEditar ? 'Editar el reporte' : 'Ver el reporte'}</button></div> : null}
        </section>
        <section className="card pv" aria-label="Documento enviado" style={{ flex: '3 1 400px', minWidth: 0 }}>
          {conDoc ? <Documento contenido={contenido} marca={marca} pie={pie} /> : (
            <p className="mu" style={{ padding: '40px 0', maxWidth: 420, textAlign: 'center' }}>Este envío no guardó una copia del documento. Los envíos que se pongan en cola desde aquí guardan su copia.</p>
          )}
          {conDoc ? <p className="mu" style={{ textAlign: 'center', maxWidth: 560 }}>Copia guardada del documento tal como se generó.</p> : null}
        </section>
      </div>
    </main>
  );
}
