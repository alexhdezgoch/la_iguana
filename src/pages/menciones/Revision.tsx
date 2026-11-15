// Panel de revisión de una mención: corrección de sentimiento, importancia, nota del analista, revisar y descartar.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../../lib/db';
import { cuando } from '../../lib/formato';
import type { Mencion, MencionFigura, NotaInterna, Persona, PersonaVisible, Sentimiento } from '../../lib/tipos';
import { useAcciones } from '../../shell/Acciones';
import { useSesion } from '../../shell/Sesion';
import { useCampana } from '../../shell/Campana';
import { ahoraEn } from '../alertas/comun';
import { CHIP_IMP, IMPORTANCIAS, PUNTO, SENTIMIENTOS, TEXTO_IMP, estadoDe, type Importancia } from './comun';
import { urlSegura } from '../../lib/url';

export interface Borrador { sent?: Sentimiento | null; imp?: Importancia | null; nota?: string }

export function hayCambios(m: Mencion, b: Borrador | undefined, nota: NotaInterna | null): boolean {
  if (!b) return false;
  const sentGuardado = m.sentimiento_manual ?? m.sentimiento;
  return (b.sent !== undefined && b.sent !== sentGuardado)
    || (b.imp !== undefined && b.imp !== m.importancia)
    || (b.nota !== undefined && b.nota.trim() !== (nota?.texto ?? ''));
}

