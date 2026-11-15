// Nueva campaña: asistente de 6 pasos. El paso actual va en la URL (?paso=1..6).
// El borrador se guarda solo en `borradores` (tipo 'nueva-campana', uno por persona) y se retoma al volver.
// Al terminar: una llamada a crear_campana (850_funciones.sql), avisar(...), se borra el borrador y se abre /c/<id>.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { hoyDe, useCampanas, usePagina } from '../shell/Campana';
import { useSesion } from '../shell/Sesion';
import { useAcciones } from '../shell/Acciones';
import { Carga, Vacio } from '../shell/Estados';
import { avisar, db } from '../lib/db';
import { useConsulta, useTabla } from '../lib/hooks';
import { fecha } from '../lib/formato';
import type { Borrador, CampanaFigura, Figura, MiembroCampana, Persona } from '../lib/tipos';
import { PASOS, normalizar, parametro, problemas, revisarCalendario, type DatosB } from './nueva-campana/modelo';
import { PasoCalendario, PasoContienda, PasoEquipo, PasoFiguras, PasoRevisar, PasoTerminos, nombreFigura, type Ctx } from './nueva-campana/Pasos';
import { VistaPrevia } from './nueva-campana/VistaPrevia';
import './NuevaCampana.css';

type EstadoGuardado = 'inicial' | 'guardando' | 'guardado' | 'error';

