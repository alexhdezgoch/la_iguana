// Pestaña Ficha: datos del evento y mensajes clave con sus términos (alta, edición y baja en evento_mensajes).
import { useState } from 'react';
import { db } from '../../lib/db';
import { fecha, rango } from '../../lib/formato';
import { useAcciones } from '../../shell/Acciones';
import { useCampana } from '../../shell/Campana';
import { Confirmar } from '../../shell/Estados';
import { useTabla } from '../../lib/hooks';
import type { Evento, EventoMensaje, Narrativa, PersonaVisible } from '../../lib/tipos';
import { errorTexto, origenTexto, responsableEquipo, ventanasDe } from './util';

function terminosDe(s: string): string[] {
  return s.split(',').map((t) => t.trim()).filter(Boolean);
}

function FormMensaje({ inicial, guardar, cerrar }: { inicial?: EventoMensaje; guardar: (texto: string, terminos: string[]) => Promise<void>; cerrar: () => void }) {
  const [texto, setTexto] = useState(inicial?.texto ?? '');
  const [terminos, setTerminos] = useState((inicial?.terminos ?? []).join(', '));
  const [ocupado, setOcupado] = useState(false);
  return (
    <form
      className="ev-form fade"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!texto.trim()) return;
        setOcupado(true);
        try { await guardar(texto.trim(), terminosDe(terminos)); cerrar(); } finally { setOcupado(false); }
      }}
    >
      <label className="campo"><span>Mensaje</span><input className="entrada" name="mensaje" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Qué queremos que se repita" autoFocus /></label>
      <label className="campo"><span>Términos de búsqueda, separados por coma</span><input className="entrada" name="terminos" value={terminos} onChange={(e) => setTerminos(e.target.value)} placeholder="frase exacta, #hashtag" /></label>
      <div className="acts">
        <button type="submit" className="btn bp" disabled={ocupado || !texto.trim()}>{inicial ? 'Guardar cambios' : 'Añadir mensaje'}</button>
        <button type="button" className="btn bg" onClick={cerrar}>Cancelar</button>
      </div>
    </form>
  );
}