export function Revision({ m, borrador, setBorrador, figuras, nombres, tema, narrativa, evento, nota, personas, visibles, base, hoy, zona, puedeEditar, verNotas }: {
  m: Mencion;
  borrador: Borrador | undefined;
  setBorrador: (b: Borrador | undefined) => void;
  /** Filas de mencion_figuras de esta mención. */
  figuras: MencionFigura[];
  /** figura_id → nombre, de v_figuras_campana. */
  nombres: Map<string, string>;
  tema: string | null;
  narrativa: string | null;
  evento: { id: string; nombre: string } | null;
  nota: NotaInterna | null;
  personas: Map<string, Persona>;
  /** Nombres visibles (v_personas_campana): sirven también al rol Cliente, que no lee personas. */
  visibles: Map<string, PersonaVisible>;
  base: string;
  hoy: string;
  zona: string;
  puedeEditar: boolean;
  /** false para el rol Cliente: las notas internas no se le muestran. */
  verNotas: boolean;
}) {
  const { aviso } = useAcciones();
  const { persona } = useSesion();
  const [guardando, setGuardando] = useState(false);

  const b = borrador ?? {};
  const sent = b.sent !== undefined ? b.sent : (m.sentimiento_manual ?? m.sentimiento);
  const campana = useCampana();
  // Solo enlaces http(s): la fuente viene de los datos.
  const href = urlSegura(m.url);
  const imp = b.imp !== undefined ? b.imp : m.importancia;
  const textoNota = b.nota !== undefined ? b.nota : (nota?.texto ?? '');
  const cambios = hayCambios(m, borrador, nota);
  const est = estadoDe(m, cambios);
  const descartada = m.estado === 'Descartada';
  const editable = puedeEditar && !descartada;

  const ids = figuras.length ? figuras.map((f) => f.figura_id) : m.figura_id ? [m.figura_id] : [];
  const revisor = m.revisada_por ? (personas.get(m.revisada_por)?.nombre ?? visibles.get(m.revisada_por)?.nombre_corto) : undefined;

  const notaSent = !m.sentimiento
    ? 'Sin clasificación automática todavía. Elige el sentimiento según tu lectura.'
    : sent && sent !== m.sentimiento
      ? `Clasificación automática: ${m.sentimiento}. Corregida a ${sent}.`
      : 'Clasificación automática. Cámbiala si no coincide con tu lectura.';

  async function guardar() {
    setGuardando(true);
    // Reloj de la campaña (como las alertas): en la demo, "hoy" es la fecha de corte, no la fecha real.
    const ahora = ahoraEn(campana);
    try {
      const manual = sent && sent !== m.sentimiento ? sent : null;
      await db.cambiar('menciones', m.id, {
        sentimiento_manual: manual,
        importancia: imp ?? null,
        revisada: true,
        revisada_por: persona?.id ?? null,
        revisada_en: ahora,
      });
      // La figura principal lleva la misma corrección en mencion_figuras.
      const principal = figuras.find((f) => f.figura_id === m.figura_id);
      if (principal && principal.sentimiento_manual !== manual) await db.cambiar('mencion_figuras', principal.id, { sentimiento_manual: manual });
      if (verNotas) {
        const t = textoNota.trim();
        if (nota && t && t !== nota.texto) await db.cambiar('notas_internas', nota.id, { texto: t, actualizada_en: ahora });
        else if (nota && !t) await db.borrar('notas_internas', nota.id);
        else if (!nota && t) await db.crear('notas_internas', { campana_id: m.campana_id, entidad: 'mencion', entidad_id: m.id, texto: t, autor_id: persona?.id ?? null });
      }
      setBorrador(undefined);
      aviso(manual ? `Revisión guardada. Sentimiento corregido a ${manual}.` : 'Revisión guardada.');
    } catch (e) {
      aviso(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

  async function descartar() {
    setGuardando(true);
    try {
      await db.cambiar('menciones', m.id, { estado: 'Descartada', extra: { ...m.extra, estado_antes: m.estado } });
      setBorrador(undefined);
      aviso('Mención descartada. Queda en la vista Descartadas y no cuenta como pendiente.');
    } catch (e) {
      aviso(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

  async function restaurar() {
    setGuardando(true);
    try {
      const { estado_antes, ...resto } = m.extra ?? {};
      const previo = estado_antes === 'Por procesar' ? 'Por procesar' : 'Procesada';
      await db.cambiar('menciones', m.id, { estado: previo, extra: resto });
      aviso('Mención restaurada.');
    } catch (e) {
      aviso(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <aside className="card c2 rev" aria-label="Revisión de la mención">
      <div className="ch"><span className="chip own">Revisión</span><span className={est.cls}>{est.texto}</span></div>
      <h2 style={{ fontSize: 17, lineHeight: '24px' }}>{m.titulo ?? m.url ?? 'Mención sin título'}</h2>
      <p className="mu">{[m.fuente, m.canal, m.publicada_en ? cuando(m.publicada_en, hoy, zona) : 'sin fecha de publicación'].filter(Boolean).join(' · ')}</p>
      {m.resumen ? <p style={{ color: '#454E48' }}>{m.resumen}</p> : null}
      {m.estado === 'Por procesar' ? (
        <p className="well sm">{m.origen === 'Manual' ? 'Agregada a mano. ' : ''}En cola para procesar: el titular, la fecha y las cifras llegan cuando se procese el enlace.</p>
      ) : null}

      <div className="well" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="kl">Sentimiento para la figura</span>
        <div className="seg" role="group" aria-label="Sentimiento para la figura" style={{ alignSelf: 'flex-start', background: 'rgb(22 32 25 / .08)' }}>
          {SENTIMIENTOS.map((s) => (
            <button key={s} type="button" className="pill" aria-pressed={sent === s} disabled={!editable}
              onClick={() => setBorrador({ ...b, sent: s })} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span className={PUNTO[s]} />{s}
            </button>
          ))}
        </div>
        <span className="mu">{notaSent}</span>
      </div>

      <div className="dl">
        <div>
          <span className="kl">Importancia</span>
          {editable ? (
            <div className="seg imp" role="group" aria-label="Importancia">
              {IMPORTANCIAS.map((i) => (
                <button key={i} type="button" className="pill" aria-pressed={imp === i} onClick={() => setBorrador({ ...b, imp: i })}>{TEXTO_IMP[i]}</button>
              ))}
            </div>
          ) : imp ? <span className={CHIP_IMP[imp]} style={{ alignSelf: 'flex-start' }}>{TEXTO_IMP[imp]}</span> : <span className="b">Sin asignar</span>}
        </div>
        <div><span className="kl">Tema</span><span className="b">{tema ?? 'Sin tema'}</span></div>
        <div><span className="kl">Narrativa</span><span className="b">{narrativa ?? 'Sin narrativa'}</span></div>
        <div><span className="kl">Evento</span>{evento ? <Link className="tl" to={`${base}/eventos/${evento.id}`}>{evento.nombre}</Link> : <span className="b">Ninguno</span>}</div>
        <div style={{ flexBasis: '100%' }}>
          <span className="kl">Figuras nombradas</span>
          {ids.length ? (
            <span className="b">{ids.map((id, i) => (
              <span key={id}>{i ? ', ' : ''}<Link className="tl" to={`${base}/figuras/${id}`}>{nombres.get(id) ?? id}</Link></span>
            ))}</span>
          ) : <span className="b">Sin figuras</span>}
        </div>
      </div>

      {verNotas ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="nota-mencion" className="kl">Nota del analista</label>
          {editable ? (
            <textarea id="nota-mencion" className="ta" rows={3} placeholder="Por qué se corrige la clasificación" value={textoNota}
              onChange={(e) => setBorrador({ ...b, nota: e.target.value })} />
          ) : <p id="nota-mencion" className="sm">{nota?.texto ?? 'Sin nota.'}</p>}
          {nota ? <span className="mu">Nota interna de {personas.get(nota.autor_id ?? '')?.nombre ?? 'el equipo'} · {cuando(nota.actualizada_en, hoy, zona)}. No la ve el cliente.</span> : <span className="mu">Nota interna. No la ve el cliente.</span>}
        </div>
      ) : null}

      {puedeEditar ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {descartada ? (
            <button type="button" className="btn bp" disabled={guardando} onClick={() => void restaurar()}>Restaurar mención</button>
          ) : (
            <>
              <button type="button" className="btn bp" disabled={guardando} onClick={() => void guardar()}>Guardar revisión</button>
              {cambios ? <button type="button" className="btn bg" disabled={guardando} onClick={() => setBorrador(undefined)}>Deshacer cambios</button> : null}
              <button type="button" className="btn bg" disabled={guardando} onClick={() => void descartar()}>Descartar</button>
            </>
          )}
          {href ? <a className="btn bg" href={href} target="_blank" rel="noopener noreferrer">Abrir fuente</a> : null}
        </div>
      ) : href ? (
        <div><a className="btn bg" href={href} target="_blank" rel="noopener noreferrer">Abrir fuente</a></div>
      ) : null}

      <p className="mu">
        {m.revisada
          ? `Revisada${revisor ? ` por ${revisor}` : ''}${m.revisada_en ? ` · ${cuando(m.revisada_en, hoy, zona)}` : ''}. `
          : ''}
        {puedeEditar ? 'Cada corrección manual queda registrada con autor y fecha. Los totales del periodo no cambian.' : 'Tu rol permite ver la revisión, no cambiarla.'}
      </p>
    </aside>
  );
}
