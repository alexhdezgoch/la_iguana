// Pestaña "Reglas de alerta": tabla de `reglas_alerta` con activar/pausar, edición y constructor.
// ?regla=nueva abre el constructor vacío; ?regla=<id> lo abre con esa regla.
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db } from '../../lib/db';
import type { Campana, FiguraCampana, Persona, ReglaAlerta, Tema } from '../../lib/tipos';
import { useAcciones } from '../../shell/Acciones';
import { Vacio } from '../../shell/Estados';
import { momento, plural } from './comun';
import { Constructor } from './Constructor';

export function Reglas({ reglas, campana, temas, figuras, personas, internos, yo, puedeEditar }: {
  reglas: ReglaAlerta[]; campana: Campana; temas: Tema[]; figuras: FiguraCampana[];
  personas: Map<string, Persona>; internos: Persona[]; yo: Persona | null; puedeEditar: boolean;
}) {
  const { aviso } = useAcciones();
  const [params, setParams] = useSearchParams();
  const [creada, setCreada] = useState<string | null>(null);
  const [cambiando, setCambiando] = useState<string | null>(null);
  const abierta = puedeEditar ? params.get('regla') : null;
  const editando = abierta && abierta !== 'nueva' ? reglas.find((r) => r.id === abierta) ?? null : null;
  const construyendo = abierta === 'nueva' || !!editando;

  const abrir = (id: string | null) => {
    const n = new URLSearchParams(params);
    if (id) n.set('regla', id); else n.delete('regla');
    setParams(n, { replace: true });
  };

  async function alternar(r: ReglaAlerta) {
    setCambiando(r.id);
    try {
      await db.cambiar<ReglaAlerta>('reglas_alerta', r.id, { activa: !r.activa });
      aviso(r.activa ? `Regla "${r.nombre}" pausada` : `Regla "${r.nombre}" activa`);
    } catch (e) { aviso(e instanceof Error ? e.message : String(e)); } finally { setCambiando(null); }
  }

  const ordenNuevo = reglas.length ? Math.min(...reglas.map((r) => r.orden)) - 1 : 1;

  return (
    <>
      <div className="well sm" role="note">
        <span className="b">Las reglas todavía no vigilan.</span> Puedes crearlas, editarlas, activarlas o pausarlas, y quedan guardadas.
        La detección automática y el envío de avisos llegan con la ingesta: hasta entonces ninguna regla dispara alertas nuevas.
        Los disparos de la tabla son los que ya están registrados.
      </div>

      {creada ? (
        <div className="well fade" role="status" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 12px', alignItems: 'center', background: '#E7F0E8' }}>
          <span className="b">Regla guardada y activa.</span>
          <span className="sm">"{creada}" queda lista; empezará a disparar alertas cuando se conecte la ingesta.</span>
          <button type="button" className="btn bg sp" onClick={() => setCreada(null)}>Entendido</button>
        </div>
      ) : null}

      {construyendo ? (
        <Constructor key={abierta ?? ''} regla={editando} campana={campana} temas={temas} figuras={figuras} personas={internos} yo={yo} ordenNuevo={ordenNuevo}
          alTerminar={(nombre) => { abrir(null); if (nombre) setCreada(nombre); }} />
      ) : null}

      {reglas.length ? (
        <section className="tw" aria-label="Reglas de alerta">
          <div>
            <table style={{ minWidth: 980 }}>
              <thead><tr><th>Regla</th><th>Umbral</th><th>Alcance</th><th>Entrega</th><th>Destinatarios</th><th>Disparos 30 d</th><th>Estado</th></tr></thead>
              <tbody>
                {reglas.map((r) => {
                  const nombres = (r.destinatarios ?? []).map((d) => personas.get(d.persona_id)?.nombre).filter(Boolean).join(', ');
                  const n = (r.destinatarios ?? []).length;
                  return (
                    <tr key={r.id}>
                      <td style={{ minWidth: 230 }}>
                        <div className="gr">
                          {puedeEditar
                            ? <button type="button" className="enlace-btn tl al-nombre" onClick={() => abrir(r.id)} aria-label={`Editar la regla ${r.nombre}`}>{r.nombre}</button>
                            : <span className="b">{r.nombre}</span>}
                          <span className="mu">{r.tipo ?? 'Sin disparador'} · severidad {r.severidad.toLowerCase()}</span>
                        </div>
                      </td>
                      <td className="sm">{r.condicion?.texto ?? 'Sin umbral'}</td>
                      <td className="sm">{r.condicion?.alcance_texto ?? 'Todas las figuras'}</td>
                      <td><span className="mm" style={{ gap: 4, minWidth: 150 }}>{(r.canales ?? []).map((c) => <span key={c} className="chip">{c}</span>)}</span></td>
                      <td className="sm" title={nombres || undefined}>{n ? plural(n, 'persona', 'personas') : 'Nadie'}</td>
                      <td>
                        <div className="gr">
                          <span className="b">{r.disparos_30d}</span>
                          <span className="mu" style={{ whiteSpace: 'nowrap' }}>{r.ultimo_disparo ? `Último: ${momento(r.ultimo_disparo, campana)}` : 'Sin disparos todavía'}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <button type="button" className="swt" role="switch" aria-checked={r.activa} aria-label={`${r.activa ? 'Pausar' : 'Activar'} la regla ${r.nombre}`}
                            disabled={!puedeEditar || cambiando === r.id} onClick={() => alternar(r)}><i /></button>
                          <span className={r.activa ? 'chip live' : 'chip watch'}>{r.activa ? 'Activa' : 'Pausada'}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : !construyendo ? (
        <Vacio titulo="Esta campaña todavía no tiene reglas de alerta">
          {puedeEditar ? <button type="button" className="enlace-btn" onClick={() => abrir('nueva')}>Crear la primera regla</button> : 'Quien administra la campaña puede crearlas.'}
        </Vacio>
      ) : null}

      <p className="mu note">
        Cada regla guarda su horario silencioso (23:00 a 6:00 para severidad media y baja; las alertas altas avisarían siempre). {puedeEditar ? 'Toca el nombre de una regla para editarla. ' : ''}
        Las alertas nunca asignan valor en dinero a la cobertura en medios.
      </p>
    </>
  );
}
