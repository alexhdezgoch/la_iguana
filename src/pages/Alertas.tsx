// Alertas de una campaña: bandeja (estado, responsable, posponer, cerrar, notas, actividad) y reglas de alerta.
// Lee alertas, alerta_actividad, reglas_alerta, notas_internas, personas, miembros_campana y el contexto (figuras, narrativas, temas, eventos).
// Escribe alertas + alerta_actividad (cada cambio de estado), notas_internas y reglas_alerta. Pestaña en ?tab=reglas.
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { hoyDe, useCampana, usePagina, useRol } from '../shell/Campana';
import { useSesion } from '../shell/Sesion';
import { Carga, Vacio } from '../shell/Estados';
import { Icono } from '../shell/Iconos';
import { useNombres, useTabla } from '../lib/hooks';
import { fecha } from '../lib/formato';
import type { Alerta, Evento, FiguraCampana, MiembroCampana, Narrativa, Persona, PersonaVisible, ReglaAlerta, Tema } from '../lib/tipos';
import { Bandeja } from './alertas/Bandeja';
import { Reglas } from './alertas/Reglas';
import { CUMPLE, plural } from './alertas/comun';
import type { Contexto } from './alertas/Detalle';
import './Alertas.css';

function porId<T extends { id: string }>(l: T[]): Map<string, T> { return new Map(l.map((x) => [x.id, x])); }
/** Persona mínima a partir de su nombre visible, para quien no puede leer la tabla personas. */
function personaVisible(v: PersonaVisible, org: string): Persona {
  return { id: v.id, org_id: org, nombre: v.nombre_corto, nombre_corto: v.nombre_corto, iniciales: v.iniciales, email: null, puesto: null, rol_org: 'miembro', activa: true, extra: {} };
}

export default function Alertas() {
  usePagina('Alertas');
  const campana = useCampana();
  const cid = campana.id;
  const hoy = hoyDe(campana);
  const { puedeEditar, esCliente } = useRol();
  const { persona: yo } = useSesion();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'reglas' ? 'reglas' : 'bandeja';

  const alertas = useTabla<Alerta>('alertas', { eq: { campana_id: cid }, orden: 'orden' });
  const reglas = useTabla<ReglaAlerta>('reglas_alerta', { eq: { campana_id: cid }, orden: [['orden', 'asc'], ['nombre', 'asc']] });
  const figuras = useTabla<FiguraCampana>('v_figuras_campana', { eq: { campana_id: cid }, orden: 'orden' });
  const narrativas = useTabla<Narrativa>('narrativas', { eq: { campana_id: cid } });
  const temas = useTabla<Tema>('temas', { eq: { campana_id: cid }, orden: 'orden' });
  const eventos = useTabla<Evento>('eventos', { eq: { campana_id: cid } });
  const personas = useTabla<Persona>('personas', { eq: { org_id: campana.org_id }, orden: 'nombre' });
  const miembros = useTabla<MiembroCampana>('miembros_campana', { eq: { campana_id: cid } });
  // El rol Cliente no lee personas: sus nombres salen de v_personas_campana (nombre corto e iniciales).
  const { nombres } = useNombres();

  const cx = useMemo<Contexto>(() => ({
    figuras: new Map(figuras.datos.map((f) => [f.figura_id, f])),
    narrativas: porId(narrativas.datos), temas: porId(temas.datos), eventos: porId(eventos.datos), reglas: porId(reglas.datos),
    personas: new Map([
      ...[...nombres.values()].map((v) => personaVisible(v, campana.org_id)),
      ...personas.datos, ...(yo ? [yo] : []),
    ].map((p) => [p.id, p])),
  }), [figuras.datos, narrativas.datos, temas.datos, eventos.datos, reglas.datos, personas.datos, nombres, yo, campana.org_id]);

  // Responsables posibles: quien puede editar la campaña, y yo. Destinatarios de reglas: el equipo interno, y yo.
  const conYo = (ids: string[]) => {
    const l = ids.map((id) => cx.personas.get(id)).filter((p): p is Persona => !!p);
    if (yo && !l.some((p) => p.id === yo.id)) l.unshift(yo);
    return l;
  };
  const responsables = conYo(miembros.datos.filter((m) => m.rol === 'Administración' || m.rol === 'Análisis').map((m) => m.persona_id));
  const internos = conYo(miembros.datos.filter((m) => m.rol !== 'Cliente').map((m) => m.persona_id));

  const abiertas = alertas.datos.filter(CUMPLE.Abiertas).length;
  const activas = reglas.datos.filter((r) => r.activa).length;

  const irA = (t: 'bandeja' | 'reglas', extra: Record<string, string> = {}) => {
    const n = new URLSearchParams();
    if (t === 'reglas') n.set('tab', 'reglas');
    for (const [k, v] of Object.entries(extra)) n.set(k, v);
    setParams(n, { replace: true });
  };

  return (
    <Carga estados={[alertas, reglas, figuras, temas]}>
      <main className="page pg-alertas">
        <div className="ph">
          <div>
            <h1>Alertas</h1>
            <p className="mu">Campaña {campana.contienda ?? campana.nombre} · hoy {fecha(hoy, 'dia')} · {plural(abiertas, 'abierta', 'abiertas')}</p>
          </div>
          {puedeEditar ? (
            <div className="acts">
              <button type="button" className="btn bp" onClick={() => irA('reglas', { regla: 'nueva' })}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                Nueva regla
              </button>
            </div>
          ) : null}
        </div>

        <div className="tabs" role="tablist" aria-label="Secciones de alertas">
          <button type="button" className="tab" role="tab" aria-selected={tab === 'bandeja'} onClick={() => irA('bandeja')}>Bandeja · {abiertas}</button>
          <button type="button" className="tab" role="tab" aria-selected={tab === 'reglas'} onClick={() => irA('reglas')}>Reglas de alerta · {plural(activas, 'activa', 'activas')}</button>
        </div>

        {tab === 'bandeja' ? (
          alertas.datos.length ? (
            <Bandeja alertas={alertas.datos} campana={campana} cx={cx} responsables={responsables} yo={yo} puedeEditar={puedeEditar} esCliente={esCliente} />
          ) : (
            <Vacio titulo="Todavía no hay alertas en esta campaña"
              accion={puedeEditar ? <button type="button" className="btn bg" onClick={() => irA('reglas', { regla: 'nueva' })}><Icono n="mas" g={2} />Crear regla</button> : null}>
              Las alertas aparecen cuando una regla detecta un cambio; la detección automática llega con la ingesta.
            </Vacio>
          )
        ) : (
          <Reglas reglas={reglas.datos} campana={campana} temas={temas.datos} figuras={figuras.datos} personas={cx.personas} internos={internos} yo={yo} puedeEditar={puedeEditar} />
        )}
      </main>
    </Carga>
  );
}
