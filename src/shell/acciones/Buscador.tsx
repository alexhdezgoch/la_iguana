// Panel Buscador (Ctrl K). Busca entre lo que la persona puede ver: campañas, figuras, eventos, temas y narrativas
// de sus campañas, más atajos de navegación y acciones. Cada resultado lleva a su ruta real.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import { useAcciones, type Panel } from '../Acciones';
import { useCampanas } from '../Campana';
import { useSesion } from '../Sesion';
import { Icono } from '../Iconos';
import { db } from '../../lib/db';
import { useConsulta, useTabla } from '../../lib/hooks';
import { fecha, num, pct } from '../../lib/formato';
import type { Campana, Direccion, Evento, FiguraCampana, Narrativa, RolCampana, Tema } from '../../lib/tipos';
import './Buscador.css';

const I_CAL = 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z';
const I_HASH = 'M4 9h16M4 15h16M10 3 8 21M16 3l-2 18';
const I_BOLT = 'M13 2 4 14h7l-1 8 9-12h-7l1-8z';
const I_LAY = 'M3 4h18v6H3zM3 14h8v6H3zM15 14h6v6h-6z';

interface Item {
  clave: string;
  grupo: string;
  /** 0 para la campaña actual y los atajos, 1 para otras campañas: con la misma coincidencia, lo actual va antes. */
  peso: number;
  titulo: string;
  sub: string;
  icono: ReactNode;
  a?: string;
  accion?: () => void;
  palabras?: string;
  n: string;
}

