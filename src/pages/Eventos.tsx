// Eventos de una campaña, agrupados por estado (Activos, Por venir, Cerrados).
// Lee `eventos` y la figura propia de `v_figuras_campana`. No escribe: el filtro vive en la URL (?estado=).
import { Link, useSearchParams } from 'react-router-dom';
import { hoyDe, useCampana, usePagina, useRol } from '../shell/Campana';
import { Carga, Vacio } from '../shell/Estados';
import { Icono } from '../shell/Iconos';
import { useTabla } from '../lib/hooks';
import { ESTADO_EVENTO, aFecha, compacto, diasEntre, fecha, neto, num, rango } from '../lib/formato';
import type { Evento, EstadoEvento, FiguraCampana } from '../lib/tipos';
import './Eventos.css';

type Grupo = 'Activos' | 'Por venir' | 'Cerrados';
const GRUPOS: Grupo[] = ['Activos', 'Por venir', 'Cerrados'];
const GRUPO: Record<EstadoEvento, Grupo> = {
  'En curso': 'Activos', 'En análisis': 'Activos', Programado: 'Por venir', Borrador: 'Por venir', Cerrado: 'Cerrados', Cancelado: 'Cerrados',
};
/** Valor de ?estado= en la URL. */
const CLAVE: Record<Grupo, string> = { Activos: 'activos', 'Por venir': 'por-venir', Cerrados: 'cerrados' };
const ORIGEN: Record<string, [string, string]> = { Propio: ['propio', 'propios'], 'De rival': ['de rival', 'de rivales'], Institucional: ['institucional', 'institucionales'] };

/** Alcance como en la demo: 800,000 → "0.8 M"; por debajo de 100 mil, el formato compacto. */
function alcance(n: number | null): string {
  if (n == null) return 'Sin datos';
  return n >= 100_000 ? (n / 1_000_000).toFixed(1) + ' M' : compacto(n);
}

function dias(n: number) { return `${n} ${n === 1 ? 'día' : 'días'}`; }

/** Texto bajo el estado: la nota guardada o, si no hay, lo que se deriva de las fechas. */
function notaEstado(e: Evento, hoy: string): string {
  if (e.nota_estado) return e.nota_estado;
  if (e.estado === 'En curso' && e.fecha_inicio) {
    const total = (diasEntre(e.fecha_inicio, e.fecha_fin ?? e.fecha_inicio) ?? 0) + 1;
    const dia = (diasEntre(e.fecha_inicio, hoy) ?? 0) + 1;
    return total > 1 && dia >= 1 && dia <= total ? `Día ${dia} de ${total}` : '';
  }
  if ((e.estado === 'Programado' || e.estado === 'Borrador') && e.fecha_inicio) {
    const d = diasEntre(hoy, e.fecha_inicio) ?? 0;
    if (d === 0) return 'Hoy';
    if (d === 1) return 'Mañana';
    return d > 0 ? `En ${dias(d)}` : `La fecha pasó hace ${dias(-d)}`;
  }
  return '';
}

/** "Segundo debate presidencial y Cierre de campaña" · "A, B y 3 más". */
function nombres(lista: Evento[]): string {
  if (!lista.length) return 'Ninguno por ahora';
  if (lista.length <= 2) return lista.map((e) => e.nombre).join(' y ');
  return `${lista[0].nombre}, ${lista[1].nombre} y ${lista.length - 2} más`;
}

function porOrigen(lista: Evento[]): string {
  const cuenta = new Map<string, number>();
  lista.forEach((e) => cuenta.set(e.origen, (cuenta.get(e.origen) ?? 0) + 1));
  return [...cuenta.entries()].map(([o, n]) => `${n} ${(ORIGEN[o] ?? [o.toLowerCase(), o.toLowerCase()])[n === 1 ? 0 : 1]}`).join(' · ');
}

/** Activos y por venir, del más cercano al más lejano; cerrados, del más reciente al más antiguo. Sin fecha, al final. */
function ordenar(lista: Evento[]): Evento[] {
  const t = (e: Evento) => aFecha(e.fecha_inicio)?.getTime();
  return [...lista].sort((a, b) => {
    const ga = GRUPOS.indexOf(GRUPO[a.estado]), gb = GRUPOS.indexOf(GRUPO[b.estado]);
    if (ga !== gb) return ga - gb;
    const ta = t(a), tb = t(b);
    if (ta == null || tb == null) return ta == null ? (tb == null ? 0 : 1) : -1;
    return GRUPO[a.estado] === 'Cerrados' ? tb - ta : ta - tb;
  });
}

