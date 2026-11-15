// Panel de detalle de una alerta: acciones de estado, por qué se disparó, evidencia, pasos sugeridos, notas y actividad.
// Cada cambio de estado pasa por la función cambiar_alerta (850_funciones.sql): cambia `alertas` y deja la fila de
// `alerta_actividad` (y la nota interna, si la hay) en una sola transacción, firmada por la persona de la sesión.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { avisar, db } from '../../lib/db';
import { useTabla } from '../../lib/hooks';
import { SEVERIDAD, compacto, fecha, num, pct } from '../../lib/formato';
import type { Alerta, AlertaActividad, Campana, EstadoAlerta, Evento, FiguraCampana, Narrativa, NotaInterna, Persona, ReglaAlerta, Tema } from '../../lib/tipos';
import { useAcciones } from '../../shell/Acciones';
import { Grafica } from './Grafica';
import {
  CLASE_ESTADO, CLASE_TONO, MOTIVOS_DESCARTE, PREFIJO_PASO, ahoraEn, alas7, diasAlLunes, masHoras, momento, textoActividad, vencida,
} from './comun';

export interface Contexto {
  figuras: Map<string, FiguraCampana>;
  narrativas: Map<string, Narrativa>;
  temas: Map<string, Tema>;
  eventos: Map<string, Evento>;
  reglas: Map<string, ReglaAlerta>;
  personas: Map<string, Persona>;
}

const DIR: Record<string, string> = { Favorable: 'a favor', Desfavorable: 'en contra', Posicionamiento: 'posicionamiento', 'Sin dirección': 'sin dirección' };

/** Contexto derivado de las filas ligadas (narrativa, evento, tema) más el texto guardado en detalle.contexto. */
function contextoDe(a: Alerta, cx: Contexto): string {
  const partes: string[] = [];
  const n = a.narrativa_id ? cx.narrativas.get(a.narrativa_id) : undefined;
  const e = a.evento_id ? cx.eventos.get(a.evento_id) : undefined;
  const t = a.tema_id ? cx.temas.get(a.tema_id) : undefined;
  if (t) partes.push(`Tema "${t.nombre}"${t.porcentaje != null ? ` (${pct(t.porcentaje, 0)} de la conversación)` : ''}`);
  if (n) partes.push(`narrativa "${n.nombre}" (${[DIR[n.direccion], `${num(n.menciones)} menciones`, n.tendencia?.toLowerCase()].filter(Boolean).join(', ')})`);
  if (e) partes.push(`evento "${e.nombre}"${e.fecha_inicio ? `, ${fecha(e.fecha_inicio)}` : ''}, ${e.estado.toLowerCase()}${e.nota_estado ? ` (${e.nota_estado.toLowerCase()})` : ''}`);
  const base = partes.length ? partes.join(' · ').replace(/^./, (c) => c.toUpperCase()) + '.' : '';
  const texto: string | null = a.detalle?.contexto?.texto ?? null;
  return [base, texto].filter(Boolean).join(' ');
}

/** Filtro de Menciones (?narrativa=, ?tema=, ?evento=, ?figura=) con lo más específico que la alerta tenga. */
function filtroMenciones(a: Alerta): string {
  const [k, v] = a.narrativa_id ? ['narrativa', a.narrativa_id] : a.evento_id ? ['evento', a.evento_id] : a.tema_id ? ['tema', a.tema_id] : a.figura_id ? ['figura', a.figura_id] : [null, null];
  return k && v ? `?${k}=${encodeURIComponent(v)}` : '';
}

function enlaceDe(a: Alerta, base: string): { texto: string; a: string } | null {
  const pref: string | undefined = a.detalle?.contexto?.enlace;
  const orden = pref === 'temas' ? ['temas', 'evento', 'figura'] : pref === 'figura' ? ['figura', 'evento', 'temas'] : ['evento', 'figura', 'temas'];
  for (const k of orden) {
    if (k === 'evento' && a.evento_id) return { texto: 'Ver el evento', a: `${base}/eventos/${a.evento_id}` };
    if (k === 'figura' && a.figura_id) return { texto: 'Ver la figura', a: `${base}/figuras/${a.figura_id}` };
    if (k === 'temas' && (a.tema_id || a.narrativa_id)) return { texto: 'Ver temas y narrativas', a: `${base}/temas` };
  }
  return null;
}

