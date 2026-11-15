// Constructor de reglas en cuatro pasos (disparador, umbral, alcance, entrega). Crea o edita una fila de `reglas_alerta`.
// El catálogo de disparadores es texto fijo de la interfaz (ver docs/semilla.md). Las reglas todavía no vigilan: se guardan y quedan listas.
import { useState } from 'react';
import { db } from '../../lib/db';
import { num } from '../../lib/formato';
import type { Campana, FiguraCampana, Json, Persona, ReglaAlerta, Tema } from '../../lib/tipos';
import { useAcciones } from '../../shell/Acciones';

interface Valor { label: string; umbral: number | string; texto: (w: string) => string }
interface Disparador { nombre: string; desc: string; frase: (v: string) => string; etiqueta: string; unidad: string; valores: Valor[]; ventanas: string[] }

const VENT = ['6 h', '24 h', '7 días'];
const DISPARADORES: Disparador[] = [
  { nombre: 'Narrativa crece', desc: 'Una narrativa gana volumen más rápido de lo habitual.', frase: (v) => `una narrativa sube más de ${v}`, etiqueta: 'La narrativa sube más de', unidad: '%', ventanas: VENT,
    valores: [20, 40, 60, 100].map((n) => ({ label: `${n}%`, umbral: n, texto: (w) => `Sube más de ${n}% en ${w}` })) },
  { nombre: 'Índice de riesgo sube', desc: 'El índice de una figura llega al nivel que definas.', frase: (v) => `el índice de riesgo llega a ${v}`, etiqueta: 'El índice de riesgo llega a', unidad: 'índice', ventanas: VENT,
    valores: [['50 (Medio)', 50], ['65', 65], ['75 (Alto)', 75], ['85', 85]].map(([l, n]) => ({ label: String(l), umbral: n, texto: () => `Llega a ${l}` })) },
  { nombre: 'Rival publica en tema propio', desc: 'Una figura rival entra en un tema de la campaña.', frase: (v) => `una figura rival publica ${v} sobre un tema propio`, etiqueta: 'Publicaciones del rival sobre el tema', unidad: 'publicaciones', ventanas: VENT,
    valores: [1, 3, 5, 10].map((n) => ({ label: n === 1 ? '1 vez' : `${n} veces`, umbral: n, texto: (w) => `${n} ${n === 1 ? 'publicación' : 'publicaciones'} en ${w}` })) },
  { nombre: 'Sentimiento neto baja', desc: 'El sentimiento neto de una figura cae varios puntos.', frase: (v) => `el sentimiento neto baja ${v}`, etiqueta: 'El sentimiento neto baja', unidad: 'puntos', ventanas: VENT,
    valores: [3, 5, 8, 12].map((n) => ({ label: `${n} puntos`, umbral: n, texto: (w) => `Baja ${n} puntos en ${w}` })) },
  { nombre: 'Pico de menciones', desc: 'El volumen supera lo habitual para esa hora.', frase: (v) => `las menciones superan ${v}`, etiqueta: 'Las menciones superan', unidad: 'veces lo habitual', ventanas: ['1 h', '6 h', '24 h'],
    valores: [1.5, 2, 3, 5].map((n) => ({ label: `${n} veces lo habitual`, umbral: n, texto: (w) => `${n} veces lo habitual en ${w}` })) },
  { nombre: 'Nota en medio destacado', desc: 'Un medio de tu lista publica una nota de alto alcance. Se cuenta, nunca se valora en dinero.', frase: (v) => `una nota en medio destacado supera ${v} de alcance`, etiqueta: 'Alcance de la nota mayor a', unidad: 'alcance', ventanas: ['Por nota'],
    valores: [50000, 100000, 250000, 500000].map((n) => ({ label: num(n), umbral: n, texto: () => `Alcance mayor a ${num(n)}` })) },
  { nombre: 'Posible actividad coordinada', desc: 'Muchas cuentas recientes publican lo mismo a la vez. Nunca señala a una figura como autora.', frase: (v) => `hay posible actividad coordinada, sensibilidad ${v}`, etiqueta: 'Sensibilidad', unidad: 'sensibilidad', ventanas: VENT,
    valores: ['baja', 'equilibrada', 'alta', 'muy alta'].map((s) => ({ label: s, umbral: s, texto: () => `Sensibilidad ${s}` })) },
];
const RELS: Array<[string, string, string]> = [['Propia', 'Propia', 'Figura propia'], ['Aliada', 'Aliadas', 'Aliadas'], ['Rival', 'Rivales', 'Rivales'], ['A observar', 'A observar', 'A observar']];
const FIGS_TXT: Record<string, string> = { Propia: 'la figura propia', Aliada: 'aliadas', Rival: 'rivales', 'A observar': 'figuras a observar' };
const CANALES = ['En la app', 'Email', 'WhatsApp', 'Telegram', 'Slack'];
const SEVERIDADES = ['Alta', 'Media', 'Baja'];
const PASOS = ['Disparador', 'Umbral', 'Alcance', 'Entrega'];

