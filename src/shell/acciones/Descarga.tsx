// Panel "Descargar reporte": arma el documento con los datos reales de la campaña y lo entrega como archivo.
// PDF: abre el documento listo para imprimir (el navegador lo guarda como PDF). HTML y CSV: se descargan al instante.
// Se abre con useAcciones().abrirDescarga(tipo?) desde cualquier pantalla de una campaña; en la ficha de una figura
// o de un evento toma esa figura o ese evento.
import { useEffect, useRef, useState } from 'react';
import { Link, matchPath, useLocation } from 'react-router-dom';
import type { Panel } from '../Acciones';
import { hoyDe, useCampanas } from '../Campana';
import { useSesion } from '../Sesion';
import { useConsulta } from '../../lib/hooks';
import { db } from '../../lib/db';
import { fecha, rango } from '../../lib/formato';
import type { RolCampana } from '../../lib/tipos';
import { TABLAS_DOC, aCsv, cargarDatos, construir, descargar, nombreArchivo, type SeccionCfg } from '../../lib/reportes/documento';
import { documentoHtml, imprimir } from '../../lib/reportes/Documento';
import { marcaDe, pieDe } from '../../lib/reportes/marca';
import './Descarga.css';

type Tipo = 'Corte diario' | 'Post-evento' | 'Semanal' | 'Perfil de figura';
/** Secciones de descarga: texto fijo de la interfaz, cada una con la sección del documento que la arma. */
const SECS: Record<Tipo, Array<[string, string]>> = {
  'Corte diario': [['cifras', 'Indicadores del día'], ['alertas', 'Alertas abiertas'], ['narr', 'Narrativas en movimiento'], ['menciones', 'Menciones destacadas']],
  'Post-evento': [['balance', 'Balance del evento'], ['curva', 'Antes, durante y después'], ['gano', 'Quién ganó la conversación'], ['mensajes', 'Mensajes clave'], ['rivales', 'Reacciones de rivales'], ['publicaciones', 'Publicaciones destacadas']],
  Semanal: [['cifras', 'Indicadores del periodo'], ['part', 'Participación en la conversación'], ['temas', 'Temas'], ['narr', 'Narrativas'], ['eventos_semana', 'Eventos de la semana'], ['medios', 'Cobertura en medios']],
  'Perfil de figura': [['fig_cifras', 'Indicadores de la figura'], ['fig_sent', 'Sentimiento y riesgo'], ['narr', 'Narrativas'], ['medios', 'Cobertura en medios'], ['eventos_recientes', 'Eventos recientes'], ['rivales_comp', 'Comparación con rivales']],
};
const TIPOS = Object.keys(SECS) as Tipo[];
const TIPO_DOC: Record<Tipo, string> = { 'Corte diario': 'Corte diario', 'Post-evento': 'Post-evento', Semanal: 'Semanal de narrativas', 'Perfil de figura': 'Perfil de figura' };
const NOMBRE: Record<Tipo, string> = { 'Corte diario': 'Corte diario', 'Post-evento': 'Reporte post-evento', Semanal: 'Reporte semanal', 'Perfil de figura': 'Perfil de figura' };
type Formato = 'PDF' | 'HTML' | 'CSV';
const FORMATOS: Formato[] = ['PDF', 'HTML', 'CSV'];