function norm(s: string | null | undefined): string {
  let t = String(s ?? '').toLowerCase();
  try { t = t.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch { /* sin normalize */ }
  return t.replace(/\s+/g, ' ').trim();
}

const DIRECCION: Record<Direccion, string> = {
  Favorable: 'Narrativa a favor', Desfavorable: 'Narrativa en contra', 'Sin dirección': 'Narrativa sin dirección', Posicionamiento: 'Narrativa de posicionamiento',
};

/** La campaña de la ruta. Los paneles se montan fuera de <Route>, así que useParams no sirve aquí. */
export function useCampanaDeRuta(): Campana | null {
  const { pathname } = useLocation();
  const { campanas } = useCampanas();
  const id = matchPath('/c/:campanaId/*', pathname)?.params.campanaId;
  return campanas.find((c) => c.id === id) ?? null;
}

function etiqueta(c: Campana): string {
  return c.contienda ?? c.nombre;
}

export function Buscador({ cerrar }: { panel: Panel; cerrar: () => void }) {
  const navegar = useNavigate();
  const { campanas, resumenes } = useCampanas();
  const { persona } = useSesion();
  const { abrirAgregarUrl, abrirDescarga, abrirPeriodo, periodo } = useAcciones();
  const actual = useCampanaDeRuta();
  const destino = actual ?? campanas[0] ?? null;
  const ids = useMemo(() => campanas.map((c) => c.id), [campanas]);
  const hay = ids.length > 0;

  const figuras = useTabla<FiguraCampana>('v_figuras_campana', { eq: { campana_id: ids }, orden: 'orden' }, hay);
  const eventos = useTabla<Evento>('eventos', { eq: { campana_id: ids }, orden: [['fecha_inicio', 'desc']] }, hay);
  const temas = useTabla<Tema>('temas', { eq: { campana_id: ids }, orden: 'orden' }, hay);
  const narrativas = useTabla<Narrativa>('narrativas', { eq: { campana_id: ids }, orden: [['menciones', 'desc']] }, hay);
  const rol = useConsulta<RolCampana | null>(
    () => (destino ? db.rpc<RolCampana | null>('mi_rol', { p_campana: destino.id }) : Promise.resolve(null)),
    [destino?.id], null,
  );
  const puedeEditar = rol.datos === 'Administración' || rol.datos === 'Análisis';
  const cargando = figuras.cargando || eventos.cargando || temas.cargando || narrativas.cargando;
  const error = figuras.error ?? eventos.error ?? temas.error ?? narrativas.error;

  const items = useMemo<Item[]>(() => {
    const L: Item[] = [];
    const add = (it: Omit<Item, 'n'>) => L.push({ ...it, n: norm(`${it.titulo} ${it.sub} ${it.palabras ?? ''}`) });
    const nombre = new Map(campanas.map((c) => [c.id, c]));
    const peso = (id: string) => (id === actual?.id ? 0 : 1);
    const ir = <Icono n="ir" t={14} g={2} />;

    // Ir a
    add({ clave: 'ir:panorama', grupo: 'Ir a', peso: 0, titulo: 'Todas las campañas', sub: 'Vista del equipo', icono: ir, a: '/', palabras: 'inicio panorama' });
    if (destino) {
      const base = `/c/${destino.id}`;
      const res = resumenes.find((r) => r.id === destino.id);
      const nFig = figuras.datos.filter((f) => f.campana_id === destino.id).length;
      const sufijo = actual ? '' : ` · ${etiqueta(destino)}`;
      const nav: Array<[string, string, string, string]> = [
        ['', 'Resumen', 'Tablero diario de la campaña', 'inicio tablero'],
        ['/figuras', 'Figuras', `${nFig} ${nFig === 1 ? 'figura' : 'figuras'} en seguimiento`, 'personas candidatos'],
        ['/eventos', 'Eventos', 'Debates, giras y mítines', 'calendario'],
        ['/menciones', 'Menciones', res ? `${res.menciones_por_revisar} por revisar` : 'Bandeja de menciones', 'notas publicaciones'],
        ['/temas', 'Temas y narrativas', 'De qué se habla y qué se instala', 'topicos'],
        ['/alertas', 'Alertas', res ? `${res.alertas_abiertas} ${res.alertas_abiertas === 1 ? 'abierta' : 'abiertas'}` : 'Bandeja de alertas', 'avisos riesgo'],
        ['/reportes', 'Reportes', 'Informes para compartir', 'informes exportar pdf'],
      ];
      nav.forEach(([r, t, s, p]) => add({ clave: 'ir:' + t, grupo: 'Ir a', peso: 0, titulo: t, sub: s + sufijo, icono: ir, a: base + r, palabras: p }));
    }
    if (persona && persona.rol_org !== 'externo') {
      add({ clave: 'ir:nueva', grupo: 'Ir a', peso: 0, titulo: 'Nueva campaña', sub: 'Abrir un espacio nuevo', icono: ir, a: '/nueva-campana', palabras: 'crear campana' });
    }

    // Figuras, eventos, temas y narrativas de cada campaña visible
    for (const f of figuras.datos) {
      const c = nombre.get(f.campana_id); if (!c) continue;
      const cargo = (f.extra_campana?.cargo as string | undefined) ?? f.cargo;
      add({
        clave: `fig:${f.campana_id}:${f.figura_id}`, grupo: `Figuras · ${etiqueta(c)}`, peso: peso(c.id), titulo: f.nombre,
        sub: [f.partido ?? cargo, f.relacion].filter(Boolean).join(' · '), icono: f.iniciales ?? '··',
        a: `/c/${c.id}/figuras/${f.figura_id}`, palabras: `figura perfil ${cargo ?? ''} ${f.coalicion ?? ''}`,
      });
    }
    for (const e of eventos.datos) {
      const c = nombre.get(e.campana_id); if (!c) continue;
      const cuandoEs = e.fecha_inicio ? (e.fecha_fin && e.fecha_fin !== e.fecha_inicio ? `${fecha(e.fecha_inicio, 'corto')} – ${fecha(e.fecha_fin, 'corto')}` : fecha(e.fecha_inicio, 'medio')) : 'Sin fecha';
      add({
        clave: `ev:${e.id}`, grupo: `Eventos · ${etiqueta(c)}`, peso: peso(c.id), titulo: e.nombre, sub: `${e.tipo} · ${cuandoEs} · ${e.estado}`,
        icono: <Icono d={I_CAL} t={14} />, a: `/c/${c.id}/eventos/${e.id}`, palabras: `evento ${e.ciudad ?? ''} ${e.sede ?? ''} ${(e.hashtags ?? []).join(' ')}`,
      });
    }
    for (const t of temas.datos) {
      const c = nombre.get(t.campana_id); if (!c) continue;
      add({
        clave: `tema:${t.id}`, grupo: `Temas y narrativas · ${etiqueta(c)}`, peso: peso(c.id), titulo: t.nombre,
        sub: ['Tema', `${num(t.menciones)} menciones`, t.porcentaje != null ? pct(t.porcentaje) : null].filter(Boolean).join(' · '),
        icono: <Icono d={I_HASH} t={14} />, a: `/c/${c.id}/temas?tema=${encodeURIComponent(t.id)}`, palabras: 'tema agenda topico',
      });
    }
    for (const n of narrativas.datos) {
      const c = nombre.get(n.campana_id); if (!c) continue;
      add({
        clave: `nar:${n.id}`, grupo: `Temas y narrativas · ${etiqueta(c)}`, peso: peso(c.id), titulo: n.nombre,
        sub: [DIRECCION[n.direccion] ?? 'Narrativa', num(n.menciones), n.tendencia?.toLowerCase()].filter(Boolean).join(' · '),
        icono: <Icono d={I_HASH} t={14} />, a: `/c/${c.id}/temas?narrativa=${encodeURIComponent(n.id)}`, palabras: `narrativa ${n.estado ?? ''}`,
      });
    }

    // Acciones (solo las que el rol puede hacer)
    if (destino) {
      const base = `/c/${destino.id}`;
      if (puedeEditar) {
        add({ clave: 'ac:figura', grupo: 'Acciones', peso: 0, titulo: 'Agregar figura', sub: 'Sumar una persona al seguimiento', icono: <Icono d={I_BOLT} t={14} />, a: `${base}/figuras/nueva`, palabras: 'nueva crear persona' });
        add({ clave: 'ac:evento', grupo: 'Acciones', peso: 0, titulo: 'Crear evento', sub: 'Registrar un debate, gira o mitin', icono: <Icono d={I_BOLT} t={14} />, a: `${base}/eventos/nuevo`, palabras: 'nuevo debate mitin' });
        add({ clave: 'ac:url', grupo: 'Acciones', peso: 0, titulo: 'Agregar URL', sub: 'Sumar a mano una nota o publicación', icono: <Icono d={I_BOLT} t={14} />, accion: abrirAgregarUrl, palabras: 'enlace link mencion manual' });
      }
      add({ clave: 'ac:descarga', grupo: 'Acciones', peso: 0, titulo: 'Descargar reporte', sub: 'Exportar esta vista', icono: <Icono d={I_BOLT} t={14} />, accion: () => abrirDescarga(), palabras: 'exportar informe pdf' });
    }
    const boton = document.querySelector<HTMLElement>('.app .top [data-periodo], .app .top button.btn.bg:not(.bi)');
    add({
      clave: 'ac:periodo', grupo: 'Acciones', peso: 0, titulo: 'Cambiar periodo', sub: periodo, icono: <Icono d={I_BOLT} t={14} />,
      accion: () => abrirPeriodo(boton), palabras: 'fechas rango',
    });

    // Campañas
    for (const c of campanas) {
      add({
        clave: `camp:${c.id}`, grupo: 'Campañas', peso: 0, titulo: c.nombre, sub: [c.contienda, c.fase.toLowerCase()].filter(Boolean).join(' · '),
        icono: c.iniciales ?? '··', a: `/c/${c.id}`, palabras: `campana cambiar espacio ${c.titulo_largo ?? ''} ${c.ambito ?? ''}`,
      });
    }
    if (campanas.length) add({
      clave: 'camp:todas', grupo: 'Campañas', peso: 0, titulo: 'Todas las campañas', sub: `${campanas.length} ${campanas.length === 1 ? 'campaña' : 'campañas'} del equipo`,
      icono: <Icono d={I_LAY} t={14} />, a: '/', palabras: 'campana panorama',
    });
    return L;
  }, [campanas, resumenes, actual, destino, persona, figuras.datos, eventos.datos, temas.datos, narrativas.datos, puedeEditar, periodo, abrirAgregarUrl, abrirDescarga, abrirPeriodo]);

  const [texto, setTexto] = useState('');
  const [idx, setIdx] = useState(0);
  const lista = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);

  const mostrados = useMemo(() => {
    const q = norm(texto);
    if (!q) return items.filter((it) => it.grupo === 'Ir a' || it.grupo === 'Acciones' || it.grupo === 'Campañas');
    const partes = q.split(' ');
    const hit = items.filter((it) => partes.every((p) => it.n.includes(p)));
    // Suben los grupos y filas donde la búsqueda está en el nombre; los de la campaña actual van antes.
    const s = new Map<Item, number>();
    const mejor = new Map<string, number>();
    hit.forEach((it) => {
      const l = ' ' + norm(it.titulo);
      const v = l.includes(' ' + q) ? 2 : l.includes(q) ? 1 : 0;
      s.set(it, v);
      mejor.set(it.grupo, Math.max(mejor.get(it.grupo) ?? 0, v));
    });
    const orden = new Map(hit.map((it, i) => [it, i]));
    const primero = new Map<string, number>();
    hit.forEach((it, i) => { if (!primero.has(it.grupo)) primero.set(it.grupo, i); });
    return hit.slice().sort((a, b) =>
      (mejor.get(b.grupo)! - mejor.get(a.grupo)!) || (a.peso - b.peso) || (primero.get(a.grupo)! - primero.get(b.grupo)!)
      || (a.grupo === b.grupo ? s.get(b)! - s.get(a)! : 0) || (orden.get(a)! - orden.get(b)!));
  }, [items, texto]);

  useEffect(() => { setIdx(0); if (lista.current) lista.current.scrollTop = 0; }, [texto]);
  useEffect(() => { if (idx >= mostrados.length && mostrados.length) setIdx(0); }, [idx, mostrados.length]);

  // Foco: entra al campo y vuelve a donde estaba al cerrar.
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    entrada.current?.focus({ preventScroll: true });
    return () => { if (previo && previo.isConnected) { try { previo.focus({ preventScroll: true }); } catch { /* nada */ } } };
  }, []);

  function abrir(it: Item | undefined) {
    if (!it) return;
    if (it.accion) { it.accion(); return; } // la acción cambia de panel
    cerrar();
    if (it.a) navegar(it.a);
  }

  // Teclas: Esc y Ctrl K cierran (antes que el atajo del Layout, que lo volvería a abrir); Tab queda dentro.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') { e.preventDefault(); e.stopPropagation(); cerrar(); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrar(); return; }
      if (e.key === 'Tab' && caja.current) {
        const f = Array.from(caja.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input'));
        if (!f.length) return;
        const primero = f[0], ultimo = f[f.length - 1], dentro = caja.current.contains(document.activeElement);
        if (e.shiftKey && (document.activeElement === primero || !dentro)) { e.preventDefault(); ultimo.focus(); }
        else if (!e.shiftKey && (document.activeElement === ultimo || !dentro)) { e.preventDefault(); primero.focus(); }
      }
    };
    window.addEventListener('keydown', tecla, true);
    return () => window.removeEventListener('keydown', tecla, true);
  }, [cerrar]);

  function mover(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!mostrados.length) return;
      const n = (idx + (e.key === 'ArrowDown' ? 1 : mostrados.length - 1)) % mostrados.length;
      setIdx(n);
      lista.current?.querySelector(`[data-i="${n}"]`)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      abrir(mostrados[idx]);
    }
  }

  let grupo = '';
  const activo = mostrados[idx];

  return (
    <div className="pg-buscador" onMouseDown={(e) => { if (e.target === e.currentTarget) cerrar(); }}>
      <div className="bu-modal" role="dialog" aria-modal="true" aria-label="Buscar" ref={caja}>
        <div className="bu-ph">
          <Icono n="buscar" t={18} />
          <input
            ref={entrada} className="bu-pin" type="text" autoComplete="off" spellCheck={false} value={texto}
            onChange={(e) => setTexto(e.target.value)} onKeyDown={mover}
            placeholder="Buscar figuras, eventos, temas o acciones…" aria-label="Buscar" role="combobox"
            aria-expanded="true" aria-controls="bu-pr" aria-activedescendant={activo ? `bu-o-${idx}` : undefined}
          />
          <button type="button" className="bu-kb bu-esc" onClick={cerrar} aria-label="Cerrar">Esc</button>
        </div>
        <div className="bu-pr" id="bu-pr" role="listbox" ref={lista} aria-busy={cargando}>
          {error ? (
            <div className="bu-pe"><span className="bu-b">No se pudo buscar</span><span className="bu-mu">{error}</span></div>
          ) : !mostrados.length ? (
            cargando ? <div className="bu-pe"><span className="bu-mu">Buscando…</span></div> : (
              <div className="bu-pe">
                <span className="bu-b">Sin resultados para "{texto.trim()}"</span>
                <span className="bu-mu">Prueba con el nombre de una figura, un evento o una acción, por ejemplo "debate" o "reporte".</span>
              </div>
            )
          ) : mostrados.map((it, i) => {
            const cab = it.grupo !== grupo ? (grupo = it.grupo) : null;
            return (
              <div key={it.clave} style={{ display: 'contents' }}>
                {cab ? <div className="bu-gh" role="presentation">{cab}</div> : null}
                <a
                  id={`bu-o-${i}`} data-i={i} role="option" aria-selected={i === idx}
                  className={'bu-it' + (i === idx ? ' on' : '')} href={it.a ?? '#'} tabIndex={-1}
                  onMouseMove={() => { if (i !== idx) setIdx(i); }}
                  onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); abrir(it); }}
                >
                  <i>{it.icono}</i>
                  <span><span className="bu-b bu-t">{it.titulo}</span><span className="bu-mu">{it.sub}</span></span>
                  <span className="bu-kb">↵</span>
                </a>
              </div>
            );
          })}
        </div>
        <div className="bu-pf">
          <span><span className="bu-kb">↑</span><span className="bu-kb">↓</span>mover</span>
          <span><span className="bu-kb">↵</span>abrir</span>
          <span><span className="bu-kb">Ctrl K</span>cerrar</span>
          <span className="bu-fin">Busca solo dentro de tus campañas</span>
        </div>
      </div>
    </div>
  );
}