interface Estado {
  paso: number; trig: number; v: number; w: string; sev: string; rels: string[]; temas: string[];
  canales: string[]; para: string[]; quieto: boolean; nombre: string; nombreTocado: boolean;
  /** Valor guardado que no está en el catálogo (al editar una regla existente). */
  actual: Valor | null;
}

function inicial(r: ReglaAlerta | null, yo: Persona | null): Estado {
  if (!r) return { paso: 0, trig: 0, v: 1, w: '24 h', sev: 'Media', rels: ['Propia'], temas: [], canales: ['En la app'], para: yo ? [yo.id] : [], quieto: true, nombre: '', nombreTocado: false, actual: null };
  const c: Json = r.condicion ?? {};
  const trig = Math.max(0, DISPARADORES.findIndex((d) => d.nombre === r.tipo));
  const d = DISPARADORES[trig];
  const v = d.valores.findIndex((x) => String(x.umbral) === String(c.umbral));
  const actual: Valor | null = v < 0 && c.texto ? { label: `Actual: ${c.texto}`, umbral: c.umbral ?? '', texto: () => c.texto } : null;
  return {
    paso: 0, trig, v: v < 0 ? -1 : v, w: c.ventana ?? d.ventanas[0], sev: r.severidad, rels: c.alcance?.relaciones ?? [], temas: c.alcance?.tema_ids ?? [],
    canales: r.canales ?? [], para: (r.destinatarios ?? []).map((x) => x.persona_id).filter(Boolean), quieto: r.extra?.horario_silencioso !== false,
    nombre: r.nombre, nombreTocado: true, actual,
  };
}