function tipoDe(r: string | undefined, enEvento: boolean, enFigura: boolean): Tipo {
  if (r) {
    if ((TIPOS as string[]).includes(r)) return r as Tipo;
    if (/semanal/i.test(r)) return 'Semanal';
    if (/post/i.test(r)) return 'Post-evento';
    if (/figura|perfil/i.test(r)) return 'Perfil de figura';
    if (/diario|corte/i.test(r)) return 'Corte diario';
  }
  return enEvento ? 'Post-evento' : enFigura ? 'Perfil de figura' : 'Corte diario';
}
const Ico = ({ d, s = 16, w = 1.75 }: { d: string; s?: number; w?: number }) => (
  <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

export function Descarga({ panel, cerrar }: { panel: Panel; cerrar: () => void }) {
  const loc = useLocation();
  const { campanas } = useCampanas();
  const { org } = useSesion();
  const cid = matchPath('/c/:campanaId/*', loc.pathname)?.params.campanaId ?? matchPath('/c/:campanaId', loc.pathname)?.params.campanaId;
  const campana = campanas.find((c) => c.id === cid) ?? null;
  const figM = matchPath('/c/:c/figuras/:figuraId', loc.pathname)?.params.figuraId;
  const evM = matchPath('/c/:c/eventos/:eventoId', loc.pathname)?.params.eventoId;
  const figuraId = figM && figM !== 'nueva' ? figM : null;
  const eventoId = evM && evM !== 'nuevo' ? evM : null;
  const pedido = panel.tipo === 'descarga' ? panel.reporte : undefined;

  const [tipo, setTipo] = useState<Tipo>(() => tipoDe(pedido, !!eventoId, !!figuraId));
  const [formato, setFormato] = useState<Formato>('PDF');
  const [marcadas, setMarcadas] = useState<Set<string>>(() => new Set(SECS[tipoDe(pedido, !!eventoId, !!figuraId)].map(([id]) => id)));
  const [excluirNotas, setExcluirNotas] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<string | null>(null);
  const caja = useRef<HTMLDivElement>(null);

  const rol = useConsulta<RolCampana | null>(() => (campana ? db.rpc<RolCampana | null>('mi_rol', { p_campana: campana.id }) : Promise.resolve(null)), [campana?.id], null);
  const esCliente = rol.datos === 'Cliente';
  const conNotas = !excluirNotas && !esCliente;
  const hoy = hoyDe(campana);
  const datos = useConsulta(
    () => (campana ? cargarDatos(campana, hoy, { figuraId: tipo === 'Perfil de figura' ? figuraId : null, eventoId, conEvento: tipo === 'Post-evento', conNotas }) : Promise.resolve(null)),
    [campana?.id, hoy, tipo, figuraId, eventoId, conNotas], null, TABLAS_DOC,
  );

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', k);
    caja.current?.querySelector<HTMLElement>('[data-foco]')?.focus();
    return () => document.removeEventListener('keydown', k);
  }, [cerrar]);
  useEffect(() => { if (listo) caja.current?.querySelector<HTMLElement>('[data-foco-listo]')?.focus(); }, [listo]);

  const d = datos.datos;
  const sujeto = !campana ? '' : tipo === 'Perfil de figura' && d?.figura ? d.figura.nombre
    : tipo === 'Post-evento' ? (d?.evento?.nombre ?? 'Sin evento ocurrido todavía')
      : [d?.figura?.nombre, campana.contienda ?? campana.nombre].filter(Boolean).join(' · ');
  const periodo = !campana ? '' : tipo === 'Corte diario' ? `Hoy · ${fecha(hoy, 'dia')} de ${hoy.slice(0, 4)}`
    : tipo === 'Post-evento' ? (d?.evento ? `Ventana del evento · ${rango(d.evento.fecha_inicio, d.evento.fecha_fin)}` : 'Sin evento')
      : campana.periodo_inicio ? `Periodo · ${rango(campana.periodo_inicio, campana.periodo_fin)}` : 'Periodo de la campaña';
  const ayuda: Record<Formato, string> = {
    PDF: `Abre el documento listo para imprimir; en el diálogo elige "Guardar como PDF". Lleva portada y pie "Confidencial${campana ? ` · ${campana.nombre}` : ''}".`,
    HTML: 'Descarga el documento como página web: se abre sin conexión en cualquier navegador.',
    CSV: 'Descarga solo las cifras agregadas de las secciones elegidas, sin textos de menciones ni de análisis.',
  };

  const elegirTipo = (t: Tipo) => { setTipo(t); setMarcadas(new Set(SECS[t].map(([id]) => id))); setError(null); };
  const alternar = (id: string) => setMarcadas((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  function generar() {
    setError(null);
    if (!campana || !d) { setError('Los datos todavía se están cargando.'); return; }
    const secs: SeccionCfg[] = SECS[tipo].filter(([id]) => marcadas.has(id)).map(([id, titulo]) => ({ id, titulo, ia: false }));
    if (!secs.length) { setError('Elige al menos una sección.'); return; }
    if (conNotas) secs.push({ id: 'notas', titulo: 'Notas internas' });
    const contenido = construir(d, { tipo: TIPO_DOC[tipo], nombre: NOMBRE[tipo], secciones: secs, marca: 'Consultora', perfil: tipo === 'Perfil de figura' });
    const p = { contenido, marca: marcaDe('Consultora', campana, org), pie: pieDe('Consultora', true, campana, org) };
    const base = `${NOMBRE[tipo]} ${tipo === 'Perfil de figura' || tipo === 'Post-evento' ? sujeto : campana.nombre}`;
    try {
      if (formato === 'PDF') {
        if (!imprimir(p)) { setError('El navegador bloqueó la ventana nueva. Permite ventanas emergentes para este sitio y vuelve a intentarlo.'); return; }
        setListo(`Se abrió "${contenido.titulo}" en una ventana nueva, listo para imprimir o guardar como PDF${conNotas ? '' : ', sin notas internas'}.`);
      } else if (formato === 'HTML') {
        const n = nombreArchivo(base, hoy, 'html');
        descargar(n, documentoHtml(p), 'text/html;charset=utf-8');
        setListo(`Se descargó "${n}" con ${secs.length} ${secs.length === 1 ? 'sección' : 'secciones'}${conNotas ? '' : ', sin notas internas'}.`);
      } else {
        const n = nombreArchivo(base, hoy, 'csv');
        descargar(n, aCsv(contenido), 'text/csv;charset=utf-8');
        setListo(`Se descargó "${n}" con las cifras de ${secs.length} ${secs.length === 1 ? 'sección' : 'secciones'}.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="pg-descarga dl-back" onMouseDown={(e) => { if (e.target === e.currentTarget) cerrar(); }}>
      <div className="dl-modal" role="dialog" aria-modal="true" aria-label="Descargar reporte" ref={caja}>
        <div className="dl-mh">
          <div><h2>Descargar reporte</h2>{sujeto ? <p className="dl-mu">{sujeto}</p> : null}</div>
          <button type="button" className="dl-x" aria-label="Cerrar" onClick={cerrar}><Ico d="M18 6 6 18M6 6l12 12" w={2} /></button>
        </div>
        {!campana ? (
          <>
            <div className="dl-mb"><p className="dl-mu">Abre una campaña para descargar su reporte.</p></div>
            <div className="dl-mf"><button type="button" className="dl-bt dl-g" data-foco onClick={cerrar}>Cerrar</button></div>
          </>
        ) : listo ? (
          <>
            <div className="dl-mb" role="status">
              <div className="dl-done"><span><Ico d="m5 12 5 5 9-10" s={22} w={2} /></span><h2>Listo</h2><p className="dl-mu" style={{ maxWidth: 400 }}>{listo}</p></div>
            </div>
            <div className="dl-mf">
              <button type="button" className="dl-bt dl-g" onClick={() => setListo(null)}>Descargar otro</button>
              <Link className="dl-bt dl-g" to={`/c/${campana.id}/reportes`} onClick={cerrar}>Ir a Reportes</Link>
              <button type="button" className="dl-bt dl-p" data-foco-listo onClick={cerrar}>Cerrar</button>
            </div>
          </>
        ) : (
          <>
            <div className="dl-mb">
              <div className="dl-row">
                <label className="dl-f"><span className="dl-lb">Tipo</span>
                  <select className="dl-in" data-foco value={tipo} onChange={(e) => elegirTipo(e.target.value as Tipo)}>
                    {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <div className="dl-f"><span className="dl-lb">Periodo</span><div className="dl-in dl-ro">{periodo}</div></div>
              </div>
              <div className="dl-f"><span className="dl-lb">Formato</span>
                <div className="dl-sg" role="group" aria-label="Formato">
                  {FORMATOS.map((f) => <button key={f} type="button" aria-pressed={formato === f} onClick={() => setFormato(f)}>{f}</button>)}
                </div>
                <span className="dl-mu">{ayuda[formato]}</span>
              </div>
              <div className="dl-f"><span className="dl-lb">Secciones</span>
                <div className="dl-cks">
                  {SECS[tipo].map(([id, t]) => (
                    <label className="dl-ck" key={id}><input type="checkbox" checked={marcadas.has(id)} onChange={() => alternar(id)} /><span>{t}</span></label>
                  ))}
                </div>
              </div>
              <div className="dl-well">
                <label className="dl-ck"><input type="checkbox" checked={excluirNotas || esCliente} disabled={esCliente} onChange={(e) => setExcluirNotas(e.target.checked)} /><span className="dl-b">Excluir notas internas</span></label>
                <div className="dl-note"><Ico d="M7 11V7a5 5 0 0 1 10 0v4M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z" s={14} w={2} />
                  <span>{esCliente ? 'Tu rol es Cliente: las notas del equipo nunca salen en tus exportaciones.' : 'Activado por defecto. Si lo apagas, el documento suma una sección con las notas internas de la campaña.'}</span></div>
                <div className="dl-note"><Ico d="M12 16v-5M12 8h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" s={14} w={2} /><span>Nunca se exportan listas de autores: el reporte lleva cifras agregadas y publicaciones destacadas.</span></div>
              </div>
            </div>
            <div className="dl-mf">
              {error ? <span className="dl-err" role="alert">{error}</span> : datos.error ? <span className="dl-err" role="alert">{datos.error}</span> : null}
              <button type="button" className="dl-bt dl-g" onClick={cerrar}>Cancelar</button>
              <button type="button" className="dl-bt dl-p" disabled={!d} onClick={generar}>{d ? 'Generar' : 'Cargando datos…'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
