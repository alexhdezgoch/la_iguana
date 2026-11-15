// Balance (eventos.veredicto), aprendizajes (eventos.aprendizajes) y notas del equipo (notas_internas, el rol Cliente no las ve).
import { useState } from 'react';
import { db } from '../../lib/db';
import { useTabla } from '../../lib/hooks';
import { cuando } from '../../lib/formato';
import { useAcciones } from '../../shell/Acciones';
import { hoyDe, useCampana, useRol } from '../../shell/Campana';
import { useSesion } from '../../shell/Sesion';
import type { Evento, NotaInterna, Persona } from '../../lib/tipos';
import { errorTexto } from './util';

/** Campo de texto largo que se guarda en una columna de eventos. */
function Editor({ valor, etiqueta, placeholder, guardar, cerrar }: { valor: string; etiqueta: string; placeholder: string; guardar: (v: string) => Promise<void>; cerrar: () => void }) {
  const [texto, setTexto] = useState(valor);
  const [ocupado, setOcupado] = useState(false);
  return (
    <form
      className="ev-form fade"
      onSubmit={async (e) => {
        e.preventDefault();
        setOcupado(true);
        try { await guardar(texto.trim()); cerrar(); } catch { /* el aviso ya se mostró */ } finally { setOcupado(false); }
      }}
    >
      <textarea className="ta" rows={3} aria-label={etiqueta} placeholder={placeholder} value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus />
      <div className="acts">
        <button type="submit" className="btn bp" disabled={ocupado || texto.trim() === valor.trim()}>Guardar</button>
        <button type="button" className="btn bg" onClick={cerrar}>Cancelar</button>
      </div>
    </form>
  );
}

function useGuardarEvento(evento: Evento) {
  const { aviso } = useAcciones();
  return async (cambios: Partial<Evento>, ok: string) => {
    try {
      await db.cambiar<Evento>('eventos', evento.id, cambios);
      aviso(ok);
    } catch (e) {
      aviso(errorTexto(e));
      throw e;
    }
  };
}

