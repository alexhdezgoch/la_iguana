// Crear evento: datos básicos, participantes, plan (objetivos, mensajes, narrativa, hashtags) y ventana de medición.
// Lee v_figuras_campana, eventos, narrativas, campana_fases. Escribe eventos, evento_participantes, evento_mensajes y terminos (evento_id).
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './CrearEvento.css';
import { db } from '../lib/db';
import { useTabla } from '../lib/hooks';
import { ESTADO_EVENTO, fecha as fmtFecha, num, rango } from '../lib/formato';
import type { CampanaFase, Evento, EventoMensaje, EventoParticipante, FiguraCampana, Narrativa } from '../lib/tipos';
import { hoyDe, useCampana, usePagina } from '../shell/Campana';
import { useAcciones } from '../shell/Acciones';
import { Carga } from '../shell/Estados';
import { SinPermiso, normal, usePermiso } from './agregar-figura/acceso';
import { Aviso, Casilla, EQUIPOS, Etiqueta, Opciones, type Equipo } from './agregar-figura/partes';
import { D, H, aIso, diaCorto, diaLargo, diaMedio, duracion, instante, mesCorto } from './crear-evento/tiempo';

// Catálogos del formulario: texto fijo de la interfaz.
const TIPOS = ['Mitin', 'Debate', 'Gira', 'Conferencia de prensa', 'Encuentro ciudadano', 'Informe', 'Entrevista', 'Crisis'] as const;
const ORIGENES = ['Propio', 'De rival', 'Institucional'] as const;
const ROLES = ['Protagonista', 'Oradora/or', 'Invitada/o', 'Adversaria/o', 'Moderadora/or'];
const VENTANAS: Array<[number, string]> = [[24, '24 h'], [48, '48 h'], [72, '72 h'], [120, '5 días'], [168, '7 días']];
const MAX_MENSAJES = 3;
const COLOR_FASE: Record<string, string> = {
  Precampaña: '#DDE3DC', Intercampaña: '#DDE3DC', Campaña: '#BFD6C3', Veda: '#E3CC6E', 'Jornada electoral': '#285A32', 'Post-electoral': '#C9CFC9',
};

interface Mensaje { texto: string; terminos: string[]; borrador: string }
interface Participante { figura_id: string; rol: string }
type Tipo = (typeof TIPOS)[number];
type Origen = (typeof ORIGENES)[number];

function Ventana({ etiqueta, valor, alElegir }: { etiqueta: string; valor: number; alElegir: (h: number) => void }) {
  return (
    <div className="fld"><span className="fl">{etiqueta}</span>
      <div className="ops" role="group" aria-label={etiqueta}>
        {VENTANAS.map(([h, t]) => <button key={h} type="button" className="op" aria-pressed={h === valor} onClick={() => alElegir(h)}>{t}</button>)}
      </div>
    </div>
  );
}