export function Ficha({ evento, mensajes, narrativas, puedeEditar, guardando, cancelar }: {
  evento: Evento; mensajes: EventoMensaje[]; narrativas: Narrativa[]; puedeEditar: boolean; guardando: boolean; cancelar: () => void;
}) {
  const campana = useCampana();
  const { aviso } = useAcciones();
  const [editando, setEditando] = useState<string | null>(null); // id del mensaje, o 'nuevo'
  const [confirmando, setConfirmando] = useState<string | null>(null); // id del mensaje a quitar, o 'cancelar'
  // Nombre visible del responsable: v_personas_campana sirve también al rol Cliente, que no lee personas.
  const responsable = useTabla<PersonaVisible>('v_personas_campana', { eq: { id: evento.responsable_id ?? '' }, limite: 1 }, !!evento.responsable_id);
  const { antes, despues } = ventanasDe(evento);
  const narrativa = narrativas.find((n) => n.id === evento.narrativa_id) ?? null;
  const region = typeof evento.extra?.estado_region === 'string' ? (evento.extra.estado_region as string) : null;
  const horaFin = typeof evento.extra?.hora_fin === 'string' ? (evento.extra.hora_fin as string) : null;

  const varios = evento.fecha_fin && evento.fecha_inicio && evento.fecha_fin !== evento.fecha_inicio;
  const filas: Array<[string, string | null]> = [
    ['Tipo y origen', `${evento.tipo} · ${origenTexto(evento.origen)}${evento.es_crisis ? ' · crisis' : ''}`],
    ['Fecha', evento.fecha_inicio ? (varios ? `${rango(evento.fecha_inicio, evento.fecha_fin)} de ${evento.fecha_inicio.slice(0, 4)}` : fecha(evento.fecha_inicio, 'completo')) : null],
    ['Hora', evento.hora ? (horaFin ? `${evento.hora} a ${horaFin}` : evento.hora) : null],
    ['Sede', [evento.sede, evento.ciudad].filter(Boolean).join(', ') || null],
    ['Ciudad y estado', [evento.ciudad, region].filter(Boolean).join(', ') || null],
    ['Objetivo', evento.objetivos],
    ['Narrativa a impulsar', narrativa?.nombre ?? null],
    ['Ventana de medición', `${antes} horas antes y ${despues} horas después`],
    ['Asistencia', evento.asistencia != null ? evento.asistencia.toLocaleString('en-US') + ' personas' : null],
    ['Responsable', evento.responsable_id ? (responsable.datos[0]?.nombre_corto ?? 'Equipo de la campaña') : responsableEquipo(evento.extra)],
  ];

  async function guardarMensaje(texto: string, terminos: string[], m?: EventoMensaje) {
    try {
      if (m) await db.cambiar<EventoMensaje>('evento_mensajes', m.id, { texto, terminos });
      else await db.crear<EventoMensaje>('evento_mensajes', { campana_id: campana.id, evento_id: evento.id, texto, terminos, orden: Math.max(0, ...mensajes.map((x) => x.orden)) + 1 });
      aviso(m ? 'Mensaje actualizado' : 'Mensaje añadido. Se mide cuando se procese la ventana del evento.');
    } catch (e) {
      aviso(errorTexto(e));
      throw e;
    }
  }
  async function quitar(m: EventoMensaje) {
    setConfirmando(null);
    try { await db.borrar('evento_mensajes', m.id); aviso('Mensaje quitado'); } catch (e) { aviso(errorTexto(e)); }
  }

  const cancelable = puedeEditar && (evento.estado === 'Borrador' || evento.estado === 'Programado' || evento.estado === 'En curso');

  return (
    <div className="row fade">
      <section className="card c1">
        <h2>Ficha del evento</h2>
        <div className="list">
          {filas.map(([l, v]) => (
            <div className="li" key={l} style={{ alignItems: 'baseline' }}>
              <span className="mu" style={{ flex: '0 0 150px' }}>{l}</span>
              <span className={v ? '' : 'mu'} style={{ flex: 1, minWidth: 0 }}>{v ?? 'Sin definir'}</span>
            </div>
          ))}
        </div>
        {cancelable ? (
          <div>
            {confirmando === 'cancelar'
              ? <Confirmar pregunta="¿Cancelar este evento? Se puede reprogramar después." si="Sí, cancelar" no="No, mantenerlo" ocupado={guardando} alConfirmar={() => { setConfirmando(null); cancelar(); }} alCancelar={() => setConfirmando(null)} />
              : <button type="button" className="enlace-btn" disabled={guardando} onClick={() => setConfirmando('cancelar')}>Cancelar evento</button>}
          </div>
        ) : null}
      </section>

      <section className="card c1">
        <div className="ch"><h2>Mensajes clave</h2><span className="mu">{mensajes.length ? `${mensajes.length} ${mensajes.length === 1 ? 'mensaje' : 'mensajes'}` : 'Ninguno todavía'}</span></div>
        {mensajes.length ? (
          <div className="list">
            {mensajes.map((m) => editando === m.id ? (
              <div className="li" key={m.id}><FormMensaje inicial={m} guardar={(t, ts) => guardarMensaje(t, ts, m)} cerrar={() => setEditando(null)} /></div>
            ) : (
              <div className="li" key={m.id}>
                <div className="gr"><span className="b">{m.texto}</span><span className="mu">{m.terminos.length ? `Términos: ${m.terminos.join(', ')}` : 'Sin términos de búsqueda'}</span></div>
                {puedeEditar ? (confirmando === m.id ? (
                  <Confirmar pregunta="¿Quitar este mensaje?" si="Sí, quitar" alConfirmar={() => quitar(m)} alCancelar={() => setConfirmando(null)} />
                ) : (
                  <div className="ev-mini">
                    <button type="button" className="enlace-btn" onClick={() => setEditando(m.id)} aria-label={`Editar ${m.texto}`}>Editar</button>
                    {m.menciones == null ? <button type="button" className="enlace-btn" onClick={() => setConfirmando(m.id)} aria-label={`Quitar ${m.texto}`}>Quitar</button> : null}
                  </div>
                )) : null}
              </div>
            ))}
          </div>
        ) : <p className="mu">Sin mensajes clave. Cada mensaje lleva sus propios términos y después del evento se mide cuánto lo repitieron terceros.</p>}
        {puedeEditar ? (editando === 'nuevo'
          ? <FormMensaje guardar={(t, ts) => guardarMensaje(t, ts)} cerrar={() => setEditando(null)} />
          : <div><button type="button" className="btn bg" onClick={() => setEditando('nuevo')}>Añadir mensaje</button></div>
        ) : null}
        <div className="well" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="mu">Hashtags oficiales</span>
          {evento.hashtags.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{evento.hashtags.map((h) => <span key={h} className="chip ring">{h}</span>)}</div>
          ) : <span className="sm">Sin hashtags oficiales.</span>}
        </div>
        {mensajes.length ? <p className="mu">Cada mensaje lleva sus propios términos de búsqueda. Después del evento se mide cuánto lo repitieron terceros.</p> : null}
      </section>
    </div>
  );
}
