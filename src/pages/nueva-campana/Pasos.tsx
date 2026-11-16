// Los seis pasos del asistente. Cada uno edita el borrador en memoria; NuevaCampana lo guarda en `borradores`.
import { useState, type KeyboardEvent } from 'react';
import { REL, iniciales } from '../../lib/formato';
import type { Figura, Persona, Relacion, RolCampana } from '../../lib/tipos';
import {
  COLOR_FASE, MAX_TERMINOS, ORDEN_REL, PAISES, PASOS, ROLES, ROL_MIN, TIPOS_ELECCION, ZONAS,
  claveFigura, diasFase, fasesSugeridas, fd, figurasOrdenadas, nuevaClave, rangoFase, territorio, tipoTermino,
  type Calendario, type DatosB, type FiguraB, type MiembroB, type TerminoB,
} from './modelo';

export interface Ctx {
  d: DatosB;
  upd: (p: Partial<DatosB>) => void;
  hoy: string;
  cal: Calendario;
  bad: string[];
  directorio: Figura[];
  yaEn: Map<string, string[]>;
  personas: Persona[];
  yo: string | null;
  orgNombre: string;
  go: (n: number) => void;
}

export function nombreFigura(f: FiguraB, directorio: Figura[]): string {
  if (f.nueva) return f.nueva.nombre;
  return directorio.find((x) => x.id === f.figura_id)?.nombre ?? 'Figura sin acceso';
}
function listaY(l: string[]): string {
  return l.length <= 1 ? l.join('') : l.slice(0, -1).join(', ') + ' y ' + l[l.length - 1];
}
function metaFigura(f: { id?: string; partido?: string | null; cargo?: string | null }, yaEn: Map<string, string[]>, nueva = false): string {
  const en = f.id ? yaEn.get(f.id) ?? [] : [];
  const base = [f.partido, f.cargo].filter(Boolean).join(' · ');
  const donde = nueva ? 'Nueva: se agrega al directorio al crear la campaña' : en.length ? `Ya en: ${listaY(en)}` : 'Todavía en ninguna campaña';
  return [base, donde].filter(Boolean).join(' · ');
}
export function datosMiembro(m: MiembroB, personas: Persona[]): { ini: string; nombre: string; sub: string } {
  if (m.persona_id) {
    const p = personas.find((x) => x.id === m.persona_id);
    const nombre = p?.nombre ?? 'Persona del equipo';
    return { ini: p?.iniciales ?? iniciales(nombre), nombre, sub: p?.puesto ?? p?.email ?? 'Equipo' };
  }
  const nombre = m.nombre?.trim() || m.email?.trim() || 'Invitación';
  return {
    ini: m.nombre?.trim() ? iniciales(m.nombre) : '@',
    nombre,
    sub: [m.nota ?? 'Invitación', m.email && m.nombre ? m.email : '', 'la cuenta la crea quien administra Wana'].filter(Boolean).join(' · '),
  };
}

// ---------- editor de chips ----------
function Chips({ lista, cls, etiqueta, ph, agregar, quitar, boton = 'Agregar' }: {
  lista: string[]; cls: string; etiqueta: string; ph: string; agregar: (t: string) => void; quitar: (t: string) => void; boton?: string;
}) {
  const [borr, setBorr] = useState('');
  const va = () => {
    const t = borr.trim();
    if (t && !lista.includes(t) && lista.length < MAX_TERMINOS) { agregar(t); setBorr(''); }
  };
  const tecla = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.preventDefault(); va(); } };
  return (
    <div className="tg">
      {lista.map((t) => (
        <span key={t} className={cls}>{t}<button type="button" className="x" aria-label={`Quitar ${t}`} onClick={() => quitar(t)}>×</button></span>
      ))}
      <span style={{ flex: '1 1 240px', display: 'flex', gap: 6 }}>
        <input className="in" style={{ height: 30 }} type="text" placeholder={ph} aria-label={etiqueta} value={borr} onChange={(e) => setBorr(e.target.value)} onKeyDown={tecla} />
        <button type="button" className="btn bg sm" aria-disabled={!borr.trim() || lista.length >= MAX_TERMINOS} onClick={va}>{boton}</button>
      </span>
    </div>
  );
}

