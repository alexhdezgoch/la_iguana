// Agregar figura: elegir una figura del directorio del equipo y vincularla, o crear una nueva.
// Lee figuras, campana_figuras, v_figuras_campana. Escribe figuras, campana_figuras, terminos, notas_internas
// y, si la campaña aún no tiene figura propia, campanas.figura_propia_id.
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import './AgregarFigura.css';
import { db } from '../lib/db';
import { useTabla } from '../lib/hooks';
import { REL, iniciales, num, sugerirNombreCorto } from '../lib/formato';
import type { CampanaFigura, Cuenta, Figura, FiguraCampana, Relacion } from '../lib/tipos';
import { useCampana, useCampanas, usePagina } from '../shell/Campana';
import { useSesion } from '../shell/Sesion';
import { useAcciones } from '../shell/Acciones';
import { Carga } from '../shell/Estados';
import { SinPermiso, normal, usePermiso } from './agregar-figura/acceso';
import { Aviso, Casilla, EQUIPOS, Etiqueta, Opciones, type Equipo } from './agregar-figura/partes';

// Catálogos del formulario: texto fijo de la interfaz.
const RELACIONES: Relacion[] = ['Propia', 'Aliada', 'Rival', 'A observar'];
const TIPOS = ['Candidata o candidato', 'Dirigente de partido', 'Funcionaria o funcionario', 'Vocera o vocero'] as const;
const REDES = ['X', 'Instagram', 'Facebook', 'TikTok', 'YouTube'] as const;
const CLASES_TERMINO = ['Nombre', 'Apodo', 'Hashtag', 'Error de escritura'] as const;
type ClaseTermino = (typeof CLASES_TERMINO)[number];
const MAX_TERMINOS = 30;

interface Nueva { nombre: string; cargo: string; partido: string; coalicion: string; territorio: string; tipo: string | null; notas: string }
const VACIA: Nueva = { nombre: '', cargo: '', partido: '', coalicion: '', territorio: '', tipo: null, notas: '' };
interface TerminoNuevo { tipo: ClaseTermino; texto: string }

const SVG_MAS = <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;
const SVG_BUSCAR = <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: 'absolute', left: 12, top: 10, color: '#636C66' }}><path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3" /></svg>;