export default function CrearEvento() {
  const campana = useCampana();
  const cid = campana.id;
  const base = `/c/${cid}`;
  usePagina('Crear evento', [{ texto: 'Eventos', a: `${base}/eventos` }]);
  const hoy = hoyDe(campana);
  const navegar = useNavigate();
  const { aviso } = useAcciones();
  const permiso = usePermiso(cid);
  const propiaId = campana.figura_propia_id;
  const ciudadZona = (campana.zona_horaria.split('/').pop() ?? '').replace(/_/g, ' ');

  const figuras = useTabla<FiguraCampana>('v_figuras_campana', { eq: { campana_id: cid }, orden: 'orden' });
  const eventos = useTabla<Evento>('eventos', { eq: { campana_id: cid }, neq: { estado: 'Cancelado' }, orden: 'fecha_inicio' });
  const fases = useTabla<CampanaFase>('campana_fases', { eq: { campana_id: cid }, orden: 'orden' });
  const narrativas = useTabla<Narrativa>('narrativas', { eq: { campana_id: cid, figura_id: propiaId ?? '', direccion: 'Favorable' }, orden: [['menciones', 'desc']] }, !!propiaId);

  const [tipo, setTipo] = useState<Tipo>('Mitin');
  const [origen, setOrigen] = useState<Origen>('Propio');
  const [nombre, setNombre] = useState('');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [multi, setMulti] = useState(false);
  const [fin, setFin] = useState('');
  const [sede, setSede] = useState('');
  const [lugar, setLugar] = useState('');
  const [partsSt, setParts] = useState<Participante[] | null>(null);
  const [planSt, setPlan] = useState<boolean | null>(null);
  const [objetivos, setObjetivos] = useState('');
  const [mensajes, setMensajes] = useState<Mensaje[]>([{ texto: '', terminos: [], borrador: '' }]);
  const [narr, setNarr] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagBorrador, setTagBorrador] = useState('');
  const [antes, setAntes] = useState(72);
  const [desp, setDesp] = useState(72);
  const [resp, setResp] = useState<Equipo>('Equipo de comunicaciones');
  const [guardando, setGuardando] = useState(false);

  const crisis = tipo === 'Crisis';
  const planAbierto = planSt ?? !(crisis || origen === 'De rival');
  const propia = figuras.datos.find((f) => f.figura_id === propiaId) ?? null;
  // Participantes por defecto: la figura propia como protagonista, si la campaña la tiene.
  const parts: Participante[] = partsSt ?? (propia && origen === 'Propio' ? [{ figura_id: propia.figura_id, rol: 'Protagonista' }] : []);
  const figuraDe = (id: string) => figuras.datos.find((f) => f.figura_id === id);
  const mas = figuras.datos.filter((f) => !parts.some((p) => p.figura_id === f.figura_id));

  // ---------- calendario ----------
  const HOY = instante(hoy, '00:00');
  const t = instante(fecha, hora);
  const okFecha = !isNaN(t);
  const tFin = multi && instante(fin, hora) > t ? instante(fin, hora) : t;
  const w0 = t - antes * H, w1 = tFin + desp * H;
  const veda0 = instante(campana.veda_inicio, '00:00'), veda1 = instante(campana.veda_fin, '23:59');
  const hayVeda = !isNaN(veda0) && !isNaN(veda1);
  const enVeda = okFecha && hayVeda && t >= veda0 && t <= veda1;
  const ventanaVeda = okFecha && hayVeda && !enVeda && w1 > veda0 && w0 < veda1;
  const textoVeda = hayVeda ? rango(campana.veda_inicio, campana.veda_fin).replace(' a ', ' al ') : '';

  const fase = okFecha ? fases.datos.find((f) => (f.inicio ? instante(f.inicio, '00:00') <= t : true) && (f.fin ? t <= instante(f.fin, '23:59') : true) && (f.inicio || f.fin)) ?? null : null;
  const jornada = instante(campana.jornada, '00:00');
  let textoFase = 'Elige una fecha para ubicar el evento en el calendario electoral.';
  if (okFecha) {
    if (fase?.nombre === 'Campaña' && fase.inicio && fase.fin) {
      const dia = Math.floor((t - instante(fase.inicio, '00:00')) / D) + 1;
      const total = Math.round((instante(fase.fin, '00:00') - instante(fase.inicio, '00:00')) / D) + 1;
      const faltan = !isNaN(jornada) ? Math.ceil((jornada - t) / D) : null;
      textoFase = `Día ${dia} de ${total} de campaña${faltan != null && faltan > 0 ? ` · faltan ${faltan} días para la jornada del ${fmtFecha(campana.jornada, 'medio')}` : ''}.`;
    } else if (fase?.nombre === 'Veda') textoFase = `El evento cae en la veda del ${textoVeda}.`;
    else if (fase?.nombre === 'Jornada electoral') textoFase = 'El evento cae en la jornada electoral.';
    else if (fase) textoFase = `El evento cae en ${fase.nombre.toLowerCase()}.`;
    else textoFase = fases.datos.length ? 'El evento queda fuera de las fases del calendario de la campaña.' : 'La campaña todavía no tiene calendario electoral.';
  }
  const faseNombre = !okFecha ? 'Sin fecha' : fase?.nombre ?? 'Sin fase';

  // Rango de la línea de tiempo: de unos días antes de hoy hasta pasada la jornada o el evento.
  const T0 = Math.min(HOY, okFecha ? w0 : HOY) - 5 * D;
  const T1 = Math.max(isNaN(jornada) ? HOY : jornada, okFecha ? w1 : HOY, HOY + 21 * D) + 4 * D;
  const x = (v: number) => Math.max(0, Math.min(100, ((v - T0) / (T1 - T0)) * 100));

  const solapes: string[] = [];
  const cerca = eventos.datos.flatMap((e) => {
    const a = instante(e.fecha_inicio, e.hora);
    if (isNaN(a)) return [];
    const b = Math.max(a, instante(e.fecha_fin ?? e.fecha_inicio, (e.extra?.hora_fin as string | undefined) ?? e.hora));
    const va = Number(e.extra?.ventana_antes_horas ?? e.ventana_horas ?? 72), vd = Number(e.extra?.ventana_despues_horas ?? e.ventana_horas ?? 72);
    const e0 = a - va * H, e1 = b + vd * H;
    if (e1 < T0 || e0 > T1) return [];
    const o0 = Math.max(e0, w0), o1 = Math.min(e1, w1);
    const oh = okFecha && o1 > o0 ? Math.round((o1 - o0) / H) : 0;
    const dd = okFecha ? Math.round((a - t) / D) : 0;
    const cuando = rango(e.fecha_inicio, e.fecha_fin);
    if (oh > 0) solapes.push(`${e.nombre} (${cuando})`);
    return [{
      e, cuando, oh,
      texto: `${cuando} · ${e.estado}${okFecha ? ` · ${dd === 0 ? 'mismo día' : `${Math.abs(dd)} ${Math.abs(dd) === 1 ? 'día' : 'días'} ${dd < 0 ? 'antes' : 'después'}`}` : ''}`,
      carril: { x0: x(e0), x1: x(e1), o0: oh > 0 ? x(o0) : 0, o1: oh > 0 ? x(o1) : 0, m: x(a) },
    }];
  }).slice(0, 6);
  const fasesEnRango = fases.datos.filter((f) => f.inicio && f.fin && instante(f.fin, '23:59') >= T0 && instante(f.inicio, '00:00') <= T1);

  // ---------- plan ----------
  const cambiarMensaje = (i: number, c: Partial<Mensaje>) => setMensajes(mensajes.map((m, j) => (j === i ? { ...m, ...c } : m)));
  const agregarTerminoMensaje = (i: number) => {
    const m = mensajes[i];
    const v = m.borrador.trim();
    if (!v) return;
    cambiarMensaje(i, { terminos: m.terminos.some((x) => normal(x) === normal(v)) ? m.terminos : [...m.terminos, v], borrador: '' });
  };
  const agregarTag = () => {
    let v = tagBorrador.trim().replace(/\s+/g, '');
    if (!v) return;
    if (v[0] !== '#') v = '#' + v;
    if (!tags.some((x) => normal(x) === normal(v))) setTags([...tags, v]);
    setTagBorrador('');
  };

  // ---------- guardar ----------
  const faltan: string[] = [];
  if (!nombre.trim()) faltan.push('nombre');
  if (!okFecha) faltan.push('fecha');
  const puede = faltan.length === 0 && !guardando;
  const estadoFinal = crisis ? 'En curso' : 'Programado';

  const guardar = async (borrador: boolean) => {
    if (guardando || (!borrador && faltan.length)) return;
    setGuardando(true);
    try {
      const [ciudad, ...region] = lugar.split(',').map((s) => s.trim()).filter(Boolean);
      const finIso = okFecha ? aIso(tFin) : null;
      const extra: Record<string, unknown> = { responsable_equipo: resp, ventana_antes_horas: antes, ventana_despues_horas: desp };
      if (region.length) extra.estado_region = region.join(', ');
      const mensajesOk = planAbierto ? mensajes.filter((m) => m.texto.trim()) : [];
      const ev = await db.crear<Evento>('eventos', {
        campana_id: cid, nombre: nombre.trim() || 'Evento sin nombre', tipo, es_crisis: crisis, origen,
        estado: borrador ? 'Borrador' : estadoFinal,
        fecha_inicio: okFecha ? fecha : null, fecha_fin: finIso, hora: hora || null,
        sede: sede.trim() || null, ciudad: ciudad ?? null,
        objetivos: planAbierto ? objetivos.trim() || null : null,
        narrativa_id: planAbierto ? narr : null,
        hashtags: planAbierto ? tags : [],
        ventana_horas: Math.max(antes, desp), extra,
      });
      await db.crearVarias<EventoParticipante>('evento_participantes', parts.map((p, i) => ({ campana_id: cid, evento_id: ev.id, figura_id: p.figura_id, rol: p.rol, orden: i + 1 })));
      await db.crearVarias<EventoMensaje>('evento_mensajes', mensajesOk.map((m, i) => ({ campana_id: cid, evento_id: ev.id, texto: m.texto.trim(), terminos: m.terminos, orden: i + 1 })));
      const terms: Array<{ texto: string; tipo: string }> = [];
      for (const m of mensajesOk) for (const x of m.terminos) if (!terms.some((y) => normal(y.texto) === normal(x))) terms.push({ texto: x, tipo: x.startsWith('#') ? 'Hashtag' : 'Término' });
      for (const h of planAbierto ? tags : []) if (!terms.some((y) => normal(y.texto) === normal(h))) terms.push({ texto: h, tipo: 'Hashtag' });
      await db.crearVarias('terminos', terms.map((x, i) => ({ campana_id: cid, evento_id: ev.id, texto: x.texto, tipo: x.tipo, orden: i + 1 })));
      aviso(borrador ? 'Borrador guardado' : crisis ? 'Crisis registrada en curso' : 'Evento programado', { texto: 'Ver eventos', a: `${base}/eventos` });
      navegar(`${base}/eventos/${ev.id}`);
    } catch (e) {
      aviso(e instanceof Error ? e.message : String(e));
      setGuardando(false);
    }
  };

  if (permiso.cargando) return <Carga estados={[permiso]}>{null}</Carga>;
  if (!permiso.puedeEditar) {
    return (
      <main className="page pg-crear-evento">
        <div className="ph"><div><h1>Crear evento</h1></div></div>
        <SinPermiso rol={permiso.rol} accion="crear eventos" volver={`${base}/eventos`} volverTexto="Volver a Eventos" />
      </main>
    );
  }

  const enDias = okFecha ? Math.round((instante(fecha, '00:00') - HOY) / D) : 0;
  const nota = crisis ? 'en curso desde el inicio detectado' : !okFecha ? 'sin fecha' : enDias > 0 ? `en ${enDias} ${enDias === 1 ? 'día' : 'días'}` : enDias === 0 ? 'hoy' : 'fecha pasada';
  const dT = okFecha ? t : HOY;

  return (
    <Carga estados={[figuras, eventos, fases, narrativas]}>
      <main className="page pg-crear-evento">
        <div className="ph">
          <div>
            <h1>Crear evento</h1>
            <p className="mu">Registra el momento de campaña y sus mensajes. La medición corre antes y después · hoy es {fmtFecha(hoy, 'dia')} de {hoy.slice(0, 4)}</p>
          </div>
          <div className="acts"><Link className="btn bg" to={`${base}/eventos`}>Cancelar</Link></div>
        </div>

        <div className="row">
          <div className="col fm">
            <section className="card">
              <div className="ch"><h2>Básico</h2><span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className="mu">Estado al guardar</span><span className={ESTADO_EVENTO[estadoFinal]}>{estadoFinal}</span></span></div>
              <div className="fld"><span className="fl">Tipo</span>
                <Opciones etiqueta="Tipo de evento" opciones={TIPOS} valor={tipo} alElegir={(v) => { setTipo(v); setPlan(null); if (v === 'Crisis' && !fecha) setFecha(hoy); }} /></div>
              {crisis ? (
                <Aviso><span><span className="b">Crisis: se registra en curso.</span> El estado queda "En curso", la fecha es el inicio detectado y el plan se puede completar después. Registra hechos operativos, no acusaciones.</span></Aviso>
              ) : null}
              <div className="fld"><span className="fl">Origen</span>
                <Opciones etiqueta="Origen" opciones={ORIGENES} valor={origen} alElegir={(v) => { setOrigen(v); setPlan(null); }} /></div>
              <div className="fr">
                <label className="fld" style={{ flexBasis: '100%' }}><span className="fl">Nombre</span><input className="in" id="nombre" type="text" placeholder="Qué pasa y dónde, en pocas palabras" value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
                <label className="fld"><span className="fl">{crisis ? 'Inicio detectado' : multi ? 'Empieza el' : 'Fecha y hora'}</span><input className="in" id="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
                <label className="fld" style={{ flex: '1 1 110px' }}><span className="fl">Hora de {ciudadZona}</span><input className="in" id="hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></label>
                {multi ? <label className="fld"><span className="fl">Termina el</span><input className="in" id="fin" type="date" min={fecha || undefined} value={fin} onChange={(e) => setFin(e.target.value)} /></label> : null}
              </div>
              <Casilla marcada={multi} alCambiar={() => setMulti(!multi)}>Varios días <span className="mu">· para giras y eventos con fecha de cierre</span></Casilla>
              {enVeda ? <Aviso><span><span className="b">Cae en veda.</span> La veda va del {textoVeda}. Confirma la fecha con tu asesoría legal.</span></Aviso> : null}
              <div className="fr">
                <label className="fld"><span className="fl">Sede</span><input className="in" type="text" placeholder="Lugar o canal" value={sede} onChange={(e) => setSede(e.target.value)} /></label>
                <label className="fld"><span className="fl">Municipio y estado</span><input className="in" type="text" placeholder="Municipio, estado" value={lugar} onChange={(e) => setLugar(e.target.value)} /></label>
              </div>
            </section>

            <section className="card">
              <div className="ch"><h2>Participantes</h2><span className="mu">{parts.length} {parts.length === 1 ? 'figura' : 'figuras'}</span></div>
              {parts.length ? (
                <div className="list">
                  {parts.map((p, i) => {
                    const f = figuraDe(p.figura_id);
                    if (!f) return null;
                    return (
                      <div className="li" key={p.figura_id} style={{ flexWrap: 'wrap' }}>
                        <span className="ini" aria-hidden="true">{f.iniciales}</span>
                        <span className="gr" style={{ flex: '1 1 150px' }}><Link className="b tl" to={`${base}/figuras/${f.figura_id}`}>{f.nombre}</Link><span className="mu">{[f.partido, f.relacion].filter(Boolean).join(' · ')}</span></span>
                        <select className="in" aria-label="Rol en el evento" style={{ width: 'auto', flex: '0 1 170px' }} value={p.rol}
                          onChange={(e) => setParts(parts.map((x, j) => (j === i ? { ...x, rol: e.target.value } : x)))}>
                          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <button type="button" className="x" aria-label="Quitar participante" onClick={() => setParts(parts.filter((_, j) => j !== i))}>×</button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="well"><p className="mu">{figuras.datos.length ? 'Sin participantes: el evento se medirá solo por sus términos.' : <>La campaña todavía no tiene figuras. <Link to={`${base}/figuras/nueva`}>Agregar figura</Link></>}</p></div>
              )}
              {mas.length ? (
                <div className="fld"><span className="fl">Agregar de las figuras de la campaña</span>
                  <div className="ops">
                    {mas.map((f) => (
                      <button key={f.figura_id} type="button" className="op" onClick={() => setParts([...parts, { figura_id: f.figura_id, rol: f.relacion === 'Rival' ? 'Adversaria/o' : 'Invitada/o' }])}>
                        + {f.nombre} <span className="mu" style={{ fontSize: 12 }}>{f.relacion}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <p className="mu">Puedes sumar rivales: se miden con el mismo método que las figuras propias.</p>
            </section>

            {!planAbierto ? (
              <section className="card fade">
                <div className="ch"><h2>Plan</h2><button type="button" className="btn bg sm2" onClick={() => setPlan(true)}>Completar plan</button></div>
                <p className="mu">{crisis ? 'En una crisis el plan puede esperar: primero se mide la conversación. Complétalo cuando el equipo defina la respuesta.' : 'Los eventos de rivales no llevan plan propio. Ábrelo solo si la campaña prepara mensajes de respuesta.'}</p>
              </section>
            ) : (
              <section className="card fade">
                <div className="ch"><h2>Plan</h2><span className="mu">Qué quiere lograr la campaña</span></div>
                <label className="fld"><span className="fl">Objetivos</span><textarea className="ta" rows={2} placeholder="Qué debe quedar en la conversación después del evento" value={objetivos} onChange={(e) => setObjetivos(e.target.value)} /></label>
                <div className="fld"><span className="fl">Mensajes clave <span className="mu">· {mensajes.length} de {MAX_MENSAJES}</span></span>
                  {mensajes.map((m, i) => (
                    <div className="ms" key={i}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span className="chip ring">{i + 1}</span>
                        <input className="in" type="text" aria-label="Mensaje clave" placeholder="El mensaje en pocas palabras" value={m.texto} onChange={(e) => cambiarMensaje(i, { texto: e.target.value })} />
                        <button type="button" className="x" aria-label="Quitar mensaje" onClick={() => setMensajes(mensajes.filter((_, j) => j !== i))}>×</button>
                      </div>
                      <span className="fl" style={{ fontWeight: 500, color: '#636C66' }}>Términos del mensaje</span>
                      <div className="ops">
                        {m.terminos.map((x, j) => (
                          <Etiqueta key={x} quitar="Quitar término" estilo={{ background: '#fff' }} alQuitar={() => cambiarMensaje(i, { terminos: m.terminos.filter((_, k) => k !== j) })}>{x}</Etiqueta>
                        ))}
                        <input className="in" type="text" aria-label="Nuevo término del mensaje" placeholder="Agregar término y Enter" style={{ flex: '1 1 160px', width: 'auto', height: 28 }} value={m.borrador}
                          onChange={(e) => cambiarMensaje(i, { borrador: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarTerminoMensaje(i); } }} />
                        <button type="button" className="btn bg sm2" style={{ height: 28 }} onClick={() => agregarTerminoMensaje(i)}>Agregar</button>
                      </div>
                      {m.terminos.length === 0 ? <div className="wn" style={{ padding: '6px 10px' }}><span>Sin términos no podremos medir si el mensaje aterrizó.</span></div> : null}
                    </div>
                  ))}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 12px', alignItems: 'center' }}>
                    <button type="button" className={mensajes.length >= MAX_MENSAJES ? 'btn bg dis' : 'btn bg'} aria-disabled={mensajes.length >= MAX_MENSAJES}
                      onClick={() => { if (mensajes.length < MAX_MENSAJES) setMensajes([...mensajes, { texto: '', terminos: [], borrador: '' }]); }}>Agregar mensaje</button>
                    <span className="mu">{mensajes.length >= MAX_MENSAJES ? 'Máximo 3 mensajes clave: con más, ninguno se mide bien. Quita uno para agregar otro.' : 'Hasta 3. Cada mensaje se mide con sus propios términos.'}</span>
                  </div>
                </div>
                <div className="fld"><span className="fl">Narrativa a impulsar</span>
                  {narrativas.datos.length ? (
                    <>
                      <div className="ops" role="group" aria-label="Narrativa a impulsar">
                        {narrativas.datos.map((n) => (
                          <button key={n.id} type="button" className="op" aria-pressed={narr === n.id} onClick={() => setNarr(n.id)}>
                            {n.nombre} <span className="mu" style={{ fontSize: 12 }}>{num(n.menciones)}{n.tendencia ? ` · ${n.tendencia.toLowerCase()}` : ''}</span>
                          </button>
                        ))}
                        <button type="button" className="op" aria-pressed={narr === null} onClick={() => setNarr(null)}>Ninguna</button>
                      </div>
                      <span className="mu">Narrativas a favor de {propia?.nombre ?? 'la figura propia'} que ya existen en la campaña.</span>
                    </>
                  ) : (
                    <span className="mu">{propiaId ? 'Todavía no hay narrativas a favor de la figura propia.' : 'La campaña todavía no tiene figura propia: las narrativas a impulsar aparecen cuando la tenga.'}</span>
                  )}
                </div>
                <div className="fld"><span className="fl">Hashtags oficiales</span>
                  <div className="ops">
                    {tags.map((h, i) => <Etiqueta key={h} quitar="Quitar hashtag" alQuitar={() => setTags(tags.filter((_, j) => j !== i))}>{h}</Etiqueta>)}
                    <input className="in" type="text" aria-label="Nuevo hashtag" placeholder="#Etiqueta y Enter" style={{ flex: '1 1 160px', width: 'auto', height: 28 }} value={tagBorrador}
                      onChange={(e) => setTagBorrador(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarTag(); } }} />
                    <button type="button" className="btn bg sm2" style={{ height: 28 }} onClick={agregarTag}>Agregar</button>
                  </div>
                </div>
              </section>
            )}

            <section className="card">
              <div className="ch"><h2>Medición</h2><span className="mu">{okFecha ? `Del ${diaCorto(w0)} al ${diaCorto(w1)}` : 'Falta la fecha'}</span></div>
              <div className="fr">
                <Ventana etiqueta="Ventana antes" valor={antes} alElegir={setAntes} />
                <Ventana etiqueta="Ventana después" valor={desp} alElegir={setDesp} />
              </div>
              <p className="mu">Por defecto, 72 h antes y 72 h después. Las menciones dentro de la ventana se asignan al evento.</p>
              <div className="fld"><span className="fl">Responsable</span>
                <Opciones etiqueta="Responsable" opciones={EQUIPOS} valor={resp} alElegir={setResp} /></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 12px', alignItems: 'center', borderTop: '1px solid rgb(22 32 25 / .07)', paddingTop: 14 }}>
                <button type="button" className={puede ? 'btn bp' : 'btn bp dis'} aria-disabled={!puede} onClick={() => guardar(false)}>{guardando ? 'Guardando…' : crisis ? 'Registrar crisis' : 'Programar evento'}</button>
                <button type="button" className={guardando ? 'btn bg dis' : 'btn bg'} aria-disabled={guardando} onClick={() => guardar(true)}>Guardar borrador</button>
                <span className="mu">{faltan.length ? `Falta: ${faltan.join(' · ')}.` : crisis ? `Queda en curso desde el ${diaLargo(t)}.` : `La ventana de medición empieza el ${diaLargo(w0)}.`}</span>
              </div>
            </section>
          </div>

          <div className="col pv">
            <section className="card">
              <div className="ch"><h2>Línea de tiempo</h2><span className={faseNombre === 'Campaña' ? 'chip live' : faseNombre === 'Veda' ? 'chip warn' : 'chip ring'}>{faseNombre}</span></div>
              <div className="tlw">
                <i className="hoy" style={{ left: `${x(HOY)}%` }} />
                <div className="ln">
                  <span className="b">{okFecha ? `Este evento · ventana del ${diaCorto(w0)} al ${diaCorto(w1)}` : 'Este evento · sin fecha'}</span>
                  <div className="lt">
                    {okFecha ? <><i style={{ left: `${x(w0)}%`, width: `${x(w1) - x(w0)}%`, background: '#7FB08A' }} /><i className="lm" style={{ left: `${x(t)}%`, background: '#285A32' }} /></> : null}
                  </div>
                </div>
                {cerca.map((c) => (
                  <div className="ln" key={c.e.id}>
                    <span>{c.e.nombre} · {diaCorto(instante(c.e.fecha_inicio, c.e.hora))}</span>
                    <div className="lt">
                      <i style={{ left: `${c.carril.x0}%`, width: `${c.carril.x1 - c.carril.x0}%`, background: '#C9CFC9' }} />
                      {c.oh > 0 ? <i style={{ left: `${c.carril.o0}%`, width: `${c.carril.o1 - c.carril.o0}%`, background: '#D07A2D' }} /> : null}
                      <i className="lm" style={{ left: `${c.carril.m}%`, background: '#454E48' }} />
                    </div>
                  </div>
                ))}
                {fasesEnRango.length ? (
                  <div className="ln">
                    <span>Fases · {fasesEnRango.map((f) => `${f.nombre.toLowerCase()} ${f.inicio === f.fin ? diaCorto(instante(f.inicio)) : instante(f.inicio, '00:00') < T0 ? `hasta el ${diaCorto(instante(f.fin))}` : `${diaCorto(instante(f.inicio))} a ${diaCorto(instante(f.fin))}`}`).join(' · ')}</span>
                    <div className="lt">
                      {fasesEnRango.map((f) => {
                        const a = x(instante(f.inicio, '00:00')), b = x(instante(f.fin, '00:00') + D);
                        return <i key={f.id} style={{ left: `${a}%`, width: `${b - a}%`, background: COLOR_FASE[f.nombre] ?? '#DDE3DC', borderRadius: 0 }} />;
                      })}
                    </div>
                  </div>
                ) : null}
                <div className="ch">
                  <span className="mu" style={{ fontSize: 12 }}>{diaCorto(T0)}</span>
                  <span className="mu" style={{ fontSize: 12 }}>línea punteada: hoy, {diaCorto(HOY)}</span>
                  <span className="mu" style={{ fontSize: 12 }}>{diaCorto(T1)}</span>
                </div>
              </div>
              <p className="sm">{textoFase}</p>
              {ventanaVeda ? <div className="wn"><span>La ventana de medición entra en la veda del {textoVeda}.</span></div> : null}
            </section>

            <section className="card">
              <div className="ch"><h2>Cerca en el calendario</h2><span className="mu">{solapes.length ? `${solapes.length} ${solapes.length === 1 ? 'solape' : 'solapes'}` : 'Sin solapes'}</span></div>
              {solapes.length ? <div className="wn fade" role="status"><span><span className="b">Se solapa con {solapes.join(' y con ')}:</span> las menciones cuentan en ambos.</span></div> : null}
              {cerca.length ? (
                <div className="list">
                  {cerca.map((c) => (
                    <div className="li" key={c.e.id} style={{ padding: '8px 0' }}>
                      <span className="gr"><Link className="sm b tl" to={`${base}/eventos/${c.e.id}`}>{c.e.nombre}</Link><span className="mu">{c.texto}</span></span>
                      <span className={c.oh > 0 ? 'chip unf' : 'chip watch'}>{c.oh > 0 ? `Se solapa · ${duracion(c.oh)}` : 'Sin solape'}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="mu">No hay otros eventos en estas fechas.</p>}
            </section>

            <section className="card">
              <div className="ch"><h2>Así aparecerá en Eventos</h2><span className={ESTADO_EVENTO[estadoFinal]}>{estadoFinal}</span></div>
              <div className="who" style={{ alignItems: 'flex-start' }}>
                <span className="ini" aria-hidden="true" style={{ width: 44, height: 44, flexDirection: 'column', gap: 2, lineHeight: 1 }}>
                  <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.04em' }}>{okFecha ? mesCorto(dT) : '··'}</span>
                  <span style={{ fontSize: 15, color: '#1B211D' }}>{okFecha ? new Date(dT).getUTCDate() : '··'}</span>
                </span>
                <span className="gr">
                  <span className="b">{nombre.trim() || 'Nombre del evento'}</span>
                  <span className="mu">{[okFecha ? (multi && tFin > t ? rango(fecha, aIso(tFin)) : diaMedio(t)) : 'Sin fecha', [sede.trim(), lugar.trim()].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</span>
                  <span className="mu">{tipo} · {origen} · {nota}</span>
                </span>
              </div>
              <div className="dl">
                <div><span className="mu">Menciones</span><span className="sm mu">Sin datos</span></div>
                <div><span className="mu">Alcance</span><span className="sm mu">Sin datos</span></div>
                <div><span className="mu">{propia ? `Neto de ${propia.nombre.split(' ').slice(-1)[0]}` : 'Neto'}</span><span className="sm mu">Sin datos</span></div>
              </div>
              {planAbierto && mensajes.length ? (
                <div className="list" style={{ borderTop: '1px solid rgb(22 32 25 / .07)', paddingTop: 12 }}>
                  <span className="fl" style={{ paddingBottom: 6 }}>Términos por mensaje</span>
                  {mensajes.map((m, i) => (
                    <div className="li" key={i} style={{ padding: '6px 0' }}>
                      <span className="gr"><span className="sm">{m.texto.trim() || `Mensaje ${i + 1}`}</span></span>
                      <span className={m.terminos.length ? 'sm b' : 'chip warn'}>{m.terminos.length ? `${m.terminos.length} ${m.terminos.length === 1 ? 'término' : 'términos'}` : 'Sin términos'}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              <p className="mu">{planAbierto ? 'Sin medición todavía: la lista muestra "Sin datos", nunca cero.' : 'Sin plan: se medirá la conversación general del evento. La lista muestra "Sin datos", nunca cero.'}</p>
            </section>
          </div>
        </div>
      </main>
    </Carga>
  );
}
