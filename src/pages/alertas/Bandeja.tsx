// Bandeja: conteo por estado (filtra), severidad, "Asignadas a mí", lista y detalle.
// Filtro, severidad y alerta abierta viven en la URL: ?filtro=&sev=&mias=1&alerta=<id>.
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SEVERIDAD } from '../../lib/formato';
import type { Alerta, Campana, Persona } from '../../lib/tipos';
import { CLASE_ESTADO, CLASE_REL, CUMPLE, FILTROS, inicialesDe, momento, ordenarAlertas, plural, vencida, type Filtro } from './comun';
import { Detalle, type Contexto } from './Detalle';

const SEVS = ['Todas', 'Alta', 'Media', 'Baja'];

export function Bandeja({ alertas, campana, cx, responsables, yo, puedeEditar, esCliente }: {
  alertas: Alerta[]; campana: Campana; cx: Contexto; responsables: Persona[]; yo: Persona | null; puedeEditar: boolean; esCliente: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const filtro = (FILTROS as string[]).includes(params.get('filtro') ?? '') ? (params.get('filtro') as Filtro) : 'Abiertas';
  const sev = SEVS.includes(params.get('sev') ?? '') ? params.get('sev')! : 'Todas';
  const mias = params.get('mias') === '1' && !!yo && puedeEditar;
  const elegida = params.get('alerta');
  // La alerta recién cambiada sigue a la vista aunque ya no cumpla el filtro, hasta que cambie el filtro.
  const [fija, setFija] = useState<string | null>(null);

  const cambiar = (p: Record<string, string | null>, conservarAlerta = false) => {
    const n = new URLSearchParams(params);
    for (const [k, v] of Object.entries(p)) if (v == null) n.delete(k); else n.set(k, v);
    if (!conservarAlerta && !('alerta' in p)) n.delete('alerta');
    setParams(n, { replace: true });
    setFija(null);
  };

  const ordenadas = ordenarAlertas(alertas);
  const cuenta = (f: (a: Alerta) => boolean) => alertas.filter(f).length;
  const nRes = cuenta((a) => a.estado === 'Resuelta'), nDes = cuenta((a) => a.estado === 'Descartada');
  const nVencidas = cuenta((a) => vencida(a, campana));
  const SUB: Record<Filtro, string> = {
    Abiertas: 'Piden una decisión', Nuevas: 'Nadie las ha tomado', 'En revisión': 'Con responsable',
    Pospuestas: nVencidas ? plural(nVencidas, 'con plazo vencido', 'con plazo vencido') : 'Con fecha para retomarlas',
    Cerradas: `${plural(nRes, 'resuelta', 'resueltas')} · ${plural(nDes, 'descartada', 'descartadas')}`,
  };
  const nMias = yo ? cuenta((a) => CUMPLE[filtro](a) && a.responsable_id === yo.id) : 0;

  const visible = (a: Alerta) => CUMPLE[filtro](a) && (sev === 'Todas' || a.severidad === sev) && (!mias || a.responsable_id === yo?.id);
  // La alerta del enlace (?alerta=) y la recién cambiada se muestran aunque el filtro no las incluya.
  const items = ordenadas.filter((a) => visible(a) || a.id === fija || a.id === elegida);
  const sel = items.find((a) => a.id === elegida) ?? items[0] ?? null;

  return (
    <>
      <section className="kpis" aria-label="Alertas por estado">
        {FILTROS.map((f) => (
          <button key={f} type="button" className="kpi kb" aria-pressed={f === filtro} onClick={() => cambiar({ filtro: f === 'Abiertas' ? null : f })}>
            <span className="kl">{f}</span>
            <span className="kv s">{cuenta(CUMPLE[f])}</span>
            <span className="mu">{SUB[f]}</span>
          </button>
        ))}
      </section>

      <div className="al-filtros">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <div className="seg" role="group" aria-label="Filtrar por severidad">
            {SEVS.map((s) => <button key={s} type="button" className="pill" aria-pressed={s === sev} onClick={() => cambiar({ sev: s === 'Todas' ? null : s })}>{s}</button>)}
          </div>
          {yo && puedeEditar ? (
            <button type="button" className="btn bg" aria-pressed={mias} onClick={() => cambiar({ mias: mias ? null : '1' })}>Asignadas a mí · {nMias}</button>
          ) : null}
        </div>
        <span className="mu">{plural(items.length, 'alerta.', 'alertas.')} Ordenadas por severidad y luego por hora.</span>
      </div>

      <div className="row">
        <section className="tw c2" aria-label="Lista de alertas">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {items.map((a) => {
              const fig = a.figura_id ? cx.figuras.get(a.figura_id) : undefined;
              const tema = !fig && a.tema_id ? cx.temas.get(a.tema_id) : undefined;
              const resp = a.responsable_id ? cx.personas.get(a.responsable_id) : undefined;
              return (
                <button key={a.id} type="button" className="mi" aria-pressed={sel?.id === a.id} onClick={() => { cambiar({ alerta: a.id }, true); setFija(fija); }}>
                  <span className="mm">
                    <span className={SEVERIDAD[a.severidad]}>{a.severidad}</span>
                    <span className="mu">{[a.tipo, momento(a.detectada_en, campana)].filter(Boolean).join(' · ')}</span>
                    <span className={CLASE_ESTADO[a.estado]} style={{ marginLeft: 'auto' }}>{a.estado}{vencida(a, campana) ? ' · vencida' : ''}</span>
                  </span>
                  <span className={a.estado === 'Nueva' ? 'b' : ''} style={{ fontSize: 15, lineHeight: '21px' }}>{a.texto}</span>
                  <span className="mm">
                    {fig ? <><span className="sm">{fig.nombre}</span><span className={CLASE_REL[fig.relacion] ?? 'chip'}>{fig.relacion}</span></> : <span className="sm">{tema ? `Tema: ${tema.nombre}` : 'Sin figura'}</span>}
                    <span className="mu" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span className="av sa" aria-hidden="true">{a.responsable_id ? inicialesDe(resp) : '–'}</span>
                      {a.responsable_id ? (resp?.nombre ?? 'Equipo') : 'Sin asignar'}
                    </span>
                  </span>
                </button>
              );
            })}
            {!items.length ? <div style={{ padding: '40px 20px', textAlign: 'center' }} className="mu">No hay alertas en esta vista.</div> : null}
            <div className="mu" style={{ padding: '12px 16px', background: '#F1F3EF' }}>Los disparos repetidos de la misma regla y figura en 24 horas se agrupan en una sola alerta.</div>
          </div>
        </section>

        {sel ? (
          <Detalle key={sel.id} alerta={sel} campana={campana} cx={cx} responsables={responsables} yo={yo} puedeEditar={puedeEditar} esCliente={esCliente}
            alCambiar={(id) => { if (elegida !== id) cambiar({ alerta: id }, true); setFija(id); }} />
        ) : (
          <aside className="card c3" aria-label="Detalle de la alerta" style={{ alignItems: 'center', textAlign: 'center', padding: '48px 20px', gap: 6 }}>
            <h2>Nada por atender</h2>
            <p className="mu">No quedan alertas en esta vista. Cambia el filtro para ver otras.</p>
          </aside>
        )}
      </div>
    </>
  );
}