function sub(f: { cargo: string | null; partido: string | null }) {
  return [f.cargo, f.partido].filter(Boolean).join(' · ') || 'Sin cargo ni partido';
}
/** Palabras del nombre que sirven para detectar duplicados: apellidos, no el primer nombre. */
function apellidos(nombre: string): string[] {
  const p = normal(nombre).split(/\s+/).filter((w) => w.length >= 4 && !/^(del|las|los)$/.test(w));
  return p.length > 1 ? p.slice(1) : p;
}
function lista(nombres: string[]) {
  return nombres.length <= 1 ? nombres.join('') : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

export default function AgregarFigura() {
  const campana = useCampana();
  const cid = campana.id;
  const base = `/c/${cid}`;
  usePagina('Agregar figura', [{ texto: 'Figuras', a: `${base}/figuras` }]);
  const navegar = useNavigate();
  const { persona } = useSesion();
  const { aviso } = useAcciones();
  const { campanas } = useCampanas();
  const permiso = usePermiso(cid);

  const [params, setParams] = useSearchParams();
  const modo = params.get('modo') === 'nueva' ? 'nueva' : 'directorio';
  const elegidaId = modo === 'directorio' ? params.get('figura') : null;
  const fijar = (cambios: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(cambios)) if (v == null) p.delete(k); else p.set(k, v);
    setParams(p, { replace: true });
  };

  const figuras = useTabla<Figura>('figuras', { eq: { org_id: campana.org_id }, orden: 'nombre' });
  const vinculos = useTabla<CampanaFigura>('campana_figuras', {});
  const enOtras = useTabla<FiguraCampana>('v_figuras_campana', { eq: { figura_id: elegidaId ?? '' } }, !!elegidaId);

  const [q, setQ] = useState('');
  const [rel, setRel] = useState<Relacion | null>(null);
  const [resp, setResp] = useState<Equipo>('Equipo de análisis');
  const [f, setF] = useState<Nueva>(VACIA);
  const [terminos, setTerminos] = useState<TerminoNuevo[]>([]);
  const [clase, setClase] = useState<ClaseTermino>('Nombre');
  const [borradorTermino, setBorradorTermino] = useState('');
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [red, setRed] = useState<(typeof REDES)[number]>('X');
  const [borradorCuenta, setBorradorCuenta] = useState('');
  const [ayudaCuenta, setAyudaCuenta] = useState<string | null>(null);
  const [confirmo, setConfirmo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const nombreCampana = (id: string) => campanas.find((c) => c.id === id)?.nombre ?? id;

  // Directorio: cada figura del equipo con sus campañas visibles.
  const filas = useMemo(() => figuras.datos.map((fig) => {
    const vs = vinculos.datos.filter((v) => v.figura_id === fig.id);
    const aqui = vs.find((v) => v.campana_id === cid) ?? null;
    const otras = vs.filter((v) => v.campana_id !== cid).map((v) => nombreCampana(v.campana_id));
    const tag = aqui ? (otras.length ? `Ya en esta campaña y en ${lista(otras)}` : 'Ya en esta campaña') : otras.length ? `Ya en: ${lista(otras)}` : 'Sin campañas';
    const texto = normal([fig.nombre, fig.cargo, fig.partido, fig.coalicion, fig.territorio, ...(fig.cuentas ?? []).map((c) => c.usuario)].join(' '));
    return { fig, aqui, otras, tag, texto };
  }).sort((a, b) => (a.aqui ? 1 : 0) - (b.aqui ? 1 : 0) || (a.aqui?.orden ?? 0) - (b.aqui?.orden ?? 0)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [figuras.datos, vinculos.datos, cid, campanas]);
  const nq = normal(q);
  const encontradas = nq ? filas.filter((r) => r.texto.includes(nq)) : filas;
  const vinculables = filas.filter((r) => !r.aqui).length;
  const elegida = filas.find((r) => r.fig.id === elegidaId && !r.aqui) ?? null;

  // Duplicados: apellidos del nombre escrito contra el directorio.
  const misApellidos = modo === 'nueva' ? apellidos(f.nombre) : [];
  const dups = misApellidos.length ? filas.filter((r) => apellidos(r.fig.nombre).some((a) => misApellidos.includes(a))) : [];

  const ordenSiguiente = Math.max(0, ...vinculos.datos.filter((v) => v.campana_id === cid).map((v) => v.orden)) + 1;

  // ---------- acciones del formulario ----------
  const agregarTermino = () => {
    let v = borradorTermino.trim();
    if (!v || terminos.length >= MAX_TERMINOS) return;
    if (clase === 'Hashtag' && v[0] !== '#') v = '#' + v.replace(/\s+/g, '');
    if (terminos.some((t) => normal(t.texto) === normal(v))) { setBorradorTermino(''); return; }
    setTerminos([...terminos, { tipo: clase, texto: v }]);
    setBorradorTermino('');
  };
  const agregarCuenta = () => {
    let v = borradorCuenta.trim();
    if (!v) { setAyudaCuenta('Escribe la cuenta o pega la URL del perfil.'); return; }
    if (v[0] !== '@' && !v.includes('/')) v = '@' + v;
    if (cuentas.some((c) => c.red === red && normal(c.usuario) === normal(v))) { setBorradorCuenta(''); return; }
    setCuentas([...cuentas, { red, usuario: v, verificada: false }]);
    setBorradorCuenta('');
    setAyudaCuenta('Cuenta agregada sin verificar. Se guarda tal cual la escribiste.');
  };
  const irANueva = () => {
    const k = q.trim();
    if (k && !f.nombre) {
      setF({ ...VACIA, nombre: k });
      if (!terminos.length) setTerminos([{ tipo: 'Nombre', texto: k }]);
    }
    setRel(null);
    fijar({ modo: 'nueva', figura: null });
  };

  /** Después de vincular: la campaña sin figura propia toma esta como propia (solo Administración puede). */
  const fijarPropia = async (figuraId: string, relacion: Relacion) => {
    if (relacion !== 'Propia' || campana.figura_propia_id || !permiso.puedeAdministrar) return;
    try { await db.cambiar('campanas', cid, { figura_propia_id: figuraId }); } catch { /* el vínculo ya quedó; la figura propia se fija después */ }
  };

  const vincular = async () => {
    if (!elegida || !rel || guardando) return;
    setGuardando(true);
    try {
      await db.crear<CampanaFigura>('campana_figuras', { campana_id: cid, figura_id: elegida.fig.id, relacion: rel, orden: ordenSiguiente, extra: { responsable_equipo: resp } });
      await db.crear('terminos', { campana_id: cid, figura_id: elegida.fig.id, texto: elegida.fig.nombre, tipo: 'Nombre', orden: 1 });
      await fijarPropia(elegida.fig.id, rel);
      aviso(`${elegida.fig.nombre} se vinculó como ${rel}`, { texto: 'Ver figuras', a: `${base}/figuras` });
      navegar(`${base}/figuras/${elegida.fig.id}`);
    } catch (e) {
      aviso(e instanceof Error ? e.message : String(e));
      setGuardando(false);
    }
  };

  const faltan: string[] = [];
  if (!f.nombre.trim()) faltan.push('nombre');
  if (!rel) faltan.push('relación');
  if (!confirmo) faltan.push('confirmación de persona pública');
  const puedeGuardar = faltan.length === 0 && !guardando;

  const guardar = async () => {
    if (!puedeGuardar || !rel) return;
    setGuardando(true);
    try {
      const nombre = f.nombre.trim();
      const limpio = (s: string) => s.trim() || null;
      const fig = await db.crear<Figura>('figuras', {
        org_id: campana.org_id, nombre, nombre_corto: sugerirNombreCorto(nombre, figuras.datos), iniciales: iniciales(nombre) || null,
        cargo: limpio(f.cargo), partido: limpio(f.partido), coalicion: limpio(f.coalicion), territorio: limpio(f.territorio), tipo: f.tipo,
        cuentas, extra: { persona_publica: { confirmada_por: persona?.id ?? null, en: new Date().toISOString() } },
      });
      await db.crear<CampanaFigura>('campana_figuras', { campana_id: cid, figura_id: fig.id, relacion: rel, orden: ordenSiguiente, extra: { responsable_equipo: resp } });
      const ts = terminos.length ? terminos : [{ tipo: 'Nombre' as const, texto: nombre }];
      await db.crearVarias('terminos', ts.map((t, i) => ({ campana_id: cid, figura_id: fig.id, texto: t.texto, tipo: t.tipo, orden: i + 1 })));
      if (f.notas.trim()) await db.crear('notas_internas', { campana_id: cid, entidad: 'figura', entidad_id: fig.id, texto: f.notas.trim(), autor_id: persona?.id ?? null });
      await fijarPropia(fig.id, rel);
      aviso(`Figura agregada como ${rel}`, { texto: 'Ver figuras', a: `${base}/figuras` });
      navegar(`${base}/figuras/${fig.id}`);
    } catch (e) {
      aviso(e instanceof Error ? e.message : String(e));
      setGuardando(false);
    }
  };

  // ---------- vista previa ----------
  const pv = modo === 'nueva'
    ? { ini: iniciales(f.nombre) || '··', nombre: f.nombre.trim() || 'Nombre de la figura', cargo: f.cargo.trim() || 'Cargo o candidatura', partido: f.partido.trim() || 'Partido' }
    : elegida ? { ini: elegida.fig.iniciales ?? iniciales(elegida.fig.nombre), nombre: elegida.fig.nombre, cargo: elegida.fig.cargo ?? 'Sin cargo', partido: elegida.fig.partido ?? 'Sin partido' } : null;
  const relCls = rel ? REL[rel].cls : '';
  const terminosVista: TerminoNuevo[] = modo === 'nueva' ? terminos : elegida ? [{ tipo: 'Nombre', texto: elegida.fig.nombre }] : [];
  const ambiguo = terminosVista.find((t) => t.tipo !== 'Hashtag' && !/\s/.test(t.texto.trim()));
  const otrasCifras = enOtras.datos.filter((x) => x.campana_id !== cid && x.menciones > 0);

  if (permiso.cargando) return <Carga estados={[permiso]}>{null}</Carga>;
  if (!permiso.puedeEditar) {
    return (
      <main className="page pg-agregar-figura">
        <div className="ph"><div><h1>Agregar figura</h1></div></div>
        <SinPermiso rol={permiso.rol} accion="agregar figuras" volver={`${base}/figuras`} volverTexto="Volver a Figuras" />
      </main>
    );
  }

  return (
    <Carga estados={[figuras, vinculos]}>
      <main className="page pg-agregar-figura">
        <div className="ph">
          <div>
            <h1>Agregar figura</h1>
            <p className="mu">Busca primero en el directorio del equipo: una figura se guarda una vez y se reutiliza entre campañas.</p>
          </div>
          <div className="acts"><Link className="btn bg" to={`${base}/figuras`}>Cancelar</Link></div>
        </div>

        <div className="row">
          <div className="col fm">
            {modo === 'directorio' ? (
              <section className="card">
                <div className="ch">
                  <h2>Buscar en el directorio del equipo</h2>
                  <span className="mu">{nq ? `${encontradas.length} de ${filas.length} figuras` : `${filas.length} ${filas.length === 1 ? 'figura' : 'figuras'} · ${vinculables} ${vinculables === 1 ? 'se puede' : 'se pueden'} vincular`}</span>
                </div>
                <div style={{ position: 'relative' }}>
                  {SVG_BUSCAR}
                  <input className="in" id="buscar" type="search" aria-label="Buscar por nombre, cuenta o apodo" placeholder="Nombre, @cuenta, cargo o partido" style={{ paddingLeft: 36 }} value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                {encontradas.length ? (
                  <div className="list fade">
                    {encontradas.map((r) => {
                      const sel = r.fig.id === elegidaId && !r.aqui;
                      return (
                        <div className={sel ? 'dr sel' : 'dr'} key={r.fig.id}>
                          <span className="ini" aria-hidden="true">{r.fig.iniciales ?? iniciales(r.fig.nombre)}</span>
                          <span className="gr" style={{ flex: '1 1 180px' }}>
                            {r.aqui ? <Link className="b tl" to={`${base}/figuras/${r.fig.id}`}>{r.fig.nombre}</Link> : <span className="b">{r.fig.nombre}</span>}
                            <span className="mu">{sub(r.fig)}</span>
                          </span>
                          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                            <span className={r.aqui ? 'chip watch' : 'chip ring'}>{r.tag}</span>
                            {r.aqui ? <span className={'chip ' + REL[r.aqui.relacion].cls}>{r.aqui.relacion}</span> : null}
                            {!r.aqui ? (
                              <button type="button" className={sel ? 'btn bp sm2' : 'btn bg sm2'} onClick={() => { setRel(null); fijar({ figura: r.fig.id }); }}>{sel ? 'Elegida' : 'Elegir'}</button>
                            ) : null}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="well fade">
                    {nq ? (
                      <><p className="b">Ninguna figura coincide con «{q}»</p><p className="mu">Revisa la escritura o crea la figura. Quedará en el directorio para las demás campañas del equipo.</p></>
                    ) : (
                      <><p className="b">El directorio del equipo está vacío</p><p className="mu">Crea la primera figura. Quedará en el directorio para las demás campañas del equipo.</p></>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 12px', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgb(22 32 25 / .07)', paddingTop: 14 }}>
                  <span className="mu" style={{ flex: '1 1 240px' }}>¿No está en el directorio? Solo ves vínculos con campañas a las que tienes acceso.</span>
                  <button type="button" className="btn bg" onClick={irANueva}>{SVG_MAS}Crear figura nueva</button>
                </div>
              </section>
            ) : null}

            {modo === 'directorio' && elegida ? (
              <section className="card fade" aria-label="Vincular a esta campaña">
                <div className="ch"><h2>Vincular a esta campaña</h2><span className="mu">Solo dos datos: el perfil ya existe</span></div>
                <div className="who">
                  <span className={'ini ' + relCls} aria-hidden="true">{pv?.ini}</span>
                  <span className="gr"><span className="b">{elegida.fig.nombre}</span><span className="mu">{sub(elegida.fig)} · {elegida.tag}</span></span>
                </div>
                <div className="fld"><span className="fl">Relación en esta campaña <span className="mu">· obligatoria</span></span>
                  <Opciones etiqueta="Relación en esta campaña" opciones={RELACIONES} valor={rel} alElegir={setRel} /></div>
                <div className="fld"><span className="fl">Responsable</span>
                  <Opciones etiqueta="Responsable" opciones={EQUIPOS} valor={resp} alElegir={setResp} /></div>
                <p className="mu">
                  La relación es de esta campaña; el perfil se comparte en el directorio.{elegida.otras.length ? ' En su otra campaña conserva su relación.' : ''} Su nombre queda como término de búsqueda de esta campaña.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 12px', alignItems: 'center' }}>
                  <button type="button" className={rel && !guardando ? 'btn bp' : 'btn bp dis'} aria-disabled={!rel || guardando} onClick={vincular}>{guardando ? 'Vinculando…' : 'Vincular a esta campaña'}</button>
                  <button type="button" className="btn bg" onClick={() => { setRel(null); fijar({ figura: null }); }}>Quitar selección</button>
                  <span className="mu">{rel ? '' : 'Elige la relación para continuar.'}</span>
                </div>
              </section>
            ) : null}

            {modo === 'nueva' ? (
              <>
                <section className="card fade">
                  <div className="ch"><h2>Crear figura nueva</h2><button type="button" className="btn bg sm2" onClick={() => { setRel(null); fijar({ modo: null }); }}>Volver al directorio</button></div>
                  <div className="fr">
                    <label className="fld" style={{ flexBasis: '100%' }}>
                      <span className="fl">Nombre completo</span>
                      <input className="in" id="nombre" type="text" placeholder="Nombre y apellido como aparece en medios" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
                      <span className="mu">Comparamos el nombre con el directorio para evitar duplicados.</span>
                    </label>
                  </div>
                  {dups.length ? (
                    <Aviso>
                      <span style={{ flex: '1 1 220px' }}><span className="b">Puede ser la misma persona que {dups.slice(0, 3).map((d) => `${d.fig.nombre}${d.fig.partido ? ` (${d.fig.partido})` : ''}`).join(' o ')}.</span> Si lo es, no la dupliques: usa la del directorio.</span>
                      <button type="button" className="btn bg sm2" onClick={() => { setQ(dups[0].fig.nombre.split(' ').pop() ?? ''); setRel(null); fijar({ modo: null }); }}>Ver en el directorio</button>
                    </Aviso>
                  ) : null}
                  <div className="fr">
                    <label className="fld"><span className="fl">Cargo o candidatura</span><input className="in" type="text" placeholder="Ej. Diputada, alcalde, precandidata" value={f.cargo} onChange={(e) => setF({ ...f, cargo: e.target.value })} /></label>
                    <label className="fld"><span className="fl">Partido</span><input className="in" type="text" placeholder="Organización política" value={f.partido} onChange={(e) => setF({ ...f, partido: e.target.value })} /></label>
                    <label className="fld"><span className="fl">Coalición <span className="mu">· opcional</span></span><input className="in" type="text" placeholder="Alianza o plataforma" value={f.coalicion} onChange={(e) => setF({ ...f, coalicion: e.target.value })} /></label>
                    <label className="fld"><span className="fl">Territorio</span><input className="in" type="text" placeholder="Nacional, estado o municipio" value={f.territorio} onChange={(e) => setF({ ...f, territorio: e.target.value })} /></label>
                  </div>
                  <div className="fld"><span className="fl">Tipo de figura</span>
                    <Opciones etiqueta="Tipo de figura" opciones={TIPOS} valor={f.tipo as (typeof TIPOS)[number] | null} alElegir={(t) => setF({ ...f, tipo: f.tipo === t ? null : t })} /></div>
                </section>

                <section className="card fade">
                  <div className="ch"><h2>Cuentas y términos de búsqueda</h2><span className="mu">{terminos.length} de {MAX_TERMINOS} términos</span></div>
                  <div className="fld"><span className="fl">Cuentas sociales</span>
                    <Opciones etiqueta="Red social" opciones={REDES} valor={red} alElegir={setRed} />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <input className="in" type="text" aria-label="Cuenta o URL" placeholder="@cuenta o URL del perfil" style={{ flex: '1 1 200px', width: 'auto' }} value={borradorCuenta}
                        onChange={(e) => setBorradorCuenta(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarCuenta(); } }} />
                      <button type="button" className="btn bg" onClick={agregarCuenta}>Agregar cuenta</button>
                    </div>
                    {cuentas.length ? (
                      <div className="ops">
                        {cuentas.map((c, i) => (
                          <Etiqueta key={c.red + c.usuario} quitar="Quitar cuenta" alQuitar={() => { setCuentas(cuentas.filter((_, j) => j !== i)); setAyudaCuenta(null); }}>
                            {c.red} · {c.usuario}<span className="chip watch">Sin verificar</span>
                          </Etiqueta>
                        ))}
                      </div>
                    ) : null}
                    <span className="mu">{ayudaCuenta ?? 'Puedes agregar varias. La comprobación automática de que la cuenta existe y es pública todavía no está activa.'}</span>
                  </div>
                  <div className="fld"><span className="fl">Términos de búsqueda</span>
                    {terminos.length ? (
                      <div className="ops">
                        {terminos.map((t, i) => (
                          <Etiqueta key={t.tipo + t.texto} quitar="Quitar término" alQuitar={() => setTerminos(terminos.filter((_, j) => j !== i))}>
                            <span className="mu" style={{ fontSize: 12 }}>{t.tipo}</span>{t.texto}
                          </Etiqueta>
                        ))}
                      </div>
                    ) : null}
                    <Opciones etiqueta="Tipo de término" opciones={CLASES_TERMINO} valor={clase} alElegir={setClase} />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <input className="in" id="termino" type="text" aria-label="Nuevo término" style={{ flex: '1 1 200px', width: 'auto' }} value={borradorTermino}
                        placeholder={clase === 'Hashtag' ? '#Etiqueta' : clase === 'Error de escritura' ? 'Como suele escribirse mal' : clase === 'Apodo' ? 'Apodo de uso público' : 'Nombre y apellido'}
                        onChange={(e) => setBorradorTermino(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarTermino(); } }} />
                      <button type="button" className={terminos.length >= MAX_TERMINOS ? 'btn bg dis' : 'btn bg'} onClick={agregarTermino}>Agregar término</button>
                    </div>
                    <span className="mu">Nombres, apodos de uso público, hashtags y errores de escritura frecuentes. Sin términos, se busca por el nombre completo.</span>
                  </div>
                </section>

                <section className="card fade">
                  <div className="ch"><h2>En esta campaña</h2><span className="mu">{campana.nombre}</span></div>
                  <div className="fld"><span className="fl">Relación en esta campaña <span className="mu">· obligatoria</span></span>
                    <Opciones etiqueta="Relación en esta campaña" opciones={RELACIONES} valor={rel} alElegir={setRel} /></div>
                  <div className="fld"><span className="fl">Responsable</span>
                    <Opciones etiqueta="Responsable" opciones={EQUIPOS} valor={resp} alElegir={setResp} /></div>
                  <label className="fld"><span className="fl">Notas internas <span className="mu">· no salen en reportes al cliente</span></span>
                    <textarea className="ta" rows={2} placeholder="Contexto para el equipo: por qué se sigue y qué vigilar" value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} /></label>
                  <p className="mu">Relación y notas son de esta campaña; el perfil se comparte en el directorio.</p>
                  <Casilla marcada={confirmo} alCambiar={() => setConfirmo(!confirmo)}>
                    <span className="b">Confirmo que es una persona pública en un rol público.</span><br />
                    <span className="mu">La Iguana no crea perfiles de ciudadanos ni de personas privadas.</span>
                  </Casilla>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 12px', alignItems: 'center', borderTop: '1px solid rgb(22 32 25 / .07)', paddingTop: 14 }}>
                    <button type="button" className={puedeGuardar ? 'btn bp' : 'btn bp dis'} aria-disabled={!puedeGuardar} onClick={guardar}>{guardando ? 'Guardando…' : 'Agregar figura'}</button>
                    <Link className="btn bg" to={`${base}/figuras`}>Cancelar</Link>
                    <span className="mu">{faltan.length ? `Falta: ${faltan.join(' · ')}.` : 'Se guarda en el directorio y se vincula a esta campaña.'}</span>
                  </div>
                </section>
              </>
            ) : null}
          </div>

          <div className="col pv">
            <section className="card">
              <div className="ch"><h2>Así aparecerá en Figuras</h2><span className="chip ring">Vista previa</span></div>
              {pv ? (
                <>
                  <div className="well fade" style={{ display: 'flex', flexDirection: 'column', gap: 12, background: '#fff', boxShadow: 'inset 0 0 0 1px rgb(22 32 25 / .10)' }}>
                    <div className="who"><span className={'ini ' + relCls} aria-hidden="true">{pv.ini}</span><span className="gr"><span className="b">{pv.nombre}</span><span className="mu">{pv.cargo}</span></span></div>
                    <div className="dl">
                      <div><span className="mu">Partido</span><span className="sm b">{pv.partido}</span></div>
                      <div><span className="mu">Relación</span><span><span className={'chip ' + (rel ? REL[rel].cls : 'ring')}>{rel ?? 'Sin relación'}</span></span></div>
                      <div><span className="mu">Menciones</span><span className="sm mu">Sin datos</span></div>
                      <div><span className="mu">Riesgo</span><span className="sm mu">Sin datos</span></div>
                    </div>
                  </div>
                  <p className="mu">{rel ? `Con esta relación entra en el filtro "${rel}" y en las comparaciones de la campaña.` : 'Elige la relación para ver cómo se etiqueta en la tabla.'}</p>
                </>
              ) : (
                <div className="well"><p className="mu">Elige una figura del directorio o crea una nueva para ver su fila antes de guardarla.</p></div>
              )}
            </section>

            <section className="card">
              <div className="ch"><h2>Qué se va a buscar</h2><span className="mu">{terminosVista.length ? `${terminosVista.length} ${terminosVista.length === 1 ? 'término' : 'términos'}` : 'Sin términos'}</span></div>
              {terminosVista.length ? (
                <div className="fade" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="list">
                    {terminosVista.map((t) => (
                      <div className="li" key={t.tipo + t.texto} style={{ padding: '8px 0' }}>
                        <span className="gr"><span className="sm">{t.texto}</span></span>
                        <span className="chip watch">{t.tipo}</span>
                      </div>
                    ))}
                  </div>
                  {ambiguo ? (
                    <div className="wn"><span><span className="b">Término de una sola palabra.</span> «{ambiguo.texto}» puede traer menciones de otras personas: agrega el nombre completo o una exclusión.</span></div>
                  ) : null}
                  {otrasCifras.map((x) => (
                    <p className="mu" key={x.id}>En {nombreCampana(x.campana_id)} registra {num(x.menciones)} menciones en su periodo. Aquí solo contará la conversación de esta campaña.</p>
                  ))}
                  <p className="mu">Las menciones se cuentan después de la primera recolección. Mientras tanto la figura aparece en Figuras con "Sin datos".</p>
                </div>
              ) : (
                <div className="well"><p className="mu">{modo === 'nueva' ? 'Agrega términos de búsqueda o se buscará por el nombre completo.' : 'Los términos aparecen al elegir una figura o al crear una nueva.'}</p></div>
              )}
            </section>
          </div>
        </div>
      </main>
    </Carga>
  );
}
