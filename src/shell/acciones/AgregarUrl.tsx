// Panel "Agregar URL": registra a mano una nota o publicación que el monitoreo no captó.
// Guarda una fila real en `menciones` (origen Manual, estado Por procesar). No lee ni analiza el enlace:
// eso le toca a la ingesta (fase 2), y el panel lo dice.
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import './AgregarUrl.css';
import type { Panel } from '../Acciones';
import { useAcciones } from '../Acciones';
import { useCampanas } from '../Campana';
import { useSesion } from '../Sesion';
import { Icono } from '../Iconos';
import { db } from '../../lib/db';
import { useConsulta, useTabla } from '../../lib/hooks';
import type { Evento, FiguraCampana, Mencion, MencionFigura, RolCampana, Sentimiento, Tema } from '../../lib/tipos';

const CANALES = ['Medio digital', 'X', 'Facebook', 'Instagram', 'TikTok', 'YouTube', 'Radio', 'Televisión'];
const SENTIMIENTOS: Sentimiento[] = ['Favorable', 'Neutral', 'Desfavorable'];
const EDITA: Array<RolCampana | null> = ['Administración', 'Análisis'];

function urlValida(v: string): boolean {
  if (!/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(v)) return false;
  try { new URL(v); return true; } catch { return false; }
}
function dominio(v: string): string {
  try { return new URL(v).hostname.replace(/^www\./, ''); } catch { return ''; }
}

