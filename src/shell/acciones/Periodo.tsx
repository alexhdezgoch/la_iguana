// Panel Periodo: se abre bajo el botón de periodo de la barra superior.
// En la fase 1 solo existe el corte guardado de cada campaña (campanas.periodo_inicio..periodo_fin). Los demás rangos
// se listan para que se vea qué existirá, pero dicen que no tienen cifras y no cambian nada: no se finge un recálculo.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAcciones, type Panel } from '../Acciones';
import { hoyDe, useCampanas } from '../Campana';
import { Icono } from '../Iconos';
import { useTabla } from '../../lib/hooks';
import { aFecha, diasEntre, fecha } from '../../lib/formato';
import type { Campana, CampanaFase, Evento } from '../../lib/tipos';
import { useCampanaDeRuta } from './Buscador';
import './Periodo.css';

const ANCHO = 340;

function sumar(d: string, dias: number): string {
  const x = aFecha(d)!;
  x.setDate(x.getDate() + dias);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
/** "14 abr – 13 may 2027" · "7 – 13 may" · "13 may". */
function tramo(a: string | null, b: string | null, anio = false): string {
  const x = aFecha(a), y = aFecha(b);
  if (!x && !y) return 'sin fechas';
  if (!x) return `hasta el ${fecha(b, 'corto')}`;
  if (!y || a === b) return fecha(a, 'corto') + (anio ? ` ${x.getFullYear()}` : '');
  const fin = fecha(b, 'corto') + (anio ? ` ${y.getFullYear()}` : '');
  const ini = x.getMonth() === y.getMonth() && x.getFullYear() === y.getFullYear() ? String(x.getDate()) : fecha(a, 'corto');
  return `${ini} – ${fin}`;
}
/** Nombre del periodo guardado, el mismo que muestra el botón de la barra superior. */
export function nombrePeriodo(c: Pick<Campana, 'periodo_inicio' | 'periodo_fin' | 'fecha_corte'>): string | null {
  if (!c.periodo_inicio || !c.periodo_fin) return null;
  const n = (diasEntre(c.periodo_inicio, c.periodo_fin) ?? 0) + 1;
  return c.periodo_fin === hoyDe(c) ? `Últimos ${n} días` : tramo(c.periodo_inicio, c.periodo_fin, true);
}
function zonaTexto(zona: string): string {
  const ciudad = (zona.split('/').pop() ?? zona).replace(/_/g, ' ');
  let off = '';
  try {
    off = new Intl.DateTimeFormat('en-US', { timeZone: zona, timeZoneName: 'shortOffset' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch { /* zona desconocida */ }
  off = off.replace('GMT', 'UTC').replace('-', '−');
  return `Hora de ${ciudad}${off && off !== 'UTC' ? ` (${off})` : ''}`;
}

interface Opcion { clave: string; texto: string; sub: string; desde: string | null; hasta: string | null; inactiva?: boolean }

export function Periodo({ panel, cerrar }: { panel: Panel; cerrar: () => void }) {
  const ancla = panel.tipo === 'periodo' ? panel.ancla : null;
  const { aviso, periodo, setPeriodo } = useAcciones();
  const { campanas } = useCampanas();
  const actual = useCampanaDeRuta();
  const hoy = actual ? hoyDe(actual) : null;
  const fases = useTabla<CampanaFase>('campana_fases', { eq: { campana_id: actual?.id ?? '' }, orden: 'orden' }, !!actual);
  const eventos = useTabla<Evento>('eventos', { eq: { campana_id: actual?.id ?? '' }, orden: [['fecha_inicio', 'desc']] }, !!actual);

  const guardado = actual ? nombrePeriodo(actual) : null;
  // Fuera de una campaña (Panorama): el corte de cada campaña visible.
  const cortes = useMemo(() => {
    const m = new Map<string, { texto: string; desde: string; hasta: string; campanas: string[] }>();
    for (const c of campanas) {
      const t = nombrePeriodo(c); if (!t || !c.periodo_inicio || !c.periodo_fin) continue;
      const k = `${c.periodo_inicio}|${c.periodo_fin}`;
      if (!m.has(k)) m.set(k, { texto: t, desde: c.periodo_inicio, hasta: c.periodo_fin, campanas: [] });
      m.get(k)!.campanas.push(c.nombre);
    }
    return [...m.values()];
  }, [campanas]);

  const sinCifras = useMemo<Opcion[]>(() => {
    if (!actual || !hoy) return [];
    const L: Opcion[] = [
      { clave: 'hoy', texto: 'Hoy', sub: fecha(hoy, 'corto'), desde: hoy, hasta: hoy },
      { clave: '24h', texto: 'Últimas 24 h', sub: 'desde ayer', desde: sumar(hoy, -1), hasta: hoy },
      { clave: '7d', texto: 'Últimos 7 días', sub: tramo(sumar(hoy, -6), hoy), desde: sumar(hoy, -6), hasta: hoy },
    ];
    if (actual.inicio_campana && actual.inicio_campana <= hoy) L.push({ clave: 'toda', texto: 'Toda la campaña', sub: tramo(actual.inicio_campana, hoy), desde: actual.inicio_campana, hasta: hoy });
    return L.filter((o) => !(o.desde === actual.periodo_inicio && o.hasta === actual.periodo_fin));
  }, [actual, hoy]);

  const opFases = useMemo<Opcion[]>(() => fases.datos.map((f) => {
    const futura = !!(hoy && f.inicio && f.inicio > hoy);
    const enCurso = !!(hoy && (!f.inicio || f.inicio <= hoy) && (!f.fin || f.fin >= hoy) && (f.inicio || f.fin));
    let sub = tramo(f.inicio, f.fin);
    if (futura) sub += ' · aún no empieza';
    else if (enCurso && f.inicio && f.fin && hoy) sub = `${fecha(f.inicio, 'corto')} – hoy · día ${(diasEntre(f.inicio, hoy) ?? 0) + 1} de ${(diasEntre(f.inicio, f.fin) ?? 0) + 1}`;
    return { clave: 'fase:' + f.id, texto: f.nombre, sub, desde: f.inicio, hasta: f.fin && hoy && f.fin > hoy ? hoy : f.fin, inactiva: futura };
  }), [fases.datos, hoy]);

  const ventanas = useMemo(() => eventos.datos.filter((e) => e.fecha_inicio && hoy && e.fecha_inicio <= hoy && e.estado !== 'Cancelado' && e.estado !== 'Borrador'), [eventos.datos, hoy]);

  // ---------- elegir ----------
  function elegirGuardado(texto: string, rango: string) {
    cerrar();
    if (periodo === texto) aviso(`Ya estás viendo ${texto.toLowerCase()} (${rango}).`);
    else { setPeriodo(texto); aviso(`Periodo: ${texto.toLowerCase()} (${rango}).`); }
  }
  function sinDatos(texto: string) {
    cerrar();
    const corte = actual?.periodo_inicio ? tramo(actual.periodo_inicio, actual.periodo_fin, true) : null;
    aviso(corte
      ? `"${texto}" todavía no tiene cifras guardadas. La consola sigue mostrando ${corte}.`
      : `"${texto}" todavía no tiene cifras guardadas.`);
  }

  // ---------- rango personalizado ----------
  const [desde, setDesde] = useState(actual?.periodo_inicio ?? hoy ?? '');
  const [hasta, setHasta] = useState(actual?.periodo_fin ?? hoy ?? '');
  const [errRango, setErrRango] = useState('');
  function aplicarRango() {
    if (!desde || !hasta) { setErrRango('Elige las dos fechas.'); return; }
    if (desde > hasta) { setErrRango('"Desde" debe ser anterior a "Hasta".'); return; }
    if (actual && guardado && desde === actual.periodo_inicio && hasta === actual.periodo_fin) { elegirGuardado(guardado, tramo(desde, hasta, true)); return; }
    sinDatos(tramo(desde, hasta, true));
  }

  // ---------- posición, foco y teclas ----------
  const caja = useRef<HTMLDivElement>(null);
  const abierto = useRef(Date.now());
  const [pos, setPos] = useState<{ left: number; top: number; maxHeight: number } | null>(null);
  useLayoutEffect(() => {
    const p = caja.current; if (!p) return;
    const vw = window.innerWidth, vh = window.innerHeight, w = Math.min(ANCHO, vw - 16);
    const r = ancla && ancla.isConnected ? ancla.getBoundingClientRect() : new DOMRect(vw - 16, 8, 0, 48);
    const left = Math.max(8, Math.min(r.right - w, vw - w - 8));
    let top = r.bottom + 6, room = vh - top - 8;
    if (room < 220 && r.top > room) { room = Math.max(160, r.top - 14); top = Math.max(8, r.top - 6 - Math.min(p.scrollHeight, room)); }
    setPos({ left, top, maxHeight: Math.max(160, room) });
  }, [ancla, fases.datos.length, eventos.datos.length]);

  useEffect(() => {
    const previo = (ancla ?? document.activeElement) as HTMLElement | null;
    const t = window.setTimeout(() => caja.current?.querySelector<HTMLElement>('.pe-o[aria-checked="true"], .pe-o:not([disabled])')?.focus({ preventScroll: true }), 0);
    return () => { window.clearTimeout(t); if (previo && previo.isConnected) { try { previo.focus({ preventScroll: true }); } catch { /* nada */ } } };
  }, [ancla]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const p = caja.current; if (!p) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrar(); return; }
      const act = document.activeElement as HTMLElement | null;
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && act?.classList.contains('pe-o')) {
        const os = Array.from(p.querySelectorAll<HTMLElement>('.pe-o:not([disabled])'));
        const i = os.indexOf(act);
        e.preventDefault();
        os[(i + (e.key === 'ArrowDown' ? 1 : os.length - 1)) % os.length]?.focus();
      } else if (e.key === 'Tab') {
        const f = Array.from(p.querySelectorAll<HTMLElement>('button:not([disabled]),input,select'));
        if (!f.length) return;
        const dentro = p.contains(act);
        if (e.shiftKey && (act === f[0] || !dentro)) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && (act === f[f.length - 1] || !dentro)) { e.preventDefault(); f[0].focus(); }
      }
    };
    const redim = () => cerrar();
    const desplazar = (e: Event) => {
      if (Date.now() - abierto.current < 250) return;
      if (e.target instanceof Node && caja.current?.contains(e.target)) return;
      cerrar();
    };
    window.addEventListener('keydown', tecla, true);
    window.addEventListener('resize', redim);
    window.addEventListener('scroll', desplazar, true);
    return () => { window.removeEventListener('keydown', tecla, true); window.removeEventListener('resize', redim); window.removeEventListener('scroll', desplazar, true); };
  }, [cerrar]);

  const opcion = (o: Opcion, marcada: boolean, alElegir: () => void, nota?: string) => (
    <button key={o.clave} type="button" className="pe-o" role="menuitemradio" aria-checked={marcada} disabled={o.inactiva} onClick={alElegir}>
      <span className="pe-ot">{o.texto}</span>
      <span className="pe-mu">{o.sub}{nota ? <> · <span className="pe-sd">{nota}</span></> : null}</span>
      <Icono n="ok" g={2} />
    </button>
  );

  return (
    <div className="pg-periodo" onMouseDown={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); cerrar(); } }}>
      <div
        ref={caja} className="pe-pop" role="dialog" aria-label="Periodo"
        style={{ width: Math.min(ANCHO, window.innerWidth - 16), left: pos?.left ?? -9999, top: pos?.top ?? 0, maxHeight: pos?.maxHeight }}
      >
        {actual ? (
          <>
            <div className="pe-ps">{actual.periodo_inicio ? `Periodo con datos: ${tramo(actual.periodo_inicio, actual.periodo_fin, true)}` : 'Periodo con datos'}</div>
            {guardado && actual.periodo_inicio
              ? opcion({ clave: 'guardado', texto: guardado, sub: tramo(actual.periodo_inicio, actual.periodo_fin), desde: actual.periodo_inicio, hasta: actual.periodo_fin },
                periodo === guardado, () => elegirGuardado(guardado, tramo(actual.periodo_inicio, actual.periodo_fin, true)))
              : <p className="pe-nota">Esta campaña todavía no tiene cifras guardadas. Aparecen cuando el monitoreo entrega su primer corte.</p>}

            {sinCifras.length ? (
              <>
                <div className="pe-hr" />
                <div className="pe-ps">Otros rangos · sin cifras guardadas todavía</div>
                {sinCifras.map((o) => opcion(o, false, () => sinDatos(o.texto), 'sin datos'))}
              </>
            ) : null}

            {opFases.length ? (
              <>
                <div className="pe-hr" />
                <div className="pe-ps">Fases de la campaña · sin cifras guardadas todavía</div>
                {opFases.map((o) => opcion(o, false, () => sinDatos(o.texto), o.inactiva ? undefined : 'sin datos'))}
              </>
            ) : null}

            {ventanas.length ? (
              <>
                <div className="pe-hr" />
                <div className="pe-ps">Ventana de un evento · sin cifras guardadas todavía</div>
                <div className="pe-pb">
                  <select className="pe-in" aria-label="Ventana de un evento" defaultValue="" onChange={(e) => { const ev = ventanas.find((x) => x.id === e.target.value); if (ev) sinDatos(`Ventana: ${ev.nombre}`); }}>
                    <option value="">Elegir evento…</option>
                    {ventanas.map((e) => <option key={e.id} value={e.id}>{e.nombre} · {tramo(e.fecha_inicio, e.fecha_fin)}</option>)}
                  </select>
                </div>
              </>
            ) : null}

            <div className="pe-hr" />
            <div className="pe-ps">Personalizado</div>
            <div className="pe-pb">
              <div className="pe-row">
                <label className="pe-f"><span className="pe-mu">Desde</span><input className="pe-in" type="date" value={desde} max={hoy ?? undefined} onChange={(e) => { setDesde(e.target.value); setErrRango(''); }} /></label>
                <label className="pe-f"><span className="pe-mu">Hasta</span><input className="pe-in" type="date" value={hasta} max={hoy ?? undefined} onChange={(e) => { setHasta(e.target.value); setErrRango(''); }} /></label>
              </div>
              {errRango ? <span className="pe-err" role="alert">{errRango}</span> : null}
              <span className="pe-mu">Solo el periodo con datos tiene cifras por ahora.</span>
              <button type="button" className="pe-bt" onClick={aplicarRango}>Aplicar rango</button>
            </div>
          </>
        ) : (
          <>
            <div className="pe-ps">Periodo con datos</div>
            {cortes.length === 1 ? (
              opcion({ clave: 'guardado', texto: cortes[0].texto, sub: tramo(cortes[0].desde, cortes[0].hasta), desde: cortes[0].desde, hasta: cortes[0].hasta },
                periodo === cortes[0].texto, () => elegirGuardado(cortes[0].texto, tramo(cortes[0].desde, cortes[0].hasta, true)))
            ) : cortes.length ? (
              cortes.map((c) => (
                <div key={c.desde + c.hasta} className="pe-fila"><span className="pe-ot">{tramo(c.desde, c.hasta, true)}</span><span className="pe-mu">{c.campanas.join(', ')}</span></div>
              ))
            ) : <p className="pe-nota">Ninguna de tus campañas tiene cifras guardadas todavía.</p>}
            {campanas.length ? <p className="pe-nota">Cada campaña tiene su propio corte. Entra a una campaña para ver sus fases y eventos.</p> : null}
          </>
        )}

        <div className="pe-pft">
          <span className="pe-mu">{zonaTexto(actual?.zona_horaria || 'America/Caracas')}</span>
          <button type="button" className="pe-lkb" onClick={cerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