type Menu = null | 'posponer' | 'descartar' | 'resolver' | 'asignar';

export function Detalle({ alerta: a, campana, cx, responsables, yo, puedeEditar, esCliente, alCambiar }: {
  alerta: Alerta; campana: Campana; cx: Contexto; responsables: Persona[]; yo: Persona | null;
  puedeEditar: boolean; esCliente: boolean; alCambiar: (id: string) => void;
}) {
  const { aviso } = useAcciones();
  const base = `/c/${campana.id}`;
  const [menu, setMenu] = useState<Menu>(null);
  const [motivo, setMotivo] = useState('');
  const [nota, setNota] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [nuevas, setNuevas] = useState<string[]>([]);

  const actividad = useTabla<AlertaActividad>('alerta_actividad', { eq: { alerta_id: a.id }, orden: [['creada_en', 'desc'], ['id', 'desc']] });
  const notas = useTabla<NotaInterna>('notas_internas', { eq: { campana_id: campana.id, entidad: 'alerta', entidad_id: a.id }, orden: 'creada_en' }, !esCliente);

  const fig = a.figura_id ? cx.figuras.get(a.figura_id) : undefined;
  const regla = a.regla_id ? cx.reglas.get(a.regla_id) : undefined;
  const resp = a.responsable_id ? cx.personas.get(a.responsable_id) : undefined;
  const respTxt = a.responsable_id ? (resp?.nombre ?? 'equipo de la campaña') : 'sin asignar';
  const g = a.detalle?.grafica;
  const evidencia: Array<Record<string, unknown>> = Array.isArray(a.detalle?.evidencia) ? a.detalle.evidencia : [];
  const pasos: string[] = Array.isArray(a.detalle?.pasos) ? a.detalle.pasos : [];
  const hechos = new Set(actividad.datos.filter((l) => l.texto.startsWith(PREFIJO_PASO)).map((l) => l.texto.slice(PREFIJO_PASO.length)));
  const ctx = contextoDe(a, cx);
  const enlace = enlaceDe(a, base);

  /** Cambia la alerta y deja constancia en la actividad. */
  async function registrar(cambios: Partial<Alerta>, texto: string, ok: string) {
    if (ocupado) return;
    setOcupado(true);
    try {
      const id = await db.rpc<string>('cambiar_alerta', { p_alerta: a.id, p_cambios: cambios, p_texto: texto, p_en: ahoraEn(campana) });
      avisar('alertas', 'alerta_actividad');
      setNuevas((l) => [...l, id]);
      setMenu(null); setMotivo('');
      alCambiar(a.id);
      aviso(ok);
    } catch (e) {
      aviso(e instanceof Error ? e.message : String(e));
    } finally { setOcupado(false); }
  }

  const tomar = (verbo: string) => registrar(
    { estado: 'En revisión', responsable_id: yo?.id ?? a.responsable_id, pospuesta_hasta: null, resuelta_en: null, motivo_cierre: null },
    `${verbo} la alerta · En revisión`, 'Alerta en revisión',
  );
  const cerrar = (estado: EstadoAlerta, m: string, texto: string, ok: string) => registrar(
    { estado, motivo_cierre: m, resuelta_en: ahoraEn(campana), pospuesta_hasta: null, responsable_id: a.responsable_id ?? yo?.id ?? null }, texto, ok,
  );
  const posponer = (hasta: string) => registrar(
    { estado: 'Pospuesta', pospuesta_hasta: hasta, responsable_id: a.responsable_id ?? yo?.id ?? null },
    `pospuso la alerta hasta ${momento(hasta, campana)}`, `Alerta pospuesta hasta ${momento(hasta, campana)}`,
  );
  const asignar = (p: Persona | null) => registrar(
    { responsable_id: p?.id ?? null }, p ? `asignó la alerta a ${p.nombre}` : 'quitó el responsable de la alerta', p ? `Asignada a ${p.nombre}` : 'Alerta sin responsable',
  );

  async function guardarNota() {
    const t = nota.trim();
    if (!t || ocupado) return;
    setOcupado(true);
    try {
      const id = await db.rpc<string>('cambiar_alerta', { p_alerta: a.id, p_cambios: {}, p_texto: 'agregó una nota interna', p_nota: t, p_en: ahoraEn(campana) });
      avisar('alerta_actividad', 'notas_internas');
      setNuevas((l) => [...l, id]);
      setNota('');
      aviso('Nota guardada');
    } catch (e) { aviso(e instanceof Error ? e.message : String(e)); } finally { setOcupado(false); }
  }

  const menuBtn = (texto: string, clave: Exclude<Menu, null>) => (
    <button key={clave} type="button" className="btn bg" aria-pressed={menu === clave} aria-expanded={menu === clave} disabled={!puedeEditar} onClick={() => setMenu(menu === clave ? null : clave)}>{texto}</button>
  );
  const principal = (texto: string, fn: () => void) => <button key={texto} type="button" className="btn bp" disabled={!puedeEditar || ocupado} onClick={fn}>{texto}</button>;
  const resolverBtn = (primario: boolean) => (
    <button key="resolver" type="button" className={primario ? 'btn bp' : 'btn bg'} aria-pressed={menu === 'resolver'} aria-expanded={menu === 'resolver'} disabled={!puedeEditar} onClick={() => setMenu(menu === 'resolver' ? null : 'resolver')}>Resolver</button>
  );
  const acciones = a.estado === 'Nueva' ? [principal('Tomar', () => tomar('tomó')), resolverBtn(false), menuBtn('Posponer', 'posponer'), menuBtn('Descartar', 'descartar'), menuBtn('Asignar', 'asignar')]
    : a.estado === 'En revisión' ? [resolverBtn(true), menuBtn('Posponer', 'posponer'), menuBtn('Descartar', 'descartar'), menuBtn('Asignar', 'asignar')]
    : a.estado === 'Pospuesta' ? [principal('Retomar', () => tomar('retomó')), resolverBtn(false), menuBtn('Posponer otra vez', 'posponer'), menuBtn('Descartar', 'descartar'), menuBtn('Asignar', 'asignar')]
    : [principal('Reabrir', () => tomar('reabrió'))];

  // Nota de estado: se deriva de las columnas guardadas.
  let notaEstado = '';
  if (a.estado === 'Pospuesta') {
    notaEstado = a.pospuesta_hasta
      ? (vencida(a, campana) ? `El plazo venció ${momento(a.pospuesta_hasta, campana)}. Retómala o vuelve a posponerla.` : `Pospuesta hasta ${momento(a.pospuesta_hasta, campana)}.`)
      : 'Pospuesta sin fecha.';
    if (a.detalle?.nota_estado) notaEstado += ' ' + a.detalle.nota_estado;
  } else if (a.estado === 'Resuelta') {
    notaEstado = `Resuelta${resp ? ` por ${resp.nombre}` : ''}${a.resuelta_en ? `, ${momento(a.resuelta_en, campana)}` : ''}.${a.motivo_cierre ? ' ' + a.motivo_cierre : ''}`;
  } else if (a.estado === 'Descartada') {
    notaEstado = `Descartada${resp ? ` por ${resp.nombre}` : ''}.${a.motivo_cierre ? ` Motivo: ${a.motivo_cierre.replace(/\.$/, '').toLowerCase()}.` : ''}`;
  }

  const ahora = ahoraEn(campana);
  const opcionesPosponer: Array<[string, string]> = [
    ['2 horas', masHoras(ahora, 2)],
    ['Hasta mañana 7:00', alas7(campana, 1)],
    ['Hasta el lunes 7:00', alas7(campana, diasAlLunes(campana))],
  ];

  return (
    <div className="col c3">
      <aside className="card al-sel" aria-label="Detalle de la alerta">
        <div className="ch">
          <span className="mm">
            <span className={SEVERIDAD[a.severidad]}>Severidad {a.severidad.toLowerCase()}</span>
            {a.tipo ? <span className="chip ring">{a.tipo}</span> : null}
          </span>
          <span className={CLASE_ESTADO[a.estado]}>{a.estado}{vencida(a, campana) ? ' · vencida' : ''}</span>
        </div>
        <h2 style={{ fontSize: 17, lineHeight: '24px' }}>{a.texto}</h2>
        <p className="mu">
          {fig ? <><Link to={`${base}/figuras/${fig.figura_id}`}>{fig.nombre}</Link> · {fig.relacion} · </> : null}
          disparada {momento(a.detectada_en, campana)} · responsable: {respTxt}
        </p>
        {notaEstado ? <p className="sm well fade">{notaEstado}</p> : null}
        <div className="al-acts">{acciones}</div>
        {!puedeEditar ? <p className="mu">Tu rol en esta campaña es de consulta: puedes ver la alerta, pero no cambiarla.</p> : null}

        {menu === 'posponer' ? (
          <div className="well fade al-menu">
            <span className="kl">Posponer hasta</span>
            <div className="al-acts">
              {opcionesPosponer.map(([t, hasta]) => <button key={t} type="button" className="btn bg" disabled={ocupado} onClick={() => posponer(hasta)}>{t}</button>)}
            </div>
            <span className="mu">Al llegar la hora, la alerta aparece como vencida en Pospuestas para que alguien la retome.</span>
          </div>
        ) : null}
        {menu === 'descartar' ? (
          <div className="well fade al-menu">
            <span className="kl">Motivo para descartar</span>
            <div className="al-acts">
              {MOTIVOS_DESCARTE.map((m) => <button key={m} type="button" className="btn bg" disabled={ocupado} onClick={() => cerrar('Descartada', m, `descartó la alerta · ${m}`, 'Alerta descartada')}>{m}</button>)}
            </div>
          </div>
        ) : null}
        {menu === 'resolver' ? (
          <div className="well fade al-menu">
            <label className="kl" htmlFor={`motivo-${a.id}`}>Cómo se resolvió</label>
            <textarea id={`motivo-${a.id}`} className="ta" rows={2} value={motivo} placeholder="Qué se hizo o por qué ya no requiere atención" onChange={(e) => setMotivo(e.target.value)} />
            <div className="al-acts">
              <button type="button" className="btn bp" disabled={ocupado || !motivo.trim()} onClick={() => cerrar('Resuelta', motivo.trim(), 'resolvió la alerta', 'Alerta resuelta')}>Resolver alerta</button>
              <span className="mu">El motivo queda en la alerta y en su actividad.</span>
            </div>
          </div>
        ) : null}
        {menu === 'asignar' ? (
          <div className="well fade al-menu">
            <span className="kl">Asignar a</span>
            <div className="al-acts">
              {responsables.filter((p) => p.id !== a.responsable_id).map((p) => (
                <button key={p.id} type="button" className="btn bg" disabled={ocupado} onClick={() => asignar(p)}>{p.nombre}{p.id === yo?.id ? ' (tú)' : ''}</button>
              ))}
              {a.responsable_id ? <button type="button" className="btn bg" disabled={ocupado} onClick={() => asignar(null)}>Quitar responsable</button> : null}
            </div>
          </div>
        ) : null}
      </aside>

      <section className="card">
        <div className="ch"><h2>Por qué se disparó</h2><span className="mu">{a.disparos > 1 ? `${a.disparos} disparos agrupados` : '1 disparo'}</span></div>
        {a.explicacion ? <p style={{ color: '#454E48' }}>{a.explicacion}</p> : null}
        <div className="dl">
          <div><span className="kl">Regla</span><span className="b">{regla?.nombre ?? 'Sin regla ligada'}</span></div>
          <div><span className="kl">Valor</span><span className="b">{a.valor ?? 'Sin datos'}</span></div>
          <div><span className="kl">Umbral</span><span className="b">{a.umbral ?? 'Sin datos'}</span></div>
          <div><span className="kl">Ventana</span><span className="b">{a.ventana ?? 'Sin datos'}</span></div>
        </div>
        {g ? <Grafica g={g} disparo={momento(a.detectada_en, campana)} campana={campana} /> : <p className="mu">Esta alerta no trae la serie que la disparó.</p>}
      </section>

      <section className="card">
        <div className="ch">
          <h2>Evidencia</h2>
          <Link className="lk" to={`${base}/menciones${filtroMenciones(a)}`}>Ver en Menciones</Link>
        </div>
        {evidencia.length ? (
          <div className="list">
            {evidencia.map((e, i) => (
              <div className="li" key={i} style={{ alignItems: 'flex-start' }}>
                <div className="gr">
                  <span className="mu"><span className="b" style={{ color: '#454E48' }}>{String(e.fuente ?? 'Fuente')}</span>{e.canal ? ` · ${e.canal}` : ''}{e.publicada_en ? ` · ${momento(String(e.publicada_en), campana)}` : ''}</span>
                  <span>{String(e.descripcion ?? '')}</span>
                </div>
                {typeof e.alcance === 'number' ? <span className="sm r" style={{ flex: 'none' }}><span className="b">{e.alcance >= 1_000_000 ? compacto(e.alcance) : num(e.alcance)}</span><br /><span className="mu">alcance</span></span> : null}
                {e.sentimiento ? <span className={CLASE_TONO[String(e.sentimiento)] ?? 'chip'} style={{ flex: '0 0 96px', justifyContent: 'center' }}>{String(e.sentimiento)}</span> : null}
              </div>
            ))}
          </div>
        ) : <p className="mu">Sin publicaciones guardadas como evidencia.</p>}
        {ctx || enlace ? <p className="mu"><span className="b" style={{ color: '#454E48' }}>Contexto:</span> {ctx} {enlace ? <Link className="lk" to={enlace.a}>{enlace.texto}</Link> : null}</p> : null}
        <p className="mu">Solo publicaciones públicas. Las cuentas ciudadanas se muestran sin nombre ni usuario.</p>
      </section>

      {pasos.length ? (
        <section className="card">
          <div className="ch"><h2>Siguiente paso sugerido</h2><span className="chip warn">Sugerencia, decide el equipo</span></div>
          <div className="al-acts">
            {pasos.map((p) => {
              // Crear el evento de crisis no se hace desde aquí: lleva al formulario, con el tipo ya elegido.
              if (/^crear evento de crisis$/i.test(p.trim())) {
                return puedeEditar
                  ? <Link key={p} className="btn bg" to={`${base}/eventos/nuevo?tipo=Crisis`}>{p}</Link>
                  : <button key={p} type="button" className="btn bg" disabled>{p}</button>;
              }
              const hecho = hechos.has(p);
              return (
                <button key={p} type="button" className="btn bg" aria-pressed={hecho} disabled={!puedeEditar || hecho || ocupado}
                  onClick={() => registrar({}, PREFIJO_PASO + p, 'Paso anotado en la actividad')}>
                  {(hecho ? 'Hecho: ' : 'Marcar como hecho: ') + p.charAt(0).toLowerCase() + p.slice(1)}
                </button>
              );
            })}
          </div>
          <p className="mu">Sugerencias según el tipo de alerta. Nada se publica ni se envía desde aquí: marcar un paso solo deja constancia en la actividad de que el equipo lo hizo.</p>
        </section>
      ) : null}

      {!esCliente ? (
        <section className="card">
          <div className="ch">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4" /></svg>
              Notas internas
            </h2>
            <span className="mu">No se incluyen en reportes ni exportaciones</span>
          </div>
          {notas.datos.map((n) => (
            <div className="well sm fade" key={n.id}>
              <span className="b">{n.autor_id ? (cx.personas.get(n.autor_id)?.nombre ?? 'Equipo') : 'Equipo'}</span> <span className="mu">· {momento(n.creada_en, campana)}</span><br />{n.texto}
            </div>
          ))}
          {!notas.datos.length && !puedeEditar ? <p className="mu">Sin notas en esta alerta.</p> : null}
          {puedeEditar ? (
            <>
              <textarea className="ta" rows={2} aria-label="Nota interna" placeholder="Qué se revisó y qué se decidió" value={nota} onChange={(e) => setNota(e.target.value)} />
              <div className="al-acts" style={{ alignItems: 'center' }}>
                <button type="button" className="btn bg" disabled={!nota.trim() || ocupado} onClick={guardarNota}>Guardar nota</button>
                <span className="mu">Tampoco viajan en los avisos por WhatsApp, Telegram o Slack.</span>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      <section className="card">
        <div className="ch"><h2>Actividad</h2><span className="mu">Registro interno de la alerta</span></div>
        {actividad.datos.length ? (
          <div className="tlx">
            {actividad.datos.map((l) => (
              <div key={l.id} className={nuevas.includes(l.id) ? 'tle nw fade' : 'tle'}>
                <span className="sm">{textoActividad(l, cx.personas)}</span>
                <span className="mu">{momento(l.creada_en, campana)}</span>
              </div>
            ))}
          </div>
        ) : <p className="mu">{actividad.cargando ? 'Cargando…' : 'Sin actividad registrada.'}</p>}
      </section>

    </div>
  );
}