// ---------- 1. Contienda ----------
export function PasoContienda({ d, upd }: Ctx) {
  const c = d.campana;
  const set = (k: keyof DatosB['campana']) => (e: { target: { value: string } }) => upd({ campana: { ...c, [k]: e.target.value } });
  const terr = territorio(d);
  return (
    <section className="card fade" aria-label="Paso 1: contienda">
      <div className="blk" style={{ gap: 2 }}><h2>Contienda</h2><p className="mu">Qué elección es y dónde ocurre. El territorio define qué conversación se recolecta.</p></div>
      <div className="fg">
        <label className="f" style={{ flexBasis: '100%' }}><span className="kl">Nombre de la campaña</span><input className="in" type="text" placeholder="Ej. Gobernación del Zulia 2027" value={c.nombre} onChange={set('nombre')} /></label>
        <div className="f" style={{ flexBasis: '100%' }}><span className="kl">Tipo de elección</span>
          <div className="sg" role="group" aria-label="Tipo de elección">
            {TIPOS_ELECCION.map((t) => <button key={t} type="button" className="pill" aria-pressed={c.tipo_eleccion === t} onClick={() => upd({ campana: { ...c, tipo_eleccion: t } })}>{t}</button>)}
          </div>
        </div>
        <label className="f" style={{ flexBasis: '40%' }}><span className="kl">País</span>
          <select className="in" value={c.pais} onChange={set('pais')}>{PAISES.map((p) => <option key={p}>{p}</option>)}</select>
        </label>
        <label className="f" style={{ flexBasis: '40%' }}><span className="kl">Zona horaria</span>
          <select className="in" value={c.zona_horaria} onChange={set('zona_horaria')}>{ZONAS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
        </label>
        <label className="f" style={{ flexBasis: '40%' }}><span className="kl">Estado</span><input className="in" type="text" placeholder="Ej. Zulia" value={c.estado} onChange={set('estado')} /></label>
        <label className="f" style={{ flexBasis: '40%' }}><span className="kl">Municipio</span><input className="in" type="text" placeholder="Ej. Maracaibo" value={c.municipio} onChange={set('municipio')} /></label>
      </div>
      <p className="mu">{terr ? `La conversación pública sobre ${terr} y sobre las figuras de la campaña es la que se va a recolectar.` : 'Indica estado y municipio para delimitar la conversación.'}</p>
    </section>
  );
}

// ---------- 2. Calendario ----------
export function PasoCalendario({ d, upd, hoy, cal }: Ctx) {
  const setFase = (i: number, k: 'inicio' | 'fin', v: string) => upd({ fases: d.fases.map((f, j) => (j === i ? { ...f, [k]: v } : f)) });
  const sugerir = () => { if (d.campana.jornada) upd({ fases: fasesSugeridas(d.campana.jornada, hoy) }); };
  return (
    <section className="card fade" aria-label="Paso 2: calendario electoral">
      <div className="blk" style={{ gap: 2 }}><h2>Calendario</h2><p className="mu">Las fases ordenan todo lo demás: el reloj de la campaña, los periodos de análisis y los avisos de veda.</p></div>
      <div className="fg" style={{ alignItems: 'flex-end' }}>
        <label className="f" style={{ flex: '0 1 200px' }}><span className="kl">Fecha de la elección</span><input className="in" type="date" value={d.campana.jornada} onChange={(e) => upd({ campana: { ...d.campana, jornada: e.target.value } })} /></label>
        <button type="button" className="btn bg" aria-disabled={!d.campana.jornada} title={d.campana.jornada ? undefined : 'Indica primero la fecha de la elección'} onClick={sugerir}>Cargar fases sugeridas</button>
        <span className="mu" style={{ flex: '1 1 200px', paddingBottom: 9 }}>{d.campana.jornada ? 'Fecha tentativa: cámbiala cuando el CNE publique el cronograma.' : 'Indica la fecha de la elección para cargar las fases sugeridas.'}</span>
      </div>
      <div className="list">
        {d.fases.map((f, i) => {
          const n = diasFase(f);
          return (
            <div className="li" key={f.nombre + i} style={{ flexWrap: 'wrap', gap: '8px 12px' }}>
              <span style={{ flex: '1 1 130px', display: 'flex', alignItems: 'center', gap: 8 }}><span className="d" style={{ background: COLOR_FASE[f.nombre] ?? '#A8AFA9' }} /><span className="b">{f.nombre}</span></span>
              <label style={{ flex: '1 1 150px', display: 'flex', alignItems: 'center', gap: 8 }}><span className="mu">Inicio</span><input className="in" type="date" aria-label={`Inicio de ${f.nombre}`} value={f.inicio} onChange={(e) => setFase(i, 'inicio', e.target.value)} /></label>
              <label style={{ flex: '1 1 150px', display: 'flex', alignItems: 'center', gap: 8 }}><span className="mu">Fin</span><input className="in" type="date" aria-label={`Fin de ${f.nombre}`} value={f.fin} onChange={(e) => setFase(i, 'fin', e.target.value)} /></label>
              <span className="mu r" style={{ flex: '0 0 64px' }}>{n > 0 ? `${n} ${n === 1 ? 'día' : 'días'}` : '—'}</span>
            </div>
          );
        })}
      </div>
      <div className="blk" role="status" aria-label="Validación del calendario">
        {cal.checks.map((c) => <span className="ck" key={c.texto}><span className={c.ok ? 'd dok' : 'd du'} /><span className={c.ok ? '' : 'tu b'}>{c.texto}</span></span>)}
      </div>
      <div className="well sm" style={{ color: '#454E48' }}>En veda se bloquean envíos; el monitoreo continúa. Las fases no pueden solaparse y la veda debe terminar antes de la jornada. Confirma fechas con tu asesoría legal.</div>
    </section>
  );
}

// ---------- 3. Figuras ----------
export function PasoFiguras({ d, upd, directorio, yaEn, orgNombre }: Ctx) {
  const [q, setQ] = useState('');
  const [nueva, setNueva] = useState<{ nombre: string; partido: string; cargo: string; relacion: Relacion } | null>(null);
  const figs = figurasOrdenadas(d.figuras);
  const propia = figs.some((f) => f.relacion === 'Propia');
  const enCampana = new Set(d.figuras.map((f) => f.figura_id).filter(Boolean));
  const ql = q.trim().toLowerCase();
  const dir = directorio.filter((f) => !enCampana.has(f.id) && (!ql || `${f.nombre} ${f.partido ?? ''}`.toLowerCase().includes(ql)));

  const setRel = (k: string, v: Relacion) => upd({
    figuras: d.figuras.map((x) => (claveFigura(x) === k ? { ...x, relacion: v } : v === 'Propia' && x.relacion === 'Propia' ? { ...x, relacion: 'A observar' as Relacion } : x)),
  });
  const quitar = (k: string) => upd({ figuras: d.figuras.filter((x) => claveFigura(x) !== k) });
  const vincular = (f: Figura, relacion: Relacion) => upd({ figuras: [...d.figuras, { figura_id: f.id, relacion, terminos: [{ texto: f.nombre, tipo: 'Nombre' }] }] });
  const crear = () => {
    if (!nueva || !nueva.nombre.trim()) return;
    const nombre = nueva.nombre.trim();
    const base = nueva.relacion === 'Propia' ? d.figuras.map((x) => (x.relacion === 'Propia' ? { ...x, relacion: 'A observar' as Relacion } : x)) : d.figuras;
    upd({ figuras: [...base, { nueva: { nombre, partido: nueva.partido.trim(), cargo: nueva.cargo.trim() }, clave: nuevaClave(), relacion: nueva.relacion, terminos: [{ texto: nombre, tipo: 'Nombre' }] }] });
    setNueva(null);
    setQ('');
  };

  return (
    <>
      <section className="card fade" aria-label="Paso 3: figuras de la campaña">
        <div className="ch"><div className="blk" style={{ gap: 2 }}><h2>En esta campaña</h2><p className="mu">Una figura propia (obligatoria) y las rivales, aliadas y a observar con las que se compara.</p></div><span className="mu">{figs.length} {figs.length === 1 ? 'figura' : 'figuras'}</span></div>
        {!figs.length ? <div className="well sm">Aún no hay figuras. Vincula la primera desde el directorio del equipo.</div> : null}
        <div className="list">
          {figs.map((f) => {
            const k = claveFigura(f);
            const nombre = nombreFigura(f, directorio);
            const fila = f.figura_id ? directorio.find((x) => x.id === f.figura_id) : null;
            return (
              <div className="li" key={k} style={{ flexWrap: 'wrap' }}>
                <span className={'ini ' + REL[f.relacion].cls} aria-hidden="true">{fila?.iniciales ?? iniciales(nombre)}</span>
                <div className="gr" style={{ flex: '1 1 180px' }}><span className="b">{nombre}</span><span className="mu">{metaFigura(fila ?? { partido: f.nueva?.partido, cargo: f.nueva?.cargo }, yaEn, !!f.nueva)}</span></div>
                <select className="in" style={{ width: 136 }} aria-label={`Relación de ${nombre} en esta campaña`} value={f.relacion} onChange={(e) => setRel(k, e.target.value as Relacion)}>
                  {ORDEN_REL.map((r) => <option key={r}>{r}</option>)}
                </select>
                <button type="button" className="btn bg sm" onClick={() => quitar(k)}>Quitar</button>
              </div>
            );
          })}
        </div>
        {figs.length > 0 && !propia ? <span className="ck"><span className="d du" /><span className="tu b">Falta la figura propia: cambia la relación de una figura a "Propia".</span></span> : null}
        <label className="ok well"><input type="checkbox" checked={d.confirmo_personas_publicas} onChange={() => upd({ confirmo_personas_publicas: !d.confirmo_personas_publicas })} /><span className="sm">Confirmo que todas son personas públicas en un rol público. Wana no crea perfiles de ciudadanos particulares.</span></label>
      </section>

      <section className="card fade" aria-label="Directorio del equipo">
        <div className="ch"><h2>Directorio del equipo</h2>
          {nueva ? null : <button type="button" className="btn bg sm" onClick={() => setNueva({ nombre: q.trim(), partido: '', cargo: '', relacion: propia ? 'Rival' : 'Propia' })}>Crear figura nueva</button>}
        </div>
        {nueva ? (
          <div className="well blk" style={{ gap: 12 }} aria-label="Figura nueva">
            <div className="fg">
              <label className="f" style={{ flexBasis: '100%' }}><span className="kl">Nombre público</span><input className="in" type="text" autoFocus placeholder="Como aparece en medios y redes" value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} /></label>
              <label className="f"><span className="kl">Partido</span><input className="in" type="text" value={nueva.partido} onChange={(e) => setNueva({ ...nueva, partido: e.target.value })} /></label>
              <label className="f"><span className="kl">Cargo o rol público</span><input className="in" type="text" value={nueva.cargo} onChange={(e) => setNueva({ ...nueva, cargo: e.target.value })} /></label>
              <label className="f" style={{ flex: '0 1 160px' }}><span className="kl">Relación</span>
                <select className="in" value={nueva.relacion} onChange={(e) => setNueva({ ...nueva, relacion: e.target.value as Relacion })}>{ORDEN_REL.map((r) => <option key={r}>{r}</option>)}</select>
              </label>
            </div>
            <div className="tg" style={{ gap: 8 }}>
              <button type="button" className="btn bp sm" aria-disabled={!nueva.nombre.trim()} onClick={crear}>Agregar a la campaña</button>
              <button type="button" className="btn bg sm" onClick={() => setNueva(null)}>Cancelar</button>
              <span className="mu">Se guarda en el directorio de {orgNombre} al crear la campaña.</span>
            </div>
          </div>
        ) : null}
        <p className="mu">Cada figura se guarda una sola vez en el directorio y se enlaza a cada campaña con su propia relación. Vincula las que ya sigue {orgNombre} en otras campañas.</p>
        <input className="in" type="search" placeholder="Buscar por nombre o partido" aria-label="Buscar en el directorio del equipo" value={q} onChange={(e) => setQ(e.target.value)} />
        {!dir.length ? <div className="well sm">{directorio.length && !ql ? 'Todas las figuras del directorio ya están en esta campaña.' : 'Ninguna figura del directorio coincide. Puedes crear una figura nueva.'}</div> : null}
        <div className="list">
          {dir.map((f) => (
            <div className="li" key={f.id} style={{ flexWrap: 'wrap' }}>
              <span className="ini" aria-hidden="true">{f.iniciales ?? iniciales(f.nombre)}</span>
              <div className="gr" style={{ flex: '1 1 180px' }}><span className="b">{f.nombre}</span><span className="mu">{metaFigura(f, yaEn)}</span></div>
              <div className="tg"><span className="mu">Vincular como</span>
                {!propia ? <button type="button" className="btn bg sm" onClick={() => vincular(f, 'Propia')}>Propia</button> : null}
                <button type="button" className="btn bg sm" onClick={() => vincular(f, 'Rival')}>Rival</button>
                <button type="button" className="btn bg sm" onClick={() => vincular(f, 'Aliada')}>Aliada</button>
                <button type="button" className="btn bg sm" onClick={() => vincular(f, 'A observar')}>A observar</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

// ---------- 4. Términos y temas ----------
export function PasoTerminos({ d, upd, directorio }: Ctx) {
  const figs = figurasOrdenadas(d.figuras);
  const setTerm = (k: string, terminos: TerminoB[]) => upd({ figuras: d.figuras.map((x) => (claveFigura(x) === k ? { ...x, terminos } : x)) });
  const camp = d.terminos.filter((t) => t.tipo !== 'Exclusión');
  const excl = d.terminos.filter((t) => t.tipo === 'Exclusión');
  return (
    <>
      <section className="card fade" aria-label="Paso 4: términos por figura">
        <div className="blk" style={{ gap: 2 }}><h2>Términos por figura</h2><p className="mu">Con estas palabras se buscan las menciones de cada figura: nombres, apodos, hashtags y errores de escritura frecuentes.</p></div>
        {!figs.length ? <div className="well sm">Agrega figuras en el paso 3 para definir sus términos.</div> : null}
        <div className="list">
          {figs.map((f) => {
            const k = claveFigura(f);
            const nombre = nombreFigura(f, directorio);
            const lista = f.terminos.map((t) => t.texto);
            const tieneNombre = lista.includes(nombre);
            return (
              <div className="li" key={k} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8, padding: '14px 0' }}>
                <div className="tg" style={{ gap: '6px 10px' }}><span className="b">{nombre}</span><span className={'chip ' + REL[f.relacion].cls}>{f.relacion}</span><span className="mu" style={{ marginLeft: 'auto' }}>{lista.length} de {MAX_TERMINOS}</span></div>
                <Chips lista={lista} cls="chip ring" etiqueta={`Nuevo término para ${nombre}`} ph="Nombre, hashtag o error de escritura"
                  agregar={(t) => setTerm(k, [...f.terminos, { texto: t, tipo: tipoTermino(t, 'Nombre') }])}
                  quitar={(t) => setTerm(k, f.terminos.filter((x) => x.texto !== t))} />
                {!lista.length || !tieneNombre ? (
                  <div className="tg" style={{ gap: '6px 10px' }}>
                    {!lista.length ? <><span className="chip unf">Sin términos</span><span className="mu" style={{ flex: '1 1 200px' }}>Sin términos no se recolecta nada de esta figura.</span></> : <span className="mu" style={{ flex: '1 1 200px' }}>El nombre completo no está entre los términos.</span>}
                    <button type="button" className="btn bg sm" onClick={() => setTerm(k, [...f.terminos, { texto: nombre, tipo: 'Nombre' }])}>Agregar "{nombre}"</button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
      <section className="card fade" aria-label="Términos de la campaña y temas">
        <div className="blk" style={{ gap: 2 }}><h2>Campaña y temas</h2><p className="mu">Términos de la contienda que no nombran a una figura, exclusiones para limpiar ruido y los temas con los que se clasifica cada mención.</p></div>
        <div className="blk">
          <div className="tg" style={{ justifyContent: 'space-between' }}><span className="kl">Términos de la campaña</span><span className="mu">{camp.length} de {MAX_TERMINOS}</span></div>
          <Chips lista={camp.map((t) => t.texto)} cls="chip ring" etiqueta="Términos de la campaña" ph="Ej. Alcaldía de Maracaibo"
            agregar={(t) => upd({ terminos: [...d.terminos, { texto: t, tipo: tipoTermino(t, 'Término') }] })}
            quitar={(t) => upd({ terminos: d.terminos.filter((x) => !(x.texto === t && x.tipo !== 'Exclusión')) })} />
        </div>
        <div className="blk">
          <div className="tg" style={{ justifyContent: 'space-between' }}><span className="kl">Excluir menciones con</span><span className="mu">{excl.length} de {MAX_TERMINOS}</span></div>
          <Chips lista={excl.map((t) => t.texto)} cls="chip unf" etiqueta="Excluir menciones con" ph="Palabra que trae ruido" boton="Excluir"
            agregar={(t) => upd({ terminos: [...d.terminos, { texto: t, tipo: 'Exclusión' }] })}
            quitar={(t) => upd({ terminos: d.terminos.filter((x) => !(x.texto === t && x.tipo === 'Exclusión')) })} />
        </div>
        <div className="blk">
          <div className="tg" style={{ justifyContent: 'space-between' }}><span className="kl">Temas</span><span className="mu">{d.temas.length} {d.temas.length === 1 ? 'tema' : 'temas'}</span></div>
          <Chips lista={d.temas} cls="chip own" etiqueta="Temas" ph="Nuevo tema" boton="Nuevo tema"
            agregar={(t) => upd({ temas: [...d.temas, t] })} quitar={(t) => upd({ temas: d.temas.filter((x) => x !== t) })} />
        </div>
      </section>
    </>
  );
}

// ---------- 5. Equipo y acceso ----------
export function PasoEquipo({ d, upd, personas, yo, orgNombre }: Ctx) {
  const [correo, setCorreo] = useState('');
  const [rolInv, setRolInv] = useState<RolCampana>('Solo lectura');
  const [persona, setPersona] = useState('');
  const [rolPer, setRolPer] = useState<RolCampana>('Análisis');
  const ids = new Set(d.equipo.map((m) => m.persona_id).filter(Boolean));
  const correos = new Set(d.equipo.map((m) => (m.email ?? '').trim().toLowerCase()).filter(Boolean));
  const disponibles = personas.filter((p) => !ids.has(p.id));
  const okCorreo = /^\S+@\S+\.\S+$/.test(correo.trim());
  const yaEsta = okCorreo && (correos.has(correo.trim().toLowerCase()) || personas.some((p) => ids.has(p.id) && (p.email ?? '').toLowerCase() === correo.trim().toLowerCase()));

  const setM = (i: number, cambio: Partial<MiembroB>) => upd({ equipo: d.equipo.map((m, j) => (j === i ? { ...m, ...cambio } : m)) });
  const invitar = () => {
    if (!okCorreo || yaEsta) return;
    const email = correo.trim();
    const existente = personas.find((p) => (p.email ?? '').toLowerCase() === email.toLowerCase());
    upd({ equipo: [...d.equipo, existente ? { persona_id: existente.id, rol: rolInv } : { email, rol: rolInv }] });
    setCorreo('');
  };
  const agregar = () => {
    if (!persona) return;
    upd({ equipo: [...d.equipo, { persona_id: persona, rol: rolPer }] });
    setPersona('');
  };
  const n = d.equipo.length;

  return (
    <section className="card fade" aria-label="Paso 5: equipo y acceso">
      <div className="ch"><div className="blk" style={{ gap: 2 }}><h2>Equipo y acceso</h2><p className="mu">Quién entra a esta campaña y qué puede hacer.</p></div><span className="mu">{n} {n === 1 ? 'persona' : 'personas'}</span></div>
      <div className="list">
        {d.equipo.map((m, i) => {
          const v = datosMiembro(m, personas);
          const soyYo = !!yo && m.persona_id === yo;
          return (
            <div className="li" key={(m.persona_id ?? m.email ?? m.nombre ?? '') + i} style={{ flexWrap: 'wrap' }}>
              <span className="av" aria-hidden="true">{v.ini}</span>
              <div className="gr" style={{ flex: '1 1 180px' }}><span className="b">{v.nombre}</span><span className="mu">{v.sub}</span>
                {!m.persona_id && !(m.email ?? '').trim() ? (
                  <input className="in" style={{ height: 30, marginTop: 6, maxWidth: 320 }} type="email" placeholder="Correo de la persona" aria-label={`Correo de ${v.nombre}`} value={m.email ?? ''} onChange={(e) => setM(i, { email: e.target.value })} />
                ) : null}
              </div>
              <select className="in" style={{ width: 214 }} aria-label={`Rol de ${v.nombre}`} value={m.rol} disabled={soyYo} title={soyYo ? 'Quien crea la campaña queda en Administración' : undefined} onChange={(e) => setM(i, { rol: e.target.value as RolCampana })}>
                {ROLES.map(([r, t]) => <option key={r} value={r}>{t}</option>)}
              </select>
              {soyYo ? <span className="chip watch" style={{ width: 58, justifyContent: 'center' }}>Tú</span>
                : <button type="button" className="btn bg sm" onClick={() => upd({ equipo: d.equipo.filter((_, j) => j !== i) })}>Quitar</button>}
            </div>
          );
        })}
      </div>
      {disponibles.length ? (
        <div className="fg" style={{ alignItems: 'flex-end' }}>
          <label className="f" style={{ flex: '2 1 220px' }}><span className="kl">Agregar del equipo</span>
            <select className="in" value={persona} onChange={(e) => setPersona(e.target.value)}>
              <option value="">Elige una persona de {orgNombre}</option>
              {disponibles.map((p) => <option key={p.id} value={p.id}>{p.nombre}{p.puesto ? ` · ${p.puesto}` : ''}</option>)}
            </select>
          </label>
          <label className="f" style={{ flex: '1 1 180px' }}><span className="kl">Rol</span>
            <select className="in" value={rolPer} onChange={(e) => setRolPer(e.target.value as RolCampana)}>{ROLES.map(([r, t]) => <option key={r} value={r}>{t}</option>)}</select>
          </label>
          <button type="button" className="btn bg" aria-disabled={!persona} onClick={agregar}>Agregar</button>
        </div>
      ) : null}
      <div className="fg" style={{ alignItems: 'flex-end' }}>
        <label className="f" style={{ flex: '2 1 220px' }}><span className="kl">Agregar por correo</span>
          <input className="in" type="email" placeholder="nombre@correo.example" value={correo} onChange={(e) => setCorreo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); invitar(); } }} />
        </label>
        <label className="f" style={{ flex: '1 1 180px' }}><span className="kl">Rol</span>
          <select className="in" value={rolInv} onChange={(e) => setRolInv(e.target.value as RolCampana)}>{ROLES.map(([r, t]) => <option key={r} value={r}>{t}</option>)}</select>
        </label>
        <button type="button" className="btn bg" aria-disabled={!okCorreo || yaEsta} onClick={invitar}>Agregar</button>
      </div>
      <p className="mu">{yaEsta ? 'Ese correo ya está en el equipo de esta campaña.' : 'No se envía correo: la persona queda registrada al crear la campaña y la cuenta la crea quien administra Wana.'}</p>
      <div className="well" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#285A32" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginTop: 2 }}><path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4" /></svg>
        <div className="gr" style={{ flex: '1 1 220px' }}><span className="sm b">Esta campaña es un espacio aislado</span><span className="sm" style={{ color: '#454E48' }}>Nadie de otras campañas de {orgNombre} ve sus datos salvo que lo agregues aquí. La búsqueda, los reportes y las alertas nunca cruzan campañas.</span></div>
        <span className="chip ring" title="El aislamiento entre campañas no se puede desactivar">Siempre activo</span>
      </div>
    </section>
  );
}

export function lineaEquipo(d: DatosB): string {
  const n = d.equipo.length;
  const partes = ROLES.map(([r]) => { const k = d.equipo.filter((m) => m.rol === r).length; return k ? `${k} ${ROL_MIN[r]}` : ''; }).filter(Boolean);
  return `${n} ${n === 1 ? 'persona' : 'personas'}: ${partes.join(' · ')}`;
}

// ---------- 6. Revisar ----------
export function PasoRevisar(ctx: Ctx) {
  const { d, cal, bad, directorio, go, orgNombre } = ctx;
  const terr = territorio(d);
  const figs = figurasOrdenadas(d.figuras);
  const propia = figs.find((f) => f.relacion === 'Propia');
  const de = (n: string) => d.fases.find((p) => p.nombre === n);
  const camp = de('Campaña'), veda = de('Veda');
  const faseHoy = cal.actual >= 0 ? d.fases[cal.actual].nombre.toLowerCase() : 'fuera del calendario';
  const nTerm = figs.reduce((n, f) => n + f.terminos.length, 0);
  const camT = d.terminos.filter((t) => t.tipo !== 'Exclusión').length, excl = d.terminos.length - camT;
  const sinTerm = figs.filter((f) => !f.terminos.length).length;
  const ln = (ok: boolean, texto: string) => ({ ok, texto });
  const plural: Record<string, string> = { Rival: 'Rivales', Aliada: 'Aliadas', 'A observar': 'A observar' };
  const bloques: Array<{ titulo: string; paso: number; lineas: Array<{ ok: boolean; texto: string }> }> = [
    { titulo: 'Contienda', paso: 0, lineas: [ln(!bad[0], `${d.campana.nombre.trim() || 'Sin nombre'} · ${d.campana.tipo_eleccion}`), ln(!!terr, `${terr || 'Sin territorio'}, ${d.campana.pais} · ${d.campana.zona_horaria}`)] },
    { titulo: 'Calendario', paso: 1, lineas: [
      ln(!cal.faltan, cal.faltan ? 'Faltan fechas' : `Elección: ${fd(d.campana.jornada, true)} · hoy ${cal.actual >= 0 ? 'en ' : ''}${faseHoy}`),
      ln(cal.ok, cal.ok ? [camp ? `Campaña ${rangoFase(camp)}` : '', veda ? `veda ${rangoFase(veda)}` : ''].filter(Boolean).join(' · ') : 'El calendario tiene errores por corregir'),
    ] },
    { titulo: 'Figuras', paso: 2, lineas: [
      ln(!!propia, propia ? `Propia: ${nombreFigura(propia, directorio)}` : 'Falta la figura propia'),
      ...(['Rival', 'Aliada', 'A observar'] as Relacion[]).map((r) => {
        const l = figs.filter((f) => f.relacion === r).map((f) => nombreFigura(f, directorio));
        return l.length ? ln(true, `${plural[r]}: ${l.join(', ')}`) : null;
      }).filter((x): x is { ok: boolean; texto: string } => !!x),
      ...(figs.some((f) => f.nueva) ? [(() => { const k = figs.filter((f) => f.nueva).length; return ln(true, `${k} ${k === 1 ? 'figura nueva' : 'figuras nuevas'} para el directorio de ${orgNombre}`); })()] : []),
      ln(d.confirmo_personas_publicas, d.confirmo_personas_publicas ? 'Personas públicas en un rol público: confirmado' : 'Falta confirmar que son personas públicas'),
    ] },
    { titulo: 'Términos y temas', paso: 3, lineas: [
      ln(!sinTerm, `${nTerm} ${nTerm === 1 ? 'término' : 'términos'} de figuras${sinTerm ? ` · ${sinTerm} sin términos` : ''}`),
      ln(true, `${camT} ${camT === 1 ? 'término' : 'términos'} de campaña · ${excl} ${excl === 1 ? 'exclusión' : 'exclusiones'}`),
      ln(true, `Temas: ${d.temas.join(', ') || 'ninguno todavía'}`),
    ] },
    { titulo: 'Equipo y acceso', paso: 4, lineas: [ln(!bad[4], lineaEquipo(d)), ln(true, `Espacio aislado: nadie de otras campañas de ${orgNombre} ve estos datos`)] },
  ];
  return (
    <>
      {bloques.map((b) => (
        <section className="card fade" aria-label={`Resumen: ${b.titulo}`} style={{ gap: 8 }} key={b.titulo}>
          <div className="ch"><h2>{b.titulo}</h2><button type="button" className="btn bg sm" onClick={() => go(b.paso)}>Editar</button></div>
          {b.lineas.map((l) => <span className="ck" key={l.texto}><span className={l.ok ? 'd dok' : 'd du'} /><span style={{ color: '#454E48' }}>{l.texto}</span></span>)}
        </section>
      ))}
      <section className="card fade" aria-label="Qué pasa al crear" style={{ gap: 8 }}>
        <h2>Al crear la campaña</h2>
        <p className="sm" style={{ color: '#454E48' }}>Se guardan la contienda, el calendario, {figs.length} {figs.length === 1 ? 'figura' : 'figuras'} con sus términos, los términos de la campaña y el equipo. Quedas en Administración.</p>
        <p className="mu">El volumen de menciones no se estima aquí: el Resumen muestra cifras reales cuando haya menciones recolectadas para estos términos. Agregar a alguien no envía correo; la cuenta de cada persona la crea quien administra Wana.</p>
      </section>
    </>
  );
}

export { PASOS };
