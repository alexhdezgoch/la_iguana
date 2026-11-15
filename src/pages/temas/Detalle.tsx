// Panel lateral con el detalle de una narrativa. Se monta en .app (fuera de <main>), con raíz .pg-temas-panel.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { db } from '../../lib/db';
import { useTabla } from '../../lib/hooks';
import { compacto, cuando, fecha, neto, num, pct } from '../../lib/formato';
import type { FiguraCampana, Narrativa, NotaInterna, PersonaVisible, Tema } from '../../lib/tipos';
import { useAcciones } from '../../shell/Acciones';
import { useSesion } from '../../shell/Sesion';
import { DIR, TEND, figuraDeNarrativa, pctDeFigura, signoPct, type Canal } from './calculos';
import { NADA, banda, ceros, linea, maximo, sumar, type Marca } from './graficos';

const G4 = ['#285A32', '#6F9A77', '#B4CDB8', '#DDE4DC'];

interface Impulsor { figura_id?: string; medio?: string; porcentaje: number }
interface Publicacion { canal?: string; fuente?: string; descripcion?: string; alcance?: number | null }
interface Relacionada { narrativa_id: string; tipo?: string }

export interface PropsDetalle {
  n: Narrativa;
  base: string;
  campanaId: string;
  hoy: string;
  zona: string;
  dias: string[];
  serie: number[] | undefined;
  marcas: Marca[];
  figs: Map<string, FiguraCampana>;
  temas: Map<string, Tema>;
  narrativas: Map<string, Narrativa>;
  conteos: Map<string, number | null>;
  puedeEditar: boolean;
  esCliente: boolean;
  abrir: (id: string) => void;
  cerrar: () => void;
}

