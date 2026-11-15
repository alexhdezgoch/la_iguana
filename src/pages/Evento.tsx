// Ficha de un evento: cabecera con estado, y pestañas Ficha / Participantes / Resultados.
// Cualquier evento, en cualquier estado: lo que todavía no se midió se dice, no se inventa.
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { hoyDe, useCampana, usePagina, useRol } from '../shell/Campana';
import { useAcciones } from '../shell/Acciones';
import { Carga, Vacio } from '../shell/Estados';
import { Icono } from '../shell/Iconos';
import { useFila, useTabla } from '../lib/hooks';
import { db } from '../lib/db';
import { ESTADO_EVENTO, diasEntre, fecha, rango } from '../lib/formato';
import type { Evento as EventoFila, EventoMensaje, EventoParticipante, FiguraCampana, Narrativa } from '../lib/tipos';
import { Ficha } from './evento/Ficha';
import { Participantes } from './evento/Participantes';
import { Resultados } from './evento/Resultados';
import { SIGUIENTE, TABS, diaDe, errorTexto, midiendo, notaPara, origenTexto, ventanaTexto, type Tab } from './evento/util';
import './Evento.css';

export default function Evento() {
  const { eventoId } = useParams();
  const campana = useCampana();
  const cid = campana.id;
  const hoy = hoyDe(campana);
  const base = `/c/${cid}`;
  const { puedeEditar } = useRol();
  const { aviso, abrirDescarga } = useAcciones();
  const [params, setParams] = useSearchParams();
  const [guardando, setGuardando] = useState(false);

  const ev = useFila<EventoFila>('eventos', eventoId);
  const evento = ev.datos && ev.datos.campana_id === cid ? ev.datos : null;
  usePagina(evento?.nombre ?? 'Evento', [{ texto: 'Eventos', a: `${base}/eventos` }]);

  const activo = !!evento;
  const participantes = useTabla<EventoParticipante>('evento_participantes', { eq: { campana_id: cid, evento_id: eventoId ?? '' }, orden: [['orden', 'asc'], ['menciones', 'desc']] }, activo);
  const mensajes = useTabla<EventoMensaje>('evento_mensajes', { eq: { campana_id: cid, evento_id: eventoId ?? '' }, orden: 'orden' }, activo);
  const figuras = useTabla<FiguraCampana>('v_figuras_campana', { eq: { campana_id: cid }, orden: 'orden' }, activo);
  const narrativas = useTabla<Narrativa>('narrativas', { eq: { campana_id: cid }, orden: 'orden' }, activo);

  if (ev.cargando || ev.error) return <Carga estados={[ev]}>{null}</Carga>;
  if (!evento) {
    return (
      <main className="page pg-evento">
        <Vacio titulo="No encontramos este evento">
          Puede que se haya borrado o que sea de otra campaña. <Link to={`${base}/eventos`}>Volver a Eventos</Link>
        </Vacio>
      </main>
    );
  }

  const conResultados = midiendo(evento.estado) || evento.menciones != null;
  const pedida = params.get('tab') as Tab | null;
  const tab: Tab = pedida && TABS.some(([k]) => k === pedida) ? pedida : conResultados ? 'resultados' : 'ficha';
  const elegir = (t: Tab) => setParams((p) => { const n = new URLSearchParams(p); n.set('tab', t); return n; }, { replace: true });

  // Subtítulo: fecha, sede, ventana. Y lo que depende del estado: en N días, día X de Y.
  const varios = evento.fecha_fin && evento.fecha_inicio && evento.fecha_fin !== evento.fecha_inicio;
  const cuandoTxt = evento.fecha_inicio
    ? (varios ? rango(evento.fecha_inicio, evento.fecha_fin) + ' de ' + evento.fecha_inicio.slice(0, 4) : fecha(evento.fecha_inicio, 'completo'))
    : 'Sin fecha';
  const lugar = [evento.sede, evento.ciudad].filter(Boolean).join(', ');
  const sub = [cuandoTxt, lugar, `ventana de ${ventanaTexto(evento)}`].filter(Boolean).join(' · ');
  const dia = evento.estado === 'En curso' ? diaDe(evento, hoy) : null;
  const faltan = evento.fecha_inicio ? diasEntre(hoy, evento.fecha_inicio) : null;
  let marca: string | null = null;
  if (evento.estado === 'En curso') marca = dia ? `Día ${dia.dia} de ${dia.dias}` : null;
  else if ((evento.estado === 'Programado' || evento.estado === 'Borrador') && faltan != null) {
    marca = faltan > 1 ? `En ${faltan} días` : faltan === 1 ? 'Mañana' : faltan === 0 ? 'Hoy' : `Fecha pasada hace ${-faltan} ${faltan === -1 ? 'día' : 'días'}`;
  }

  // Un evento programado se marca en curso a partir de su fecha, no antes.
  const siguiente = evento.estado === 'Programado' && faltan != null && faltan > 0 ? null : SIGUIENTE[evento.estado];
  async function cambiarEstado(nuevo: EventoFila['estado']) {
    if (!evento) return;
    if (nuevo === 'Programado' && !evento.fecha_inicio) { aviso('Falta la fecha del evento para programarlo.'); return; }
    setGuardando(true);
    try {
      await db.cambiar<EventoFila>('eventos', evento.id, { estado: nuevo, nota_estado: notaPara(nuevo, evento.nota_estado) });
      aviso(`Evento en estado ${nuevo}`);
    } catch (e) {
      aviso(errorTexto(e));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Carga estados={[participantes, mensajes, figuras, narrativas]}>
      <main className="page pg-evento">
        <div className="ph">
          <div>
            <div className="ev-meta">
              <span className={ESTADO_EVENTO[evento.estado] ?? 'chip watch'}>{evento.estado}</span>
              {evento.es_crisis ? <span className="chip unf">Crisis</span> : null}
              <span className="mu">{evento.tipo} · {origenTexto(evento.origen)}</span>
              {marca ? <span className="sm b">{marca}</span> : null}
              {evento.nota_estado && evento.estado !== 'En curso' ? <span className="mu">· {evento.nota_estado}</span> : null}
            </div>
            <h1>{evento.nombre}</h1>
            <p className="mu">{sub}</p>
          </div>
          <div className="acts">
            {puedeEditar && siguiente ? (
              <button type="button" className="btn bg" disabled={guardando} onClick={() => cambiarEstado(siguiente[0])}>{siguiente[1]}</button>
            ) : null}
            {conResultados ? (
              <button type="button" className="btn bg" onClick={() => abrirDescarga('Post-evento')}><Icono d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />Descargar reporte</button>
            ) : null}
          </div>
        </div>

        {evento.estado === 'Cancelado' ? (
          <div className="well sm">Este evento está cancelado. No se mide. {puedeEditar ? 'Puedes reprogramarlo desde el botón de arriba.' : ''}</div>
        ) : null}

        <div className="tabs" role="tablist" aria-label="Secciones del evento">
          {TABS.map(([k, t]) => (
            <button key={k} type="button" className="tab" role="tab" aria-selected={tab === k} onClick={() => elegir(k)}>{t}</button>
          ))}
        </div>

        {tab === 'ficha' ? (
          <Ficha evento={evento} mensajes={mensajes.datos} narrativas={narrativas.datos} puedeEditar={puedeEditar} guardando={guardando} cancelar={() => cambiarEstado('Cancelado')} />
        ) : tab === 'participantes' ? (
          <Participantes evento={evento} participantes={participantes.datos} figuras={figuras.datos} puedeEditar={puedeEditar} />
        ) : (
          <Resultados evento={evento} participantes={participantes.datos} mensajes={mensajes.datos} figuras={figuras.datos} narrativas={narrativas.datos} puedeEditar={puedeEditar} hoy={hoy} />
        )}
      </main>
    </Carga>
  );
}