export function Constructor({ regla, campana, temas, figuras, personas, yo, ordenNuevo, alTerminar }: {
  regla: ReglaAlerta | null; campana: Campana; temas: Tema[]; figuras: FiguraCampana[]; personas: Persona[]; yo: Persona | null;
  ordenNuevo: number; alTerminar: (creada: string | null) => void;
}) {
  const { aviso } = useAcciones();
  const [b, setB] = useState<Estado>(() => inicial(regla, yo));
  const [guardando, setGuardando] = useState(false);
  const set = (p: Partial<Estado>) => setB((x) => ({ ...x, ...p }));
  const alternar = (lista: string[], v: string) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);

  const d = DISPARADORES[b.trig];
  const valores = b.actual ? [b.actual, ...d.valores] : d.valores;
  const val = b.v < 0 ? b.actual! : d.valores[b.v];
  const ventanas = d.ventanas.includes(b.w) ? d.ventanas : [b.w, ...d.ventanas];
  const enVentana = b.w === 'Por nota' ? 'por nota' : `en ${b.w}`;
  const frase = `Avisar cuando ${d.frase(val.label.replace(/^Actual: /, ''))} ${enVentana}.`;
  const alcanceViejo: Json = regla?.condicion?.alcance ?? {};
  const figuraIds: string[] = alcanceViejo.figura_ids ?? [];
  const nombresTemas = b.temas.map((id) => temas.find((t) => t.id === id)?.nombre).filter(Boolean) as string[];
  const figsTxt = b.rels.length ? b.rels.map((r) => FIGS_TXT[r]).join(', ')
    : figuraIds.length ? figuraIds.map((id) => figuras.find((f) => f.figura_id === id)?.nombre ?? id).join(', ') : 'todas las figuras de la campaña';
  const temTxt = nombresTemas.length ? nombresTemas.join(', ') : 'todos los temas';
  const canales = b.canales.length ? b.canales : ['En la app'];
  const nombreAuto = `${d.nombre} · ${val.label.replace(/^Actual: /, '')}`;
  const nombre = (b.nombreTocado ? b.nombre : nombreAuto).trim();
  const resumen = `${frase} Severidad ${b.sev.toLowerCase()}. Vigila ${figsTxt} en ${temTxt}. Avisaría por ${canales.join(', ')} a ${b.para.length === 1 ? '1 persona' : `${b.para.length} personas`}.`;

  async function guardar() {
    if (!nombre) { aviso('Ponle nombre a la regla'); set({ paso: 3 }); return; }
    setGuardando(true);
    const relTxt = b.rels.map((r) => RELS.find((x) => x[0] === r)?.[2] ?? r).join(', ');
    const alcanceTxt = [relTxt || (figuraIds.length ? figsTxt : 'Todas las figuras'), nombresTemas.join(', ')].filter(Boolean).join(' · ');
    const alcance: Json = { ...alcanceViejo };
    if (b.rels.length) alcance.relaciones = b.rels; else delete alcance.relaciones;
    if (b.temas.length) alcance.tema_ids = b.temas; else delete alcance.tema_ids;
    const fila: Partial<ReglaAlerta> = {
      nombre, tipo: d.nombre, severidad: b.sev,
      condicion: { ...(regla?.condicion ?? {}), texto: val.texto(b.w), umbral: val.umbral, unidad: d.unidad, ventana: b.w, alcance, alcance_texto: alcanceTxt },
      canales, destinatarios: b.para.map((persona_id) => ({ persona_id })),
      extra: { ...(regla?.extra ?? {}), horario_silencioso: b.quieto },
    };
    try {
      if (regla) {
        await db.cambiar<ReglaAlerta>('reglas_alerta', regla.id, fila);
        aviso('Regla guardada');
        alTerminar(null);
      } else {
        await db.crear<ReglaAlerta>('reglas_alerta', { ...fila, campana_id: campana.id, activa: true, orden: ordenNuevo, disparos_30d: 0 });
        alTerminar(nombre);
      }
    } catch (e) {
      aviso(e instanceof Error ? e.message : String(e));
    } finally { setGuardando(false); }
  }

  const tg = (lista: string[], activos: string[] | string, al: (v: string) => void, etiqueta?: (v: string) => string) => (
    <div className="tg">
      {lista.map((v) => (
        <button key={v} type="button" className="tgl" aria-pressed={Array.isArray(activos) ? activos.includes(v) : activos === v} onClick={() => al(v)}>{etiqueta ? etiqueta(v) : v}</button>
      ))}
    </div>
  );

  return (
    <section className="card fade al-sel" aria-label={regla ? 'Editar regla' : 'Nueva regla'}>
      <div className="ch">
        <h2 style={{ fontSize: 17, lineHeight: '24px' }}>{regla ? `Editar regla: ${regla.nombre}` : 'Nueva regla de alerta'}</h2>
        <button type="button" className="btn bg" onClick={() => alTerminar(null)}>Cancelar</button>
      </div>
      <div className="stp" role="list" aria-label="Pasos">
        {PASOS.map((l, k) => (
          <button key={l} type="button" role="listitem" className={'st' + (k === b.paso ? ' cur' : k < b.paso ? ' ok' : '')} aria-current={k === b.paso ? 'step' : undefined} onClick={() => set({ paso: k })}>
            <i>{k + 1}</i>{l}
          </button>
        ))}
      </div>

      {b.paso === 0 ? (
        <>
          <p className="mu">Qué cambio quieres que te avise.</p>
          <div className="opts">
            {DISPARADORES.map((t, k) => (
              <button key={t.nombre} type="button" className="opt" aria-pressed={k === b.trig}
                onClick={() => set(k === b.trig ? {} : { trig: k, v: 1, w: t.ventanas.includes('24 h') ? '24 h' : t.ventanas[0], actual: null })}>
                <span className="b">{t.nombre}</span><span className="mu">{t.desc}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      {b.paso === 1 ? (
        <>
          <div className="fg"><span className="kl">{d.etiqueta}</span>
            <div className="tg" role="group" aria-label="Valor del umbral">
              {valores.map((x, k) => {
                const idx = b.actual ? k - 1 : k;
                return <button key={x.label} type="button" className="tgl" aria-pressed={idx === b.v} onClick={() => set({ v: idx })}>{x.label}</button>;
              })}
            </div>
          </div>
          <div className="fg"><span className="kl">Ventana de tiempo</span>{tg(ventanas, b.w, (w) => set({ w }))}</div>
          <div className="fg"><span className="kl">Severidad de la alerta</span>{tg(b.sev === 'Según tamaño' ? [...SEVERIDADES, 'Según tamaño'] : SEVERIDADES, b.sev, (sev) => set({ sev }))}</div>
          <div className="well" role="status" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="b">{frase}</span>
            <span className="mu">Sin datos de ingesta todavía, no se puede estimar cuántas alertas daría este umbral.</span>
          </div>
        </>
      ) : null}

      {b.paso === 2 ? (
        <>
          <div className="fg"><span className="kl">Figuras, por relación</span>{tg(RELS.map((r) => r[0]), b.rels, (r) => set({ rels: alternar(b.rels, r) }), (r) => RELS.find((x) => x[0] === r)![1])}</div>
          <div className="fg"><span className="kl">Temas</span>
            {temas.length ? tg(temas.map((t) => t.id), b.temas, (t) => set({ temas: alternar(b.temas, t) }), (id) => temas.find((t) => t.id === id)?.nombre ?? id)
              : <span className="mu">La campaña todavía no tiene temas: la regla vigila todos.</span>}
          </div>
          <p className="mu">La regla vigila {figsTxt} en {temTxt}. Sin selección se vigila todo.</p>
        </>
      ) : null}

      {b.paso === 3 ? (
        <>
          <label className="campo" style={{ maxWidth: 460 }}>
            <span>Nombre de la regla</span>
            <input className="entrada" value={b.nombreTocado ? b.nombre : nombreAuto} onChange={(e) => set({ nombre: e.target.value, nombreTocado: true })} />
          </label>
          <div className="fg"><span className="kl">Canales</span>{tg(CANALES, b.canales, (c) => set({ canales: alternar(b.canales, c) }))}</div>
          <div className="fg"><span className="kl">Destinatarios</span>
            {personas.length ? tg(personas.map((p) => p.id), b.para, (id) => set({ para: alternar(b.para, id) }), (id) => {
              const p = personas.find((x) => x.id === id);
              return `${p?.nombre ?? id}${p?.puesto ? `, ${p.puesto.toLowerCase()}` : ''}${id === yo?.id ? ' (tú)' : ''}`;
            }) : <span className="mu">No hay personas del equipo en esta campaña.</span>}
          </div>
          <div className="fg"><span className="kl">Horario silencioso</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <button type="button" className="swt" role="switch" aria-checked={b.quieto} aria-label="Horario silencioso de 23:00 a 6:00" onClick={() => set({ quieto: !b.quieto })}><i /></button>
              <span className="sm">{b.quieto ? 'De 23:00 a 6:00 no se enviarían avisos. Las alertas altas ignoran el horario silencioso.' : 'Sin horario silencioso: avisaría a cualquier hora.'}</span>
            </div>
          </div>
          <div className="well sm"><span className="b">Resumen:</span> {resumen}</div>
          <p className="mu">El envío de avisos por Email, WhatsApp, Telegram y Slack todavía no está conectado: la regla guarda los canales y destinatarios para cuando lo esté. Por esos canales solo viajarán el título, la severidad y un enlace que pide iniciar sesión.</p>
        </>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {b.paso > 0 ? <button type="button" className="btn bg" onClick={() => set({ paso: b.paso - 1 })}>Atrás</button> : null}
        {b.paso < 3
          ? <button type="button" className="btn bp" onClick={() => set({ paso: b.paso + 1 })}>Continuar</button>
          : <button type="button" className="btn bp" disabled={guardando} onClick={guardar}>{regla ? 'Guardar cambios' : 'Crear regla'}</button>}
        {regla && b.paso < 3 ? <button type="button" className="btn bg" disabled={guardando} onClick={guardar}>Guardar cambios</button> : null}
        <span className="mu">{frase}</span>
      </div>
    </section>
  );
}