export function Detalle(p: PropsDetalle) {
  const { n, figs } = p;
  const { aviso } = useAcciones();
  const { persona } = useSesion();
  const [modo, setModo] = useState<'t' | 'c'>('t');
  const [como, setComo] = useState(false);
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => { setComo(false); setNota(''); if (ref.current) ref.current.scrollTop = 0; }, [n.id]);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') p.cerrar(); };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [p]);
  // Al abrir, el foco entra al panel; al cerrar vuelve al control que lo abrió (la fila o la tarjeta de la narrativa).
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => {
      if (previo && previo !== document.body && previo.isConnected && !ref.current?.contains(previo)) {
        try { previo.focus({ preventScroll: true }); } catch { /* nada */ }
      }
    };
  }, []);

  const notas = useTabla<NotaInterna>('notas_internas', { eq: { campana_id: p.campanaId, entidad: 'narrativa', entidad_id: n.id }, orden: [['creada_en', 'desc']] }, !p.esCliente);
  const autores = [...new Set(notas.datos.map((x) => x.autor_id).filter(Boolean) as string[])];
  const personas = useTabla<PersonaVisible>('v_personas_campana', { eq: { id: autores } }, autores.length > 0);
  const nombrePersona = (id: string | null) => personas.datos.find((x) => x.id === id)?.nombre_corto ?? 'Equipo';

  const fig = figuraDeNarrativa(n, figs);
  const tema = n.tema_id ? p.temas.get(n.tema_id) : undefined;
  const dir = DIR[n.direccion] ?? DIR['Sin dirección'];
  const d = n.detalle ?? {};
  const canales = ((d.canales ?? []) as Canal[]).slice().sort((a, b) => b.porcentaje - a.porcentaje);
  const impulsores = (d.impulsores ?? []) as Impulsor[];
  const publicaciones = (d.publicaciones ?? []) as Publicacion[];
  const terminos = (d.terminos ?? []) as string[];
  const relacionadas = ((d.relacionadas ?? []) as Relacionada[]).filter((r) => p.narrativas.has(r.narrativa_id));
  const coord = d.coordinacion as { nivel?: string; senales?: string[] } | undefined;
  const pf = pctDeFigura(n, figs);
  const cambio = `${signoPct(n.cambio_24h)} · ${n.cambio_7d == null ? 'nueva' : signoPct(n.cambio_7d)}`;

  async function seguir() {
    setOcupado(true);
    try {
      await db.cambiar<Narrativa>('narrativas', n.id, { seguida: !n.seguida });
      aviso(n.seguida ? 'Dejaste de seguir la narrativa' : 'Narrativa en seguimiento');
    } catch (e) { aviso(e instanceof Error ? e.message : String(e)); }
    setOcupado(false);
  }
  async function aprobar() {
    setOcupado(true);
    try {
      await db.cambiar<Narrativa>('narrativas', n.id, { resumen_aprobado: true });
      aviso('Resumen aprobado');
    } catch (e) { aviso(e instanceof Error ? e.message : String(e)); }
    setOcupado(false);
  }
  async function guardarNota() {
    const texto = nota.trim();
    if (!texto) return;
    setGuardando(true);
    try {
      await db.crear<NotaInterna>('notas_internas', { campana_id: p.campanaId, entidad: 'narrativa', entidad_id: n.id, texto, autor_id: persona?.id ?? null });
      setNota('');
      aviso('Nota guardada. Solo la ve el equipo.');
    } catch (e) { aviso(e instanceof Error ? e.message : String(e)); }
    setGuardando(false);
  }

  // línea de tiempo
  const serie = p.serie;
  const mx = serie ? maximo(serie) * 1.12 : 0;
  const bandas = [NADA, NADA, NADA, NADA];
  const leyenda: Array<{ c: string; l: string }> = [];
  let lineaT = NADA;
  if (serie && serie.length > 1) {
    if (modo === 'c' && canales.length) {
      let lo = ceros(serie.length);
      const top = canales.slice(0, 3);
      const resto = 100 - top.reduce((s, c) => s + c.porcentaje, 0);
      const capas = top.map((c) => ({ l: c.canal, v: c.porcentaje }));
      if (resto > 0) capas.push({ l: 'Otros canales', v: resto });
      capas.forEach((c, j) => {
        const hi = sumar(lo, serie.map((v) => (v * c.v) / 100));
        bandas[j] = banda(lo, hi, 480, 110, 20, mx, 150);
        lo = hi;
        leyenda.push({ c: G4[j], l: `${c.l} ${c.v}%` });
      });
    } else {
      bandas[0] = banda(ceros(serie.length), serie, 480, 110, 20, mx, 150);
      lineaT = linea(serie, 480, 110, 20, mx, 150, 2);
    }
  }

  let impulsado = 0;
  const filasImpulso = impulsores.map((x) => {
    impulsado += x.porcentaje;
    const f = x.figura_id ? figs.get(x.figura_id) : undefined;
    return { n: f ? f.nombre : x.medio ?? 'Figura', t: x.figura_id ? `Figura · ${f?.relacion ?? 'fuera de la campaña'}` : 'Medio · cobertura informativa', v: `${x.porcentaje}%`, a: f ? `${p.base}/figuras/${f.figura_id}` : null };
  });

  const stats: Array<[string, string]> = [
    ['Menciones', num(n.menciones)],
    ['Alcance', compacto(n.alcance)],
    ['Cuentas únicas', num(n.cuentas_unicas)],
    ['Cambio 24 h · 7 d', cambio],
    ['% de la figura', pf == null ? '—' : pct(pf)],
    ['Sentimiento neto', n.neto == null ? '—' : neto(n.neto)],
  ];

  const raiz = document.querySelector('.app') ?? document.body;
  return createPortal(
    <div className="pg-temas-panel">
      <button type="button" className="ov" aria-label="Cerrar detalle" onClick={p.cerrar} />
      <aside className="card so" role="dialog" aria-label="Detalle de la narrativa" ref={ref} tabIndex={-1}>
        <div className="ch" style={{ alignItems: 'center' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <span className={dir.cls}>{dir.texto}</span>
            {tema ? <span className="chip">{tema.nombre}</span> : null}
            {n.tendencia ? <span className={TEND[n.tendencia] ?? 'chip watch'}>{n.tendencia}</span> : null}
          </div>
          <button type="button" className="btn bg bi xc" aria-label="Cerrar" onClick={p.cerrar}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h2 style={{ fontSize: 20, lineHeight: '26px' }}>{n.nombre}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 8px' }} className="mu">
            {n.figura_id && figs.has(n.figura_id)
              ? <Link className="b" style={{ color: '#454E48' }} to={`${p.base}/figuras/${n.figura_id}`}>{fig.nombre}</Link>
              : <span className="b" style={{ color: '#454E48' }}>{fig.nombre}</span>}
            {fig.relCls ? <span className={fig.relCls}>{fig.rel}</span> : null}
            {n.detectada_el ? <span>Primer registro: {fecha(n.detectada_el, 'corto')}</span> : null}
          </div>
        </div>

        <div className="well" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="gr">
            <span className="sm b">Seguir con alerta</span>
            <span className="mu">{n.seguida
              ? <>En seguimiento. Los avisos salen de las reglas de <Link to={`${p.base}/alertas`}>Alertas</Link>.</>
              : 'Sin seguimiento. Actívalo para marcarla para el equipo.'}</span>
          </div>
          <button type="button" className="tg" role="switch" aria-checked={n.seguida} aria-label="Seguir con alerta" onClick={seguir} disabled={!p.puedeEditar || ocupado} title={p.puedeEditar ? undefined : 'Tu rol no permite cambiarlo'}><i /></button>
        </div>

        <div className="sec" style={{ borderTop: 0, paddingTop: 0 }}>
          <div className="ch"><span className="kl">Resumen</span>
            {n.resumen ? <span className={n.resumen_aprobado ? 'chip live' : 'chip warn'}>{n.resumen_aprobado ? 'Aprobado por analista' : 'Borrador de IA'}</span> : null}
          </div>
          <p style={{ color: '#454E48' }}>{n.resumen ?? n.descripcion ?? 'Todavía no hay resumen para esta narrativa.'}</p>
          {n.resumen && !n.resumen_aprobado && p.puedeEditar
            ? <div><button type="button" className="btn bg" onClick={aprobar} disabled={ocupado}>Aprobar resumen</button></div>
            : null}
        </div>

        <div className="sec">
          <div className="dl">
            {stats.map(([l, v]) => <div key={l}><span className="kl">{l}</span><span className="b">{v}</span></div>)}
          </div>
          <span className="mu">Las cuentas únicas se cuentan, no se listan.</span>
        </div>

        <div className="sec">
          <div className="ch" style={{ alignItems: 'center' }}><span className="kl">Línea de tiempo · {p.dias.length} días</span>
            {serie && canales.length ? (
              <div className="seg" role="group" aria-label="Vista de la línea de tiempo">
                <button type="button" className="pill" aria-pressed={modo === 't'} onClick={() => setModo('t')}>Total</button>
                <button type="button" className="pill" aria-pressed={modo === 'c'} onClick={() => setModo('c')}>Por canal</button>
              </div>
            ) : null}
          </div>
          {serie ? (
            <>
              <div className="cv" style={{ aspectRatio: '3.2' }} role="img" aria-label="Menciones por día de la narrativa, con marcas de eventos">
                <i style={{ clipPath: bandas[3], background: G4[3] }} /><i style={{ clipPath: bandas[2], background: G4[2] }} /><i style={{ clipPath: bandas[1], background: G4[1] }} />
                <i style={{ clipPath: bandas[0], background: modo === 'c' ? G4[0] : '#E7F0E8' }} /><i style={{ clipPath: lineaT, background: '#285A32' }} />
                <svg viewBox="0 0 480 150" aria-hidden="true">
                  {p.marcas.map((m) => <path key={'l' + m.x} d={`M${m.x.toFixed(1)} 16V130`} stroke="#636C66" strokeWidth="1" strokeDasharray="2 3" />)}
                  <path d="M0 130H480" stroke="#DDE1DC" strokeWidth="1" />
                  {p.marcas.map((m) => <text key={'t' + m.x} x={m.anclaje === 'end' ? 478 : m.x} y="10" textAnchor={m.anclaje} fontSize="11" fill="#454E48">{m.texto}</text>)}
                  <text x="0" y="145" fontSize="11" fill="#636C66">{fecha(p.dias[0], 'corto')}</text>
                  <text x="480" y="145" textAnchor="end" fontSize="11" fill="#636C66">{fecha(p.dias[p.dias.length - 1], 'corto')}</text>
                </svg>
              </div>
              {modo === 'c' ? <div className="mu" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>{leyenda.map((l) => <span className="lg" key={l.l}><span className="d" style={{ background: l.c }} />{l.l}</span>)}</div> : null}
              {p.marcas.length ? <span className="mu">Las marcas vienen de <Link to={`${p.base}/eventos`}>Eventos</Link>.</span> : null}
            </>
          ) : <p className="mu">Sin serie diaria para esta narrativa.</p>}
        </div>

        {canales.length ? (
          <div className="sec">
            <span className="kl">Canales</span>
            <div className="bars" style={{ gap: 8 }}>
              {canales.map((c) => (
                <div className="br" key={c.canal}><span className="sm" style={{ flex: '0 0 84px' }}>{c.canal}</span><div className="bar"><i style={{ width: `${((c.porcentaje / (canales[0].porcentaje || 1)) * 100).toFixed(0)}%` }} /></div><span className="sm b r" style={{ flex: '0 0 40px' }}>{c.porcentaje}%</span></div>
              ))}
            </div>
          </div>
        ) : null}

        {impulsores.length ? (
          <div className="sec">
            <span className="kl">Quién la impulsa</span>
            <div className="list">
              {filasImpulso.map((x) => (
                <div className="li" style={{ padding: '8px 0' }} key={x.n}>
                  <div className="gr">{x.a ? <Link className="sm b tl" to={x.a}>{x.n}</Link> : <span className="sm b">{x.n}</span>}<span className="mu">{x.t}</span></div>
                  <span className="sm b">{x.v}</span>
                </div>
              ))}
              {impulsado < 100 ? (
                <div className="li" style={{ padding: '8px 0' }}><div className="gr"><span className="sm b">Cuentas sin afiliación pública</span><span className="mu">Solo en conjunto, sin nombres ni usuarios</span></div><span className="sm b">{100 - impulsado}%</span></div>
              ) : null}
            </div>
            <span className="mu">Porcentaje de las menciones de la narrativa. Solo se nombran figuras en seguimiento y medios.</span>
          </div>
        ) : null}

        {coord ? (
          <div className="sec">
            <div className="ch"><span className="kl">Señales de posible coordinación</span>{coord.nivel ? <span className="chip warn">Nivel {coord.nivel.toLowerCase()}</span> : null}</div>
            {coord.senales?.length ? <div className="well sm" style={{ display: 'flex', flexDirection: 'column', gap: 6, color: '#454E48' }}>{coord.senales.map((s) => <span key={s}>{s}</span>)}</div> : null}
            <span className="mu">Es una señal de posible actividad coordinada, no una conclusión. <button type="button" className="nb lk" style={{ color: '#285A32' }} aria-expanded={como} onClick={() => setComo(!como)}>¿Cómo se calcula?</button></span>
            {como ? <p className="mu fade">Se comparan tres indicios: textos idénticos o casi idénticos, publicaciones concentradas en pocos minutos y proporción de cuentas creadas hace poco. El nivel es bajo, medio o alto según cuántos coinciden. El mismo método se aplica a todas las figuras.</p> : null}
          </div>
        ) : null}

        <div className="sec">
          <div className="ch"><span className="kl">Publicaciones destacadas</span><Link className="lk" to={`${p.base}/menciones?narrativa=${n.id}`}>Ver en Menciones</Link></div>
          {publicaciones.length ? (
            <div className="list">
              {publicaciones.map((x, i) => (
                <div className="li" style={{ padding: '8px 0' }} key={i}>
                  <div className="gr"><span className="sm b">{x.descripcion ?? 'Publicación'}</span><span className="mu">{[x.canal, x.fuente].filter(Boolean).join(' · ')}</span></div>
                  {x.alcance != null ? <span className="mu" style={{ whiteSpace: 'nowrap' }}>Alcance {num(x.alcance)}</span> : null}
                </div>
              ))}
            </div>
          ) : <p className="mu">Sin publicaciones destacadas para esta narrativa.</p>}
          <span className="mu">Solo figuras, medios y publicaciones públicas. Descripciones de ejemplo, sin citas.</span>
        </div>

        {terminos.length ? (
          <div className="sec">
            <span className="kl">Términos asociados</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{terminos.map((t) => <span className="chip ring" key={t}>{t}</span>)}</div>
          </div>
        ) : null}

        {relacionadas.length ? (
          <div className="sec">
            <span className="kl">Relacionadas y contranarrativa</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {relacionadas.map((r) => {
                const o = p.narrativas.get(r.narrativa_id)!;
                const of = figuraDeNarrativa(o, figs);
                const ot = o.tema_id ? p.temas.get(o.tema_id)?.nombre : null;
                const c = p.conteos.get(o.id);
                const contra = r.tipo === 'Contranarrativa';
                return (
                  <button type="button" className="well kb" style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }} key={r.narrativa_id} onClick={() => p.abrir(o.id)}>
                    <span className="gr"><span className="sm b">{o.nombre}</span><span className="mu">{[of.corto, ot, c == null ? null : `${num(c)} menciones`].filter(Boolean).join(' · ')}</span></span>
                    <span className={contra ? 'chip own' : 'chip'}>{r.tipo ?? 'Relacionada'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {!p.esCliente ? (
          <div className="sec">
            <div className="ch"><label htmlFor="nota-n" className="kl">Notas del equipo</label><span className="chip">Interno · no se exporta</span></div>
            {notas.datos.length ? (
              <div className="list">
                {notas.datos.map((x) => (
                  <div className="li" style={{ padding: '8px 0' }} key={x.id}>
                    <div className="gr"><span className="sm" style={{ whiteSpace: 'pre-wrap' }}>{x.texto}</span><span className="mu">{nombrePersona(x.autor_id)} · {cuando(x.creada_en, p.hoy, p.zona)}</span></div>
                  </div>
                ))}
              </div>
            ) : null}
            {p.puedeEditar ? (
              <>
                <textarea id="nota-n" className="ta" rows={3} placeholder="Qué hacer con esta narrativa, quién responde" value={nota} onChange={(e) => setNota(e.target.value)} />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <button type="button" className="btn bp" onClick={guardarNota} disabled={guardando || !nota.trim()}>Guardar nota</button>
                </div>
              </>
            ) : (!notas.datos.length ? <p className="mu">Sin notas del equipo.</p> : null)}
          </div>
        ) : null}
      </aside>
    </div>,
    raiz,
  );
}
