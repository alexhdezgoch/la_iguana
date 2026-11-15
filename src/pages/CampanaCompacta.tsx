// Vista compacta: una sola pantalla con pestañas para campañas pequeñas (campanas.vista = 'compacta').
// App.tsx la monta en /c/:id, /figuras, /eventos, /menciones, /temas y /alertas con `seccion`:
// cada pestaña es la ruta real de esa sección, así la barra lateral y el enlace compartido coinciden.
// Los filtros dentro de una sección (menciones, alertas) van en ?ver=… con useSearchParams.
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { SeccionCompacta } from '../App';
import { hoyDe, useCampana, usePagina, useRol } from '../shell/Campana';
import { Carga } from '../shell/Estados';
import { Icono } from '../shell/Iconos';
import { useTabla } from '../lib/hooks';
import { rango } from '../lib/formato';
import type { FiguraCampana } from '../lib/tipos';
import type { Ctx } from './campana-compacta/comun';
import SecResumen from './campana-compacta/SecResumen';
import SecFiguras from './campana-compacta/SecFiguras';
import SecEventos from './campana-compacta/SecEventos';
import SecMenciones from './campana-compacta/SecMenciones';
import SecTemas from './campana-compacta/SecTemas';
import SecAlertas from './campana-compacta/SecAlertas';
import './CampanaCompacta.css';

const PESTANAS: Array<{ id: SeccionCompacta; texto: string; ruta: string }> = [
  { id: 'resumen', texto: 'Resumen', ruta: '' },
  { id: 'figuras', texto: 'Figuras', ruta: '/figuras' },
  { id: 'eventos', texto: 'Eventos', ruta: '/eventos' },
  { id: 'menciones', texto: 'Menciones', ruta: '/menciones' },
  { id: 'temas', texto: 'Temas y narrativas', ruta: '/temas' },
  { id: 'alertas', texto: 'Alertas', ruta: '/alertas' },
];

export default function CampanaCompacta({ seccion }: { seccion: SeccionCompacta }) {
  const actual = PESTANAS.find((p) => p.id === seccion) ?? PESTANAS[0];
  usePagina(actual.texto);
  const campana = useCampana();
  const { puedeEditar } = useRol();
  const base = `/c/${campana.id}`;
  const hoy = hoyDe(campana);
  const tabsRef = useRef<HTMLDivElement>(null);

  const figuras = useTabla<FiguraCampana>('v_figuras_campana', { eq: { campana_id: campana.id }, orden: 'orden' });
  const propia = figuras.datos.find((f) => f.figura_id === campana.figura_propia_id) ?? null;

  // Al cambiar de pestaña, las pestañas quedan a la vista (como en la demo).
  const previa = useRef(seccion);
  useEffect(() => {
    if (previa.current === seccion) return;
    previa.current = seccion;
    const el = tabsRef.current;
    if (!el) return;
    const y = el.getBoundingClientRect().top;
    if (y < 0 || y > window.innerHeight * 0.4) el.scrollIntoView({ block: 'start' });
  }, [seccion]);

  const ctx: Ctx = { campana, base, hoy, figuras: figuras.datos, propia, puedeEditar };
  const subtitulo = [
    campana.contienda,
    propia ? `figura propia: ${propia.nombre}${propia.partido ? ` (${propia.partido})` : ''}` : 'sin figura propia',
    campana.periodo_inicio ? rango(campana.periodo_inicio, campana.periodo_fin) : null,
  ].filter(Boolean).join(' · ');

  return (
    <Carga estados={[figuras]}>
      <main className="page pg-campanacompacta">
        <div className="ph">
          <div>
            <h1>{campana.nombre}</h1>
            <p className="mu">{subtitulo}</p>
          </div>
          {puedeEditar ? (
            <div className="acts">
              <Link className="btn bg" to={`${base}/figuras/nueva`}><Icono n="mas" g={2} />Agregar figura</Link>
              <Link className="btn bp" to={`${base}/eventos/nuevo`}><Icono n="mas" g={2} />Crear evento</Link>
            </div>
          ) : null}
        </div>

        <div className="tabs" role="tablist" aria-label="Secciones de la campaña" ref={tabsRef}>
          {PESTANAS.map((p) => {
            const on = p.id === actual.id;
            return (
              <Link key={p.id} className="tab" role="tab" aria-selected={on} aria-current={on ? 'page' : undefined}
                to={`${base}${p.ruta}`}>
                {p.texto}
              </Link>
            );
          })}
        </div>

        {actual.id === 'resumen' ? <SecResumen c={ctx} />
          : actual.id === 'figuras' ? <SecFiguras c={ctx} />
          : actual.id === 'eventos' ? <SecEventos c={ctx} />
          : actual.id === 'menciones' ? <SecMenciones c={ctx} />
          : actual.id === 'temas' ? <SecTemas c={ctx} />
          : <SecAlertas c={ctx} />}
      </main>
    </Carga>
  );
}
