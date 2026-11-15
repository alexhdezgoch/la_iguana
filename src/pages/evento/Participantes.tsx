// Pestaña Participantes: figuras en el evento (evento_participantes). Solo se añaden figuras que ya están en seguimiento.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../../lib/db';
import { REL, iniciales, neto, num } from '../../lib/formato';
import { useAcciones } from '../../shell/Acciones';
import { useCampana } from '../../shell/Campana';
import { Icono } from '../../shell/Iconos';
import type { Evento, EventoParticipante, FiguraCampana } from '../../lib/tipos';
import { ROLES, errorTexto, midiendo } from './util';

export function Participantes({ evento, participantes, figuras, puedeEditar }: {
  evento: Evento; participantes: EventoParticipante[]; figuras: FiguraCampana[]; puedeEditar: boolean;
}) {
  const campana = useCampana();
  const base = `/c/${campana.id}`;
  const { aviso } = useAcciones();
  const [abierto, setAbierto] = useState(false);
  const [figuraId, setFiguraId] = useState('');
  const [rol, setRol] = useState('Invitada/o');
  const [ocupado, setOcupado] = useState(false);

  const porFigura = new Map(figuras.map((f) => [f.figura_id, f]));
  const disponibles = figuras.filter((f) => !participantes.some((p) => p.figura_id === f.figura_id));
  const medido = participantes.some((p) => p.menciones != null);

  async function anadir(e: React.FormEvent) {
    e.preventDefault();
    if (!figuraId) return;
    setOcupado(true);
    try {
      await db.crear<EventoParticipante>('evento_participantes', {
        campana_id: campana.id, evento_id: evento.id, figura_id: figuraId, rol, orden: Math.max(0, ...participantes.map((p) => p.orden)) + 1,
      });
      aviso(midiendo(evento.estado) ? 'Participante añadido. Sus cifras aparecen cuando se procese la ventana.' : 'Participante añadido');
      setAbierto(false); setFiguraId(''); setRol('Invitada/o');
    } catch (err) {
      aviso(errorTexto(err));
    } finally {
      setOcupado(false);
    }
  }
  async function cambiarRol(p: EventoParticipante, nuevo: string) {
    try { await db.cambiar<EventoParticipante>('evento_participantes', p.id, { rol: nuevo }); aviso('Rol actualizado'); } catch (err) { aviso(errorTexto(err)); }
  }
  async function quitar(p: EventoParticipante, nombre: string) {
    if (!window.confirm(`¿Quitar a ${nombre} del evento?`)) return;
    try { await db.borrar('evento_participantes', p.id); aviso('Participante quitado'); } catch (err) { aviso(errorTexto(err)); }
  }

  return (
    <div className="col fade">
      <div className="ch" style={{ alignItems: 'center' }}>
        <span className="mu">
          {participantes.length
            ? `${participantes.length} ${participantes.length === 1 ? 'participante' : 'participantes'}. Los rivales en el mismo escenario también cuentan.`
            : 'Sin participantes todavía. Los rivales en el mismo escenario también cuentan.'}
        </span>
        {puedeEditar && !abierto ? (
          <button type="button" className="btn bp" onClick={() => setAbierto(true)} disabled={!disponibles.length}><Icono n="mas" g={2} />Añadir participante</button>
        ) : null}
      </div>

      {abierto ? (
        <form className="card ev-form fade" onSubmit={anadir} aria-label="Añadir participante">
          <div className="ev-campos">
            <label className="campo"><span>Figura</span>
              <select className="entrada" name="figura" value={figuraId} onChange={(e) => setFiguraId(e.target.value)} autoFocus>
                <option value="">Elige una figura</option>
                {disponibles.map((f) => <option key={f.figura_id} value={f.figura_id}>{f.nombre} · {f.relacion}</option>)}
              </select>
            </label>
            <label className="campo"><span>Rol en el evento</span>
              <select className="entrada" name="rol" value={rol} onChange={(e) => setRol(e.target.value)}>
                {ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
            </label>
          </div>
          <div className="acts">
            <button type="submit" className="btn bp" disabled={ocupado || !figuraId}>Añadir</button>
            <button type="button" className="btn bg" onClick={() => setAbierto(false)}>Cancelar</button>
          </div>
        </form>
      ) : null}

      {participantes.length ? (
        <div className="tw"><div>
          <table style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th scope="col">Figura</th><th scope="col">Relación</th><th scope="col">Rol en el evento</th>
                <th scope="col" className="r">Menciones en la ventana</th><th scope="col" className="r">Sentimiento neto</th>
                {puedeEditar ? <th scope="col"><span className="vh">Acciones</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {participantes.map((p) => {
                const f = porFigura.get(p.figura_id);
                const nombre = f?.nombre ?? p.figura_id;
                const cls = f ? REL[f.relacion].cls : 'watch';
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="who">
                        <span className={`ini ${cls}`} aria-hidden="true">{f?.iniciales ?? iniciales(nombre)}</span>
                        <span className="gr">
                          {f ? <Link className="tl" to={`${base}/figuras/${f.figura_id}`}>{nombre}</Link> : <span className="b">{nombre}</span>}
                          <span className="mu">{[f?.partido, f?.coalicion].filter(Boolean).join(' · ') || 'Sin partido'}</span>
                        </span>
                      </div>
                    </td>
                    <td>{f ? <span className={`chip ${cls}`}>{f.relacion}</span> : <span className="mu">Fuera de seguimiento</span>}</td>
                    <td>
                      {puedeEditar ? (
                        <select className="entrada ev-rol" aria-label={`Rol de ${nombre}`} value={p.rol} onChange={(e) => cambiarRol(p, e.target.value)}>
                          {(ROLES.includes(p.rol) ? ROLES : [p.rol, ...ROLES]).map((r) => <option key={r}>{r}</option>)}
                        </select>
                      ) : p.rol}
                    </td>
                    <td className="r">{p.menciones != null ? num(p.menciones) : <span className="mu">Sin medir</span>}</td>
                    <td className="r">{p.neto != null ? <span className={p.neto >= 0 ? 'b tf' : 'b tu'}>{neto(p.neto)}</span> : <span className="mu">Sin medir</span>}</td>
                    {puedeEditar ? <td className="r"><button type="button" className="enlace-btn" onClick={() => quitar(p, nombre)} aria-label={`Quitar a ${nombre}`}>Quitar</button></td> : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div></div>
      ) : null}
      <p className="mu note">
        Solo se pueden añadir figuras que ya están en seguimiento en esta campaña.{' '}
        {puedeEditar && !disponibles.length ? <>Todas ya participan. <Link to={`${base}/figuras/nueva`}>Agregar una figura</Link>.</> : null}
        {!medido && participantes.length ? ' Las cifras por figura aparecen cuando se procesa la ventana de medición.' : ''}
      </p>
    </div>
  );
}
