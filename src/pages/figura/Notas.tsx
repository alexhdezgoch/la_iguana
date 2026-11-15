// Notas del equipo sobre una figura. Tabla notas_internas (entidad 'figura'). El rol Cliente no las ve:
// la pantalla no monta este bloque para Cliente y la base tampoco se las devuelve.
import { useState } from 'react';
import { db } from '../../lib/db';
import { useTabla } from '../../lib/hooks';
import { cuando } from '../../lib/formato';
import type { NotaInterna, Persona } from '../../lib/tipos';
import { useSesion } from '../../shell/Sesion';
import { useAcciones } from '../../shell/Acciones';

interface Props { campanaId: string; figuraId: string; hoy: string; zona: string; puedeEditar: boolean }

export function Notas({ campanaId, figuraId, hoy, zona, puedeEditar }: Props) {
  const { persona } = useSesion();
  const { aviso } = useAcciones();
  const notas = useTabla<NotaInterna>('notas_internas', { eq: { campana_id: campanaId, entidad: 'figura', entidad_id: figuraId }, orden: [['creada_en', 'desc']] });
  const autorIds = [...new Set(notas.datos.map((n) => n.autor_id).filter((x): x is string => !!x))];
  const autores = useTabla<Persona>('personas', { eq: { id: autorIds } }, autorIds.length > 0);
  const [texto, setTexto] = useState('');
  const [editando, setEditando] = useState<{ id: string; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const nombre = (id: string | null) => autores.datos.find((p) => p.id === id)?.nombre ?? 'Alguien del equipo';

  async function guardar() {
    const t = texto.trim();
    if (!t) return;
    setOcupado(true);
    try {
      await db.crear<NotaInterna>('notas_internas', { campana_id: campanaId, entidad: 'figura', entidad_id: figuraId, texto: t, autor_id: persona?.id ?? null });
      setTexto('');
      aviso('Nota guardada');
    } catch (e) {
      aviso(e instanceof Error ? e.message : String(e));
    } finally { setOcupado(false); }
  }
  async function cambiar() {
    if (!editando) return;
    const t = editando.texto.trim();
    if (!t) return;
    setOcupado(true);
    try {
      await db.cambiar<NotaInterna>('notas_internas', editando.id, { texto: t, actualizada_en: new Date().toISOString() });
      setEditando(null);
      aviso('Nota actualizada');
    } catch (e) {
      aviso(e instanceof Error ? e.message : String(e));
    } finally { setOcupado(false); }
  }
  async function borrar(id: string) {
    if (!window.confirm('¿Borrar esta nota? No se puede deshacer.')) return;
    try {
      await db.borrar('notas_internas', id);
      aviso('Nota borrada');
    } catch (e) {
      aviso(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <section className="card fg-notas" aria-label="Notas del equipo">
      <div className="ch">
        <h2>Notas del equipo{notas.datos.length ? ` · ${notas.datos.length}` : ''}</h2>
        <span className="mu">Solo las ve el equipo, no el cliente</span>
      </div>
      {notas.error ? <p className="error-txt">{notas.error}</p> : null}
      {puedeEditar ? (
        <div className="fg-nueva">
          <label className="campo">
            <span>Nueva nota</span>
            <textarea className="entrada fg-ta" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Contexto, acuerdos o seguimiento sobre esta figura" maxLength={2000} />
          </label>
          <div><button type="button" className="btn bp" disabled={ocupado || !texto.trim()} onClick={guardar}>Guardar nota</button></div>
        </div>
      ) : null}
      {notas.cargando ? <p className="mu">Cargando notas…</p> : notas.datos.length ? (
        <div className="list">
          {notas.datos.map((n) => {
            const mia = !!persona && n.autor_id === persona.id;
            const enEdicion = editando?.id === n.id;
            return (
              <div className="li fg-nota" key={n.id}>
                <div className="gr">
                  <span className="mu">{nombre(n.autor_id)} · {cuando(n.creada_en, hoy, zona)}{n.actualizada_en && n.actualizada_en !== n.creada_en ? ' · editada' : ''}</span>
                  {enEdicion ? (
                    <>
                      <textarea className="entrada fg-ta" rows={3} aria-label="Editar nota" value={editando.texto} onChange={(e) => setEditando({ id: n.id, texto: e.target.value })} maxLength={2000} />
                      <div className="fg-acc">
                        <button type="button" className="btn bp" disabled={ocupado || !editando.texto.trim()} onClick={cambiar}>Guardar cambios</button>
                        <button type="button" className="btn bg" onClick={() => setEditando(null)}>Cancelar</button>
                      </div>
                    </>
                  ) : <p className="fg-txt">{n.texto}</p>}
                </div>
                {puedeEditar && mia && !enEdicion ? (
                  <div className="fg-acc">
                    <button type="button" className="enlace-btn" onClick={() => setEditando({ id: n.id, texto: n.texto })}>Editar</button>
                    <button type="button" className="enlace-btn" onClick={() => borrar(n.id)}>Borrar</button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : <p className="mu">{puedeEditar ? 'Todavía no hay notas. Escribe la primera arriba.' : 'Todavía no hay notas del equipo sobre esta figura.'}</p>}
    </section>
  );
}