export default function Eventos() {
  usePagina('Eventos');
  const campana = useCampana();
  const cid = campana.id;
  const hoy = hoyDe(campana);
  const base = `/c/${cid}`;
  const { puedeEditar } = useRol();
  const [params, setParams] = useSearchParams();
  const sel = GRUPOS.find((g) => CLAVE[g] === params.get('estado')) ?? null;

  const eventos = useTabla<Evento>('eventos', { eq: { campana_id: cid }, orden: 'fecha_inicio' });
  const propiaId = campana.figura_propia_id;
  const propia = useTabla<FiguraCampana>('v_figuras_campana', { eq: { campana_id: cid, figura_id: propiaId ?? '' }, limite: 1 }, !!propiaId);
  const nombrePropia = propia.datos[0]?.nombre ?? null;
  // Encabezado corto como en la demo ("Neto de Machado"): último nombre, con el completo en el title.
  const cortoPropia = nombrePropia ? nombrePropia.trim().split(/\s+/).pop() : null;

  const todos = ordenar(eventos.datos);
  const de = (g: Grupo) => todos.filter((e) => GRUPO[e.estado] === g);
  const filas = sel ? de(sel) : todos;
  const ventanas = new Set(todos.map((e) => e.ventana_horas));
  const ventana = ventanas.size === 1 ? `${[...ventanas][0]} horas antes y después` : 'antes, durante y después';

  const elegir = (g: Grupo | null) => {
    const p = new URLSearchParams(params);
    if (g) p.set('estado', CLAVE[g]); else p.delete('estado');
    setParams(p, { replace: true });
  };

  return (
    <Carga estados={[eventos, propia]}>
      <main className="page pg-eventos">
        <div className="ph">
          <div>
            <h1>Eventos</h1>
            <p className="mu">Momentos de campaña medidos {ventana} · hoy es {fecha(hoy, 'completo').replace(/^./, (c) => c.toLowerCase())}</p>
          </div>
          {puedeEditar ? <Link className="btn bp" to={`${base}/eventos/nuevo`}><Icono n="mas" g={2} />Crear evento</Link> : null}
        </div>

        {todos.length ? (
          <>
            <section className="kpis" aria-label="Totales">
              <div className="kpi">
                <span className="kl">Eventos</span>
                <span className="kv">{num(todos.length)}</span>
                <span className="mu">{porOrigen(todos)}</span>
              </div>
              {GRUPOS.map((g) => (
                <div className="kpi" key={g}>
                  <span className="kl">{g}</span>
                  <span className="kv">{num(de(g).length)}</span>
                  <span className="mu ev-sub" title={nombres(de(g))}>{nombres(de(g))}</span>
                </div>
              ))}
            </section>

            <div className="ev-filtros">
              <div className="seg" role="group" aria-label="Filtrar por estado">
                {([null, ...GRUPOS] as Array<Grupo | null>).map((g) => (
                  <button key={g ?? 'todos'} type="button" className="pill" aria-pressed={sel === g} onClick={() => elegir(g)}>{g ?? 'Todos'}</button>
                ))}
              </div>
              <span className="mu">{filas.length} de {todos.length} eventos</span>
            </div>

            {filas.length ? (
              <div className="tw"><div>
                <table style={{ minWidth: 980 }}>
                  <thead>
                    <tr>
                      <th scope="col" style={{ width: '36%' }}>Evento</th>
                      <th scope="col">Tipo y origen</th>
                      <th scope="col">Estado</th>
                      <th scope="col" className="r">Menciones</th>
                      <th scope="col" className="r">Alcance</th>
                      <th scope="col" className="r" title={nombrePropia ? `Sentimiento neto de ${nombrePropia}` : undefined}>{cortoPropia ? `Neto de ${cortoPropia}` : 'Sentimiento neto'}</th>
                      <th scope="col" className="r">Notas en medios</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((e) => <Fila key={e.id} e={e} hoy={hoy} base={base} />)}
                  </tbody>
                </table>
              </div></div>
            ) : (
              <Vacio titulo={`Sin eventos ${sel === 'Activos' ? 'activos' : sel === 'Por venir' ? 'por venir' : 'cerrados'}`}>
                <button type="button" className="lk" style={{ background: 'none', border: 0, padding: 0, font: 'inherit', cursor: 'pointer' }} onClick={() => elegir(null)}>Ver todos los eventos</button>
              </Vacio>
            )}

            <p className="mu note">El estado lo decide el equipo y no se deduce de las fechas. Un evento sin medición muestra "Sin datos", nunca cero.</p>
          </>
        ) : (
          <Vacio titulo="Esta campaña todavía no tiene eventos">
            {puedeEditar
              ? <><Link to={`${base}/eventos/nuevo`}>Crear un evento</Link> para medir la conversación antes, durante y después.</>
              : 'Cuando el equipo cree eventos, aparecerán aquí con su medición.'}
          </Vacio>
        )}
      </main>
    </Carga>
  );
}

function Fila({ e, hoy, base }: { e: Evento; hoy: string; base: string }) {
  const d = aFecha(e.fecha_inicio);
  const lugar = [e.sede, e.ciudad].filter(Boolean).join(', ') || (e.extra?.estado_region as string | undefined) || '';
  const tipo = e.es_crisis && e.tipo !== 'Crisis' ? `${e.tipo} · crisis` : e.tipo;
  const nc = (v: number | null) => (v == null ? 'r mu nw' : 'r nw');
  const nota = notaEstado(e, hoy);
  return (
    <tr>
      <td>
        <div className="who">
          <span className="ini ev-fecha" aria-hidden="true">
            {d ? <><span className="ev-mes">{fecha(d, 'corto').split(' ')[1]}</span><span className="ev-dia">{d.getDate()}</span></> : <span className="ev-mes">Sin fecha</span>}
          </span>
          <span className="gr">
            <Link className="tl" to={`${base}/eventos/${e.id}`}>{e.nombre}</Link>
            <span className="mu">{e.fecha_inicio ? rango(e.fecha_inicio, e.fecha_fin) : 'Sin fecha'}{lugar ? ` · ${lugar}` : ''}</span>
          </span>
        </div>
      </td>
      <td>{tipo}<div className="mu">{e.origen}</div></td>
      <td>
        <span className={ESTADO_EVENTO[e.estado] ?? 'chip watch'}>{e.estado}</span>
        {nota ? <div className="mu ev-nota">{nota}</div> : null}
      </td>
      <td className={nc(e.menciones)}>{num(e.menciones)}</td>
      <td className={nc(e.alcance)}>{alcance(e.alcance)}</td>
      <td className="r nw"><span className={e.neto == null ? 'mu' : e.neto >= 0 ? 'b tf' : 'b tu'}>{neto(e.neto)}</span></td>
      <td className={nc(e.notas_medios)}>{num(e.notas_medios)}</td>
    </tr>
  );
}