export function AgregarUrl({ cerrar }: { panel: Panel; cerrar: () => void }) {
  // El panel se monta fuera de las rutas: la campaña sale de la dirección actual.
  const { pathname } = useLocation();
  const enRuta = /^\/c\/([^/]+)/.exec(pathname)?.[1] ?? null;
  const { campanas } = useCampanas();
  const { persona } = useSesion();
  const { aviso } = useAcciones();

  // Rol en cada campaña visible, para ofrecer solo las que la persona puede editar.
  const ids = campanas.map((c) => c.id).join(',');
  const roles = useConsulta<Record<string, RolCampana | null>>(
    async () => Object.fromEntries(await Promise.all(campanas.map(async (c) => [c.id, await db.rpc<RolCampana | null>('mi_rol', { p_campana: c.id })] as const))),
    [ids], {},
  );
  const editables = campanas.filter((c) => EDITA.includes(roles.datos[c.id] ?? null));
  const [elegida, setElegida] = useState<string>('');
  const cid = enRuta ?? (elegida || editables[0]?.id || '');
  const campana = campanas.find((c) => c.id === cid) ?? null;
  const puede = !!cid && EDITA.includes(roles.datos[cid] ?? null);

  const figuras = useTabla<FiguraCampana>('v_figuras_campana', { eq: { campana_id: cid }, orden: 'orden' }, puede);
  const temas = useTabla<Tema>('temas', { eq: { campana_id: cid }, orden: 'orden' }, puede);
  const eventos = useTabla<Evento>('eventos', { eq: { campana_id: cid }, orden: [['fecha_inicio', 'desc']] }, puede);

  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [canal, setCanal] = useState(CANALES[0]);
  const [titulo, setTitulo] = useState('');
  const [elegidas, setElegidas] = useState<Record<string, Sentimiento>>({});
  const [tocoFiguras, setTocoFiguras] = useState(false);
  const [tema, setTema] = useState('');
  const [evento, setEvento] = useState('');
  const [nota, setNota] = useState('');
  const [reviso, setReviso] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Al cambiar de campaña se reinician las elecciones que dependen de ella.
  useEffect(() => { setElegidas({}); setTocoFiguras(false); setTema(''); setEvento(''); }, [cid]);
  // La figura propia viene marcada, como en la demo; se puede quitar.
  const propiaId = campana?.figura_propia_id ?? null;
  useEffect(() => {
    if (!tocoFiguras && propiaId && figuras.datos.some((f) => f.figura_id === propiaId)) setElegidas({ [propiaId]: 'Neutral' });
  }, [propiaId, figuras.datos, tocoFiguras]);

  // ¿Ya está esta URL en Menciones? Consulta real a la base.
  const limpia = url.trim();
  const valida = urlValida(limpia);
  const [dup, setDup] = useState<{ clave: string; repetida: boolean } | null>(null);
  const clave = `${cid}|${limpia}`;
  useEffect(() => {
    if (!valida || !puede) return;
    let vivo = true;
    const variantes = limpia.endsWith('/') ? [limpia, limpia.slice(0, -1)] : [limpia, limpia + '/'];
    const t = window.setTimeout(() => {
      db.listar<Mencion>('menciones', { eq: { campana_id: cid, url: variantes }, limite: 1 })
        .then((r) => { if (vivo) setDup({ clave, repetida: r.length > 0 }); })
        .catch((e: unknown) => { if (vivo) setError(e instanceof Error ? e.message : String(e)); });
    }, 350);
    return () => { vivo = false; window.clearTimeout(t); };
  }, [clave, valida, puede, cid, limpia]);
  const comprobada = dup?.clave === clave;
  const repetida = comprobada && !!dup?.repetida;

  const caja = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    window.setTimeout(() => (entrada.current ?? caja.current?.querySelector<HTMLElement>('button,select,input'))?.focus({ preventScroll: true }), 0);
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); cerrar(); return; }
      if (e.key !== 'Tab' || !caja.current) return;
      const f = Array.from(caja.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select,textarea')).filter((n) => n.offsetParent !== null);
      if (!f.length) return;
      const dentro = caja.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === f[0] || !dentro)) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && (document.activeElement === f[f.length - 1] || !dentro)) { e.preventDefault(); f[0].focus(); }
    };
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('keydown', tecla); anterior?.focus?.({ preventScroll: true }); };
  }, [cerrar]);

  const figIds = figuras.datos.map((f) => f.figura_id).filter((id) => elegidas[id]);
  const falta = !limpia ? 'Pega el enlace para continuar.'
    : !valida ? 'El enlace debe empezar con http:// o https://'
      : !comprobada ? 'Comprobando si la URL ya está en Menciones…'
        : repetida ? 'Esta URL ya está en Menciones.'
          : !figIds.length ? 'Falta elegir una figura.'
            : !reviso ? 'Falta confirmar la revisión.' : '';

  function alternar(id: string) {
    setTocoFiguras(true);
    setElegidas((x) => { const n = { ...x }; if (n[id]) delete n[id]; else n[id] = 'Neutral'; return n; });
  }

  async function guardar() {
    if (falta || !campana) { if (!valida && limpia) setError(falta); return; }
    setGuardando(true);
    try {
      const ahora = new Date().toISOString();
      // La figura principal: la propia si está elegida, si no la primera de la lista.
      const principal = propiaId && elegidas[propiaId] ? propiaId : figIds[0];
      const m = await db.crear<Mencion>('menciones', {
        campana_id: campana.id,
        canal,
        fuente: dominio(limpia) || null,
        titulo: titulo.trim() || null,
        url: limpia,
        figura_id: principal,
        tema_id: tema || null,
        evento_id: evento || null,
        sentimiento: null,
        sentimiento_manual: elegidas[principal],
        requiere_revision: false,
        revisada: true,
        revisada_por: persona?.id ?? null,
        revisada_en: ahora,
        estado: 'Por procesar',
        origen: 'Manual',
        extra: { agregada_por: persona?.id ?? null, agregada_en: ahora },
      });
      await db.crearVarias<MencionFigura>('mencion_figuras', figIds.map((f) => ({ campana_id: campana.id, mencion_id: m.id, figura_id: f, sentimiento: null, sentimiento_manual: elegidas[f] })));
      if (nota.trim()) await db.crear('notas_internas', { campana_id: campana.id, entidad: 'mencion', entidad_id: m.id, texto: nota.trim(), autor_id: persona?.id ?? null });
      cerrar();
      aviso('Mención guardada como Manual. Queda por procesar: el enlace todavía no se lee ni se analiza.', { texto: 'Ver menciones', a: `/c/${campana.id}/menciones?m=${encodeURIComponent(m.id)}` });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

  const cargandoRoles = roles.cargando;
  const sinPermiso = !cargandoRoles && !puede;

  return (
    <div className="agregar-url" onMouseDown={(e) => { if (e.target === e.currentTarget) cerrar(); }}>
      <div ref={caja} className="au-modal" role="dialog" aria-modal="true" aria-labelledby="au-titulo">
        <div className="au-mh">
          <div>
            <h2 id="au-titulo">Agregar URL</h2>
            <p className="au-mu">Suma a mano una nota o publicación que el monitoreo no captó.</p>
          </div>
          <button type="button" className="au-x" aria-label="Cerrar" onClick={cerrar}><Icono n="x" g={2} /></button>
        </div>

        {cargandoRoles ? (
          <div className="au-mb"><p className="au-mu">Cargando…</p></div>
        ) : sinPermiso ? (
          <>
            <div className="au-mb">
              <p>{enRuta ? 'Tu rol en esta campaña no permite agregar menciones.' : 'No tienes campañas donde puedas agregar menciones.'}</p>
              <p className="au-mu">Pide el rol Análisis o Administración a quien administra la campaña.</p>
            </div>
            <div className="au-mf"><button type="button" className="au-bt au-g" onClick={cerrar}>Cerrar</button></div>
          </>
        ) : (
          <>
            <div className="au-mb">
              {!enRuta ? (
                <label className="au-f">
                  <span className="au-lb">Campaña</span>
                  <select className="au-in" value={cid} onChange={(e) => setElegida(e.target.value)}>
                    {editables.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.contienda ? ` · ${c.contienda}` : ''}</option>)}
                  </select>
                </label>
              ) : null}

              <div className="au-f">
                <label className="au-lb" htmlFor="au-url">Pega el enlace de la nota o publicación</label>
                <input ref={entrada} id="au-url" className="au-in" type="url" inputMode="url" autoComplete="off" placeholder="https://medio-digital.example/nota"
                  value={url} onChange={(e) => { setUrl(e.target.value); setError(''); }}
                  onBlur={() => { if (limpia && !valida) setError('El enlace debe empezar con http:// o https://'); }} />
                {error ? <span className="au-err" role="alert">{error}</span> : null}
                {valida && comprobada ? (
                  repetida
                    ? <span className="au-err">Esta URL ya está en Menciones de esta campaña.</span>
                    : <span className="au-okl"><Icono n="ok" g={2} />Sin duplicados: esta URL todavía no está en Menciones.</span>
                ) : null}
              </div>

              <div className="au-well">
                <span className="au-note"><Icono n="info" t={14} g={2} /><span>La mención se guarda con la etiqueta <b>Manual</b> y queda <b>por procesar</b>. El enlace no se lee ni se analiza ahora: el titular, la fecha y las cifras quedan vacíos hasta que se procese.</span></span>
              </div>

              <div className="au-row">
                <label className="au-f">
                  <span className="au-lb">Canal</span>
                  <select className="au-in" value={canal} onChange={(e) => setCanal(e.target.value)}>
                    {CANALES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
                <label className="au-f" style={{ flexGrow: 2 }}>
                  <span className="au-lb">Titular (opcional)</span>
                  <input className="au-in" type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Como aparece en la fuente" />
                </label>
              </div>

              <div className="au-f">
                <span className="au-lb">Figuras mencionadas</span>
                {figuras.datos.length ? (
                  <div className="au-tgs">
                    {figuras.datos.map((f) => (
                      <button key={f.figura_id} type="button" className="au-tg" aria-pressed={!!elegidas[f.figura_id]} onClick={() => alternar(f.figura_id)}>
                        <Icono n="ok" t={12} g={2.5} />{f.nombre}
                      </button>
                    ))}
                  </div>
                ) : <span className="au-err">Esta campaña no tiene figuras en seguimiento. Agrega una figura antes de sumar menciones.</span>}
              </div>

              {figIds.length ? (
                <div className="au-f">
                  <span className="au-lb">Sentimiento para cada figura</span>
                  <div>
                    {figIds.map((id) => (
                      <div key={id} className="au-sr">
                        <span className="au-b" style={{ fontSize: 14 }}>{figuras.datos.find((f) => f.figura_id === id)?.nombre}</span>
                        <div className="au-sg" role="group" aria-label={`Sentimiento para ${figuras.datos.find((f) => f.figura_id === id)?.nombre ?? ''}`}>
                          {SENTIMIENTOS.map((s) => (
                            <button key={s} type="button" aria-pressed={elegidas[id] === s} onClick={() => setElegidas((x) => ({ ...x, [id]: s }))}>{s}</button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="au-row">
                <label className="au-f">
                  <span className="au-lb">Tema</span>
                  <select className="au-in" value={tema} onChange={(e) => setTema(e.target.value)}>
                    <option value="">Sin tema</option>
                    {temas.datos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                </label>
                <label className="au-f">
                  <span className="au-lb">Evento</span>
                  <select className="au-in" value={evento} onChange={(e) => setEvento(e.target.value)}>
                    <option value="">Ninguno</option>
                    {eventos.datos.map((ev) => <option key={ev.id} value={ev.id}>{ev.nombre}</option>)}
                  </select>
                </label>
              </div>

              <label className="au-f">
                <span className="au-lb">Nota interna (opcional)</span>
                <textarea className="au-in" rows={2} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Contexto para el equipo. No la ve el cliente." />
              </label>

              <label className="au-ck">
                <input type="checkbox" checked={reviso} onChange={(e) => setReviso(e.target.checked)} />
                <span>Revisé la URL y las figuras.<span className="au-mu" style={{ display: 'block' }}>Queda registrado quién la agregó y cuándo.</span></span>
              </label>
            </div>

            <div className="au-mf">
              <span className="au-mu">{falta}</span>
              <button type="button" className="au-bt au-g" onClick={cerrar}>Cancelar</button>
              <button type="button" className="au-bt au-p" disabled={!!falta || guardando} onClick={() => void guardar()}>{guardando ? 'Guardando…' : 'Guardar mención'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