export default function NuevaCampana() {
  usePagina('Nueva campaña');
  const { persona, org } = useSesion();
  const { campanas } = useCampanas();
  const { aviso } = useAcciones();
  const navegar = useNavigate();
  const [sp, setSp] = useSearchParams();
  // La campaña nueva no tiene fecha de corte: su "hoy" es la fecha real.
  const hoy = hoyDe(null);
  const yo = persona?.id ?? null;
  const orgId = org?.id ?? '';

  const membresias = useTabla<MiembroCampana>('miembros_campana', { eq: { persona_id: yo ?? '' } }, !!yo);
  const directorio = useTabla<Figura>('figuras', { eq: { org_id: orgId }, orden: 'nombre' }, !!orgId);
  const vinculos = useTabla<CampanaFigura>('campana_figuras', {});
  const personas = useTabla<Persona>('personas', { eq: { org_id: orgId, activa: true }, orden: 'nombre' }, !!orgId);
  // Sin suscripción a la tabla: el borrador se lee una vez y desde ahí manda lo que hay en pantalla.
  const borradores = useConsulta<Borrador[]>(
    () => (yo ? db.listar<Borrador>('borradores', { eq: { persona_id: yo, tipo: 'nueva-campana' }, orden: [['actualizado_en', 'desc']], limite: 1 }) : Promise.resolve([])),
    [yo], [],
  );

  const [d, setD] = useState<DatosB | null>(null);
  const [retomado, setRetomado] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoGuardado>('inicial');
  const [errorG, setErrorG] = useState('');
  const [creando, setCreando] = useState(false);
  const [nuevaId, setNuevaId] = useState<string | null>(null);
  const [confirmaDescarte, setConfirmaDescarte] = useState(false);
  const [hayBorrador, setHayBorrador] = useState(false);

  const dRef = useRef<DatosB | null>(null);
  const bidRef = useRef<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const cola = useRef<Promise<void>>(Promise.resolve());
  const terminado = useRef(false);
  const sucio = useRef(false);
  dRef.current = d;

  // Retoma el borrador guardado, o empieza uno en blanco.
  useEffect(() => {
    if (d || borradores.cargando || !yo) return;
    const fila = borradores.datos[0];
    bidRef.current = fila?.id ?? null;
    setHayBorrador(!!fila);
    setRetomado(fila ? fila.actualizado_en : null);
    setD(normalizar(fila?.datos, yo));
  }, [d, borradores.cargando, borradores.datos, yo]);

  // ---------- guardado del borrador ----------
  const guardar = useCallback((): Promise<void> => {
    if (!orgId || !yo) return Promise.resolve();
    cola.current = cola.current.then(async () => {
      const datos = dRef.current;
      if (terminado.current || !datos || !sucio.current) return;
      sucio.current = false;
      setEstado('guardando');
      try {
        const ahora = new Date().toISOString();
        let hecho = false;
        if (bidRef.current) {
          try { await db.cambiar('borradores', bidRef.current, { datos, actualizado_en: ahora }); hecho = true; } catch { bidRef.current = null; }
        }
        if (!hecho) {
          const f = await db.crear<Borrador>('borradores', { org_id: orgId, persona_id: yo, tipo: 'nueva-campana', datos });
          bidRef.current = f.id;
        }
        setHayBorrador(true);
        setEstado('guardado');
      } catch (e) {
        sucio.current = true;
        setErrorG(e instanceof Error ? e.message : String(e));
        setEstado('error');
      }
    });
    return cola.current;
  }, [orgId, yo]);

  const programar = useCallback(() => {
    sucio.current = true;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void guardar(); }, 700);
  }, [guardar]);

  // Al salir de la pantalla se guarda lo pendiente.
  useEffect(() => () => { window.clearTimeout(timer.current); if (sucio.current && !terminado.current) void guardar(); }, [guardar]);

  const upd = useCallback((p: Partial<DatosB>) => {
    setD((prev) => (prev ? { ...prev, ...p } : prev));
    programar();
  }, [programar]);

  // ---------- derivados ----------
  const lista = directorio.datos;
  const nombreDe = useCallback((f: Parameters<typeof nombreFigura>[0]) => nombreFigura(f, lista), [lista]);
  const cal = useMemo(() => (d ? revisarCalendario(d, hoy) : null), [d, hoy]);
  const bad = useMemo(() => (d ? problemas(d, hoy, nombreDe) : []), [d, hoy, nombreDe]);
  const yaEn = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const v of vinculos.datos) {
      const c = campanas.find((x) => x.id === v.campana_id);
      if (!c) continue;
      m.set(v.figura_id, [...(m.get(v.figura_id) ?? []), c.titulo_largo ?? c.nombre]);
    }
    return m;
  }, [vinculos.datos, campanas]);

  // Paso: el de la URL, sin pasar del primero que tiene algo por corregir.
  const limite = bad.slice(0, 5).findIndex(Boolean);
  const pedido = Number(sp.get('paso'));
  const base = d ? (pedido >= 1 && pedido <= 6 ? pedido - 1 : d.paso) : 0;
  const paso = Math.min(base, limite < 0 ? 5 : limite);
  const maxVisto = d ? Math.max(d.max ?? d.paso, paso) : 0;

  useEffect(() => {
    if (!d) return;
    if (sp.get('paso') !== String(paso + 1)) setSp((s) => { const n = new URLSearchParams(s); n.set('paso', String(paso + 1)); return n; }, { replace: true });
  }, [d, paso, sp, setSp]);

  const go = useCallback((n: number) => {
    setSp((s) => { const x = new URLSearchParams(s); x.set('paso', String(n + 1)); return x; });
    upd({ paso: n, max: Math.max(dRef.current?.max ?? 0, dRef.current?.paso ?? 0, n) });
    window.scrollTo(0, 0);
  }, [setSp, upd]);

  // Tras crear: espera a que la lista de campañas tenga la nueva y la abre.
  useEffect(() => {
    if (!nuevaId) return;
    const abrir = () => navegar(`/c/${nuevaId}`);
    if (campanas.some((c) => c.id === nuevaId)) { abrir(); return; }
    const t = window.setTimeout(abrir, 4000);
    return () => window.clearTimeout(t);
  }, [nuevaId, campanas, navegar]);

  // ---------- acciones ----------
  const guardarYa = async () => {
    window.clearTimeout(timer.current);
    sucio.current = true;
    await guardar();
    if (!sucio.current) aviso('Borrador guardado. Puedes volver cuando quieras.');
    else aviso(`No se pudo guardar el borrador: ${errorG || 'inténtalo de nuevo'}`);
  };

  const descartar = async () => {
    if (!confirmaDescarte) { setConfirmaDescarte(true); return; }
    setConfirmaDescarte(false);
    window.clearTimeout(timer.current);
    sucio.current = false;
    await cola.current;
    try {
      if (bidRef.current) await db.borrar('borradores', bidRef.current);
      bidRef.current = null;
      setHayBorrador(false);
      setRetomado(null);
      setEstado('inicial');
      setD(normalizar(null, yo));
      setSp((s) => { const x = new URLSearchParams(s); x.set('paso', '1'); return x; });
      aviso('Borrador descartado');
    } catch (e) {
      aviso(e instanceof Error ? e.message : String(e));
    }
  };

  const crear = async () => {
    if (!d || !org || bad[5] || creando) return;
    setCreando(true);
    window.clearTimeout(timer.current);
    terminado.current = true;
    await cola.current;
    try {
      const id = await db.rpc<string>('crear_campana', { p: parametro(d, org.id, yo, hoy) });
      avisar('campanas', 'campana_fases', 'campana_figuras', 'figuras', 'terminos', 'miembros_campana', 'personas');
      if (bidRef.current) {
        await db.borrar('borradores', bidRef.current).catch(() => {});
        bidRef.current = null;
      }
      aviso(`Campaña creada: ${d.campana.nombre.trim()}`, { texto: 'Ver figuras', a: `/c/${id}/figuras` });
      setNuevaId(id);
    } catch (e) {
      terminado.current = false;
      setCreando(false);
      aviso(e instanceof Error ? e.message : String(e));
    }
  };

  // ---------- quién puede crear ----------
  const puedeCrear = !!persona && persona.rol_org !== 'externo'
    && (persona.rol_org === 'admin' || membresias.datos.some((m) => m.rol === 'Administración' || m.rol === 'Análisis'));

  if (!membresias.cargando && !puedeCrear) {
    return (
      <main className="page pg-nueva-campana">
        <div className="ph"><div><h1>Nueva campaña</h1><p className="mu">Crear campañas es para quien administra o analiza en {org?.nombre ?? 'el equipo'}.</p></div></div>
        <Vacio titulo="Tu cuenta no puede crear campañas">
          Tu acceso es de solo lectura o de cliente. Pide a quien administra {org?.nombre ?? 'el equipo'} que cree la campaña o que te dé un rol de Análisis. <Link to="/">Ver todas las campañas</Link>
        </Vacio>
      </main>
    );
  }

  const ctx: Ctx | null = d && cal ? {
    d, upd, hoy, cal, bad, directorio: lista, yaEn, personas: personas.datos, yo, orgNombre: org?.nombre ?? 'el equipo', go,
  } : null;
  const ultimo = paso === 5;
  const bloqueado = !!bad[paso];
  const sub = estado === 'guardando' ? `Guardando borrador… · paso ${paso + 1} de 6`
    : estado === 'error' ? `No se pudo guardar el borrador: ${errorG}`
    : estado === 'guardado' ? `Borrador guardado · puedes volver cuando quieras · paso ${paso + 1} de 6`
    : retomado ? `Retomas el borrador del ${fecha(retomado)} · se guarda solo mientras avanzas · paso ${paso + 1} de 6`
    : `Borrador · se guarda solo mientras avanzas · paso ${paso + 1} de 6`;

  return (
    <Carga estados={[membresias, directorio, personas, vinculos, borradores]}>
      {!ctx ? <main className="page"><div className="cargando">Cargando…</div></main> : (
        <main className="page pg-nueva-campana">
          <div className="ph">
            <div>
              <h1>Nueva campaña</h1>
              <p className={estado === 'error' ? 'tu sm b' : 'mu'}>{sub}</p>
            </div>
            <div className="acts">
              {hayBorrador ? (
                <button type="button" className="btn bg" onClick={() => void descartar()} onBlur={() => setConfirmaDescarte(false)}>{confirmaDescarte ? 'Confirmar: descartar borrador' : 'Descartar borrador'}</button>
              ) : null}
              <Link className="btn bg" to="/">Cancelar</Link>
            </div>
          </div>

          <nav className="card stp" aria-label="Pasos del asistente">
            {PASOS.map((nombre, i) => {
              const actual = i === paso;
              const enlace = !actual && i <= maxVisto;
              const cls = 'st' + (actual ? ' cur' : enlace ? ' done' : '');
              const marca = enlace && !bad[i] ? '✓' : String(i + 1);
              return enlace
                ? <button key={nombre} type="button" className={cls} onClick={() => go(i)} title={`Volver a ${nombre}`}><i>{marca}</i>{nombre}</button>
                : <span key={nombre} className={cls} aria-current={actual ? 'step' : undefined}><i>{marca}</i>{nombre}</span>;
            })}
          </nav>

          <div className="row">
            <div className="col c3">
              {paso === 0 ? <PasoContienda {...ctx} /> : null}
              {paso === 1 ? <PasoCalendario {...ctx} /> : null}
              {paso === 2 ? <PasoFiguras {...ctx} /> : null}
              {paso === 3 ? <PasoTerminos {...ctx} /> : null}
              {paso === 4 ? <PasoEquipo {...ctx} /> : null}
              {paso === 5 ? <PasoRevisar {...ctx} /> : null}

              <div className="foot">
                {paso > 0 ? <button type="button" className="btn bg" onClick={() => go(paso - 1)}>Atrás</button> : null}
                <span className="mu" style={{ flex: '1 1 160px', textAlign: 'right' }}>{bloqueado ? bad[paso] : ultimo ? 'Nada se crea hasta que confirmes' : ''}</span>
                <button type="button" className="btn bg" onClick={() => void guardarYa()}>Guardar borrador</button>
                <button type="button" className="btn bp" aria-disabled={bloqueado || creando}
                  onClick={() => { if (bloqueado || creando) return; if (ultimo) void crear(); else go(paso + 1); }}>
                  {ultimo ? (creando ? 'Creando campaña…' : 'Crear campaña') : `Continuar: ${PASOS[paso + 1]}`}
                </button>
              </div>
            </div>

            <VistaPrevia {...ctx} otras={campanas.length} />
          </div>
        </main>
      )}
    </Carga>
  );
}