export function Balance({ evento, puedeEditar }: { evento: Evento; puedeEditar: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const guardar = useGuardarEvento(evento);
  const editor = abierto ? (
    <Editor valor={evento.veredicto ?? ''} etiqueta="Balance del evento" placeholder="En una o dos frases: quién ganó la conversación y qué mensaje aterrizó"
      guardar={(v) => guardar({ veredicto: v || null }, v ? 'Balance guardado' : 'Balance borrado')} cerrar={() => setAbierto(false)} />
  ) : null;

  if (evento.veredicto && !abierto) {
    return (
      <section className="card ev-balance">
        <div className="ch"><span className="ev-bl">Balance{evento.estado === 'En análisis' ? ' preliminar' : ''}</span>
          {puedeEditar ? <button type="button" className="enlace-btn ev-bl-btn" onClick={() => setAbierto(true)}>Editar</button> : null}
        </div>
        <p className="ev-bt">{evento.veredicto}</p>
      </section>
    );
  }
  return (
    <section className="card" style={{ gap: 8 }}>
      <div className="ch"><h2>Balance</h2>
        {puedeEditar && !abierto && evento.estado !== 'En curso' ? <button type="button" className="btn bg" onClick={() => setAbierto(true)}>Escribir balance</button> : null}
      </div>
      {editor ?? <span className="mu">{evento.estado === 'En curso' ? 'El evento sigue en curso. El balance se escribe al terminar.' : 'Todavía no hay balance del equipo para este evento.'}</span>}
    </section>
  );
}

export function Aprendizajes({ evento, puedeEditar, proximo }: { evento: Evento; puedeEditar: boolean; proximo: string | null }) {
  const [abierto, setAbierto] = useState(false);
  const guardar = useGuardarEvento(evento);
  const hay = !!evento.aprendizajes;
  return (
    <section className="card ev-aprend">
      <div className="gr" style={{ flex: '1 1 320px' }}>
        <h2>Aprendizajes</h2>
        {hay && !abierto ? <p className="ev-pre">{evento.aprendizajes}</p> : null}
        <span className="mu">{hay ? 'Alimentan el reporte post-evento.' : 'Aún no hay aprendizajes. Lo que se escriba aquí alimenta el reporte post-evento.'}</span>
        {abierto ? (
          <Editor valor={evento.aprendizajes ?? ''} etiqueta="Aprendizajes del evento" placeholder={`Qué funcionó, qué no y qué cambiamos${proximo ? ` para ${proximo}` : ''}`}
            guardar={(v) => guardar({ aprendizajes: v || null }, v ? 'Aprendizajes guardados' : 'Aprendizajes borrados')} cerrar={() => setAbierto(false)} />
        ) : null}
      </div>
      {puedeEditar && !abierto ? <button type="button" className="btn bg" onClick={() => setAbierto(true)}>{hay ? 'Editar' : 'Añadir aprendizajes'}</button> : null}
    </section>
  );
}

export function NotasEquipo({ evento, puedeEditar }: { evento: Evento; puedeEditar: boolean }) {
  const campana = useCampana();
  const hoy = hoyDe(campana);
  const { esCliente } = useRol();
  const { persona } = useSesion();
  const { aviso } = useAcciones();
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const notas = useTabla<NotaInterna>('notas_internas', { eq: { campana_id: campana.id, entidad: 'evento', entidad_id: evento.id }, orden: [['creada_en', 'desc']] }, !esCliente);
  const personas = useTabla<Persona>('personas', { eq: { org_id: campana.org_id } }, !esCliente);
  if (esCliente) return null;
  const nombre = (id: string | null) => personas.datos.find((p) => p.id === id)?.nombre ?? 'Equipo';

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    setOcupado(true);
    try {
      await db.crear<NotaInterna>('notas_internas', { campana_id: campana.id, entidad: 'evento', entidad_id: evento.id, texto: texto.trim(), autor_id: persona?.id ?? null });
      aviso('Nota guardada. Solo la ve el equipo.');
      setTexto(''); setAbierto(false);
    } catch (err) { aviso(errorTexto(err)); } finally { setOcupado(false); }
  }
  async function borrar(n: NotaInterna) {
    if (!window.confirm('¿Borrar esta nota?')) return;
    try { await db.borrar('notas_internas', n.id); aviso('Nota borrada'); } catch (err) { aviso(errorTexto(err)); }
  }

  return (
    <section className="card">
      <div className="ch">
        <h2>Notas del equipo</h2>
        {puedeEditar && !abierto ? <button type="button" className="btn bg" onClick={() => setAbierto(true)}>Añadir nota</button> : null}
      </div>
      <span className="mu">Solo las ve el equipo. No salen en exportaciones al cliente.</span>
      {abierto ? (
        <form className="ev-form fade" onSubmit={crear}>
          <textarea className="ta" rows={3} aria-label="Nota del equipo" placeholder="Contexto, pendientes o dudas sobre este evento" value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus />
          <div className="acts">
            <button type="submit" className="btn bp" disabled={ocupado || !texto.trim()}>Guardar nota</button>
            <button type="button" className="btn bg" onClick={() => { setAbierto(false); setTexto(''); }}>Cancelar</button>
          </div>
        </form>
      ) : null}
      {notas.error ? <p className="mu">{notas.error}</p> : notas.datos.length ? (
        <div className="list">
          {notas.datos.map((n) => (
            <div className="li" key={n.id} style={{ alignItems: 'flex-start' }}>
              <div className="gr">
                <span className="ev-pre">{n.texto}</span>
                <span className="mu">{nombre(n.autor_id)} · {cuando(n.creada_en, hoy, campana.zona_horaria)}</span>
              </div>
              {puedeEditar && n.autor_id === persona?.id ? <button type="button" className="enlace-btn" onClick={() => borrar(n)}>Borrar</button> : null}
            </div>
          ))}
        </div>
      ) : !abierto ? <p className="sm">Aún no hay notas del equipo.</p> : null}
    </section>
  );
}
