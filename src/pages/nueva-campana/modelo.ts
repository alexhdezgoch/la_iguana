// Modelo del asistente de nueva campaña: forma del borrador (borradores.datos), validación por paso
// y armado del parámetro de crear_campana (supabase/migrations/850_funciones.sql).
// Solo catálogos de interfaz y reglas: ningún dato de ejemplo vive aquí.
import { diasEntre, fecha, iniciales } from '../../lib/formato';
import type { Relacion, RolCampana } from '../../lib/tipos';

export interface TerminoB { texto: string; tipo: string }
export interface FiguraNueva { nombre: string; partido?: string; cargo?: string }
export interface FiguraB { figura_id?: string; nueva?: FiguraNueva; clave?: string; relacion: Relacion; terminos: TerminoB[] }
export interface MiembroB { persona_id?: string; nombre?: string; email?: string; nota?: string; rol: RolCampana }
export interface FaseB { nombre: string; inicio: string; fin: string }
export interface DatosB {
  paso: number;
  max?: number;
  campana: { nombre: string; tipo_eleccion: string; pais: string; estado: string; municipio: string; zona_horaria: string; jornada: string };
  fases: FaseB[];
  figuras: FiguraB[];
  confirmo_personas_publicas: boolean;
  terminos: TerminoB[];
  temas: string[];
  equipo: MiembroB[];
}

// ---------- catálogos de la interfaz ----------
export const PASOS = ['Contienda', 'Calendario', 'Figuras', 'Términos y temas', 'Equipo y acceso', 'Revisar'];
export const TIPOS_ELECCION = ['Presidencial', 'Gobernación', 'Alcaldía', 'Legislativa'];
export const AMBITO: Record<string, string> = { Presidencial: 'Presidenciales', Gobernación: 'Regionales', Alcaldía: 'Municipales', Legislativa: 'Legislativas' };
export const PAISES = ['Venezuela', 'Colombia', 'Ecuador'];
export const ZONAS: Array<[string, string]> = [['America/Caracas', 'America/Caracas (UTC−4)'], ['America/Bogota', 'America/Bogota (UTC−5)'], ['America/Guayaquil', 'America/Guayaquil (UTC−5)']];
export const FASES = ['Precampaña', 'Campaña', 'Veda', 'Jornada electoral', 'Post-electoral'];
export const COLOR_FASE: Record<string, string> = {
  Precampaña: '#BFCBBE', Intercampaña: '#D6DDD5', Campaña: '#285A32', Veda: '#C9A227', 'Jornada electoral': '#1B211D', 'Post-electoral': '#A8AFA9',
};
export const ORDEN_REL: Relacion[] = ['Propia', 'Rival', 'Aliada', 'A observar'];
export const ROLES: Array<[RolCampana, string]> = [['Administración', 'Administración'], ['Análisis', 'Análisis'], ['Solo lectura', 'Solo lectura'], ['Cliente', 'Cliente: sin notas internas']];
export const ROL_MIN: Record<RolCampana, string> = { Administración: 'administración', Análisis: 'análisis', 'Solo lectura': 'solo lectura', Cliente: 'cliente' };
export const MAX_TERMINOS = 30;

// ---------- fechas ----------
export function sumarDias(s: string, n: number): string {
  const [a, m, d] = s.split('-').map(Number);
  const x = new Date(Date.UTC(a, m - 1, d + n));
  return x.toISOString().slice(0, 10);
}
/** "5 dic" o "5 dic 2027". */
export function fd(s: string | null | undefined, anio = false): string {
  if (!s) return 'sin fecha';
  return fecha(s, 'corto') + (anio ? ' ' + s.slice(0, 4) : '');
}
export function rangoFase(f: FaseB): string {
  if (!f.inicio || !f.fin) return 'sin fechas';
  return f.inicio === f.fin ? fd(f.inicio, true) : `${fd(f.inicio)} – ${fd(f.fin, true)}`;
}
/** Calendario sugerido a partir de la fecha de la elección. La precampaña arranca hoy. */
export function fasesSugeridas(eleccion: string, hoy: string): FaseB[] {
  const e = eleccion;
  return [
    { nombre: 'Precampaña', inicio: hoy, fin: sumarDias(e, -31) },
    { nombre: 'Campaña', inicio: sumarDias(e, -30), fin: sumarDias(e, -3) },
    { nombre: 'Veda', inicio: sumarDias(e, -2), fin: sumarDias(e, -1) },
    { nombre: 'Jornada electoral', inicio: e, fin: e },
    { nombre: 'Post-electoral', inicio: sumarDias(e, 1), fin: sumarDias(e, 15) },
  ];
}

// ---------- borrador ----------
export function vacio(): DatosB {
  return {
    paso: 0,
    campana: { nombre: '', tipo_eleccion: 'Alcaldía', pais: 'Venezuela', estado: '', municipio: '', zona_horaria: 'America/Caracas', jornada: '' },
    fases: FASES.map((nombre) => ({ nombre, inicio: '', fin: '' })),
    figuras: [],
    confirmo_personas_publicas: false,
    terminos: [],
    temas: [],
    equipo: [],
  };
}

/** Lee un borrador guardado (puede venir incompleto) y lo deja con la forma completa. "Jornada" pasa a "Jornada electoral". */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizar(raw: any, yo: string | null): DatosB {
  const b = vacio();
  if (!raw || typeof raw !== 'object') raw = {};
  const c = raw.campana ?? {};
  const s = (v: unknown, def = '') => (typeof v === 'string' ? v : def);
  const d: DatosB = {
    paso: Number.isInteger(raw.paso) ? Math.min(5, Math.max(0, raw.paso)) : 0,
    max: Number.isInteger(raw.max) ? raw.max : undefined,
    campana: {
      nombre: s(c.nombre), tipo_eleccion: TIPOS_ELECCION.includes(c.tipo_eleccion) ? c.tipo_eleccion : b.campana.tipo_eleccion,
      pais: s(c.pais, b.campana.pais), estado: s(c.estado), municipio: s(c.municipio),
      zona_horaria: s(c.zona_horaria, b.campana.zona_horaria), jornada: s(c.jornada),
    },
    fases: Array.isArray(raw.fases) && raw.fases.length
      ? raw.fases.map((f: FaseB) => ({ nombre: f.nombre === 'Jornada' ? 'Jornada electoral' : s(f.nombre), inicio: s(f.inicio), fin: s(f.fin) }))
      : b.fases,
    figuras: (Array.isArray(raw.figuras) ? raw.figuras : [])
      .filter((f: FiguraB) => f && (f.figura_id || f.nueva?.nombre))
      .map((f: FiguraB) => ({
        ...(f.figura_id ? { figura_id: f.figura_id } : { nueva: f.nueva, clave: f.clave ?? nuevaClave() }),
        relacion: ORDEN_REL.includes(f.relacion) ? f.relacion : 'A observar',
        terminos: (Array.isArray(f.terminos) ? f.terminos : []).filter((t) => t && t.texto),
      })),
    confirmo_personas_publicas: !!raw.confirmo_personas_publicas,
    terminos: (Array.isArray(raw.terminos) ? raw.terminos : []).filter((t: TerminoB) => t && t.texto),
    temas: (Array.isArray(raw.temas) ? raw.temas : []).filter((t: unknown) => typeof t === 'string' && t),
    equipo: (Array.isArray(raw.equipo) ? raw.equipo : []).filter((m: MiembroB) => m && (m.persona_id || m.email || m.nombre))
      .map((m: MiembroB) => ({ ...m, rol: ROLES.some(([r]) => r === m.rol) ? m.rol : 'Análisis' })),
  };
  // Quien crea la campaña queda siempre como Administración (así lo hace crear_campana).
  if (yo) {
    const resto = d.equipo.filter((m) => m.persona_id !== yo);
    d.equipo = [{ persona_id: yo, rol: 'Administración' }, ...resto];
  }
  return d;
}

export function nuevaClave(): string {
  return 'n' + Math.random().toString(36).slice(2, 10);
}
export function claveFigura(f: FiguraB): string {
  return f.figura_id ?? 'nueva:' + (f.clave ?? f.nueva?.nombre ?? '');
}
export function tipoTermino(texto: string, base: string): string {
  return texto.startsWith('#') ? 'Hashtag' : base;
}
export function figurasOrdenadas(figs: FiguraB[]): FiguraB[] {
  return figs.slice().sort((a, b) => ORDEN_REL.indexOf(a.relacion) - ORDEN_REL.indexOf(b.relacion));
}
export function territorio(d: DatosB): string {
  const t = [d.campana.municipio.trim(), d.campana.estado.trim()].filter(Boolean).join(', ');
  return t || (d.campana.tipo_eleccion === 'Presidencial' ? d.campana.pais : '');
}
export function inicialesCampana(nombre: string): string {
  const palabras = nombre.split(/\s+/).filter((w) => /^[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(w));
  return iniciales(palabras.join(' ')) || '?';
}

// ---------- calendario ----------
export interface Calendario { faltan: boolean; ok: boolean; checks: Array<{ ok: boolean; texto: string }>; actual: number }
export function revisarCalendario(d: DatosB, hoy: string): Calendario {
  const ph = d.fases, elec = d.campana.jornada;
  const faltan = !elec || ph.some((p) => !p.inicio || !p.fin);
  let c1 = 'Las fases están en orden y no se solapan.', b1 = false;
  if (faltan) { b1 = true; c1 = 'Faltan fechas: completa la elección y el inicio y fin de cada fase, o carga las fases sugeridas.'; }
  else {
    for (const p of ph) if (!b1 && p.fin < p.inicio) { b1 = true; c1 = `${p.nombre}: el fin (${fd(p.fin)}) es anterior al inicio (${fd(p.inicio)}).`; }
    for (let i = 0; i < ph.length - 1 && !b1; i++) {
      if (ph[i + 1].inicio <= ph[i].fin) { b1 = true; c1 = `${ph[i].nombre} y ${ph[i + 1].nombre} se solapan: ${ph[i + 1].nombre} empieza el ${fd(ph[i + 1].inicio)} y ${ph[i].nombre} termina el ${fd(ph[i].fin)}.`; }
    }
  }
  const veda = ph.find((p) => p.nombre === 'Veda');
  const jornada = ph.find((p) => p.nombre.startsWith('Jornada'));
  const b2 = faltan || (!!veda && !!jornada && veda.fin >= jornada.inicio);
  const b3 = faltan || (!!jornada && jornada.inicio !== elec);
  const checks = [
    { ok: !b1, texto: c1 },
    { ok: !b2, texto: b2 ? 'La veda debe terminar antes de la jornada.' : veda ? `La veda termina antes de la jornada (${fd(veda.fin)}).` : 'Sin veda en el calendario.' },
    { ok: !b3, texto: b3 ? 'La jornada debe coincidir con la fecha de la elección. Ajusta las fechas o carga las fases sugeridas.' : `La jornada coincide con la fecha de la elección (${fd(elec, true)}).` },
  ];
  const actual = faltan ? -1 : ph.findIndex((p) => p.inicio <= hoy && hoy <= p.fin);
  return { faltan, ok: !b1 && !b2 && !b3, checks, actual };
}
/** Fase con la que nace la campaña: la que contiene hoy; antes del calendario, la primera; después, la última. */
export function faseInicial(d: DatosB, hoy: string): string {
  const ph = d.fases.filter((p) => p.inicio && p.fin);
  const dentro = ph.find((p) => p.inicio <= hoy && hoy <= p.fin);
  if (dentro) return dentro.nombre;
  if (ph.length && hoy > ph[ph.length - 1].fin) return ph[ph.length - 1].nombre;
  return ph[0]?.nombre ?? 'Precampaña';
}
export function diasFase(f: FaseB): number {
  return f.inicio && f.fin ? (diasEntre(f.inicio, f.fin) ?? -1) + 1 : 0;
}

// ---------- validación por paso ----------
export function problemas(d: DatosB, hoy: string, nombreDe: (f: FiguraB) => string): string[] {
  const cal = revisarCalendario(d, hoy);
  const propia = d.figuras.some((f) => f.relacion === 'Propia');
  const sinTerm = figurasOrdenadas(d.figuras).find((f) => !f.terminos.length);
  const sinCorreo = d.equipo.find((m) => !m.persona_id && !(m.email ?? '').trim());
  const bad = [
    !d.campana.nombre.trim() ? 'Escribe el nombre de la campaña' : !territorio(d) ? 'Indica el territorio' : '',
    cal.ok ? '' : 'Corrige el calendario para continuar',
    !propia ? 'Elige la figura propia' : !d.confirmo_personas_publicas ? 'Confirma que son personas públicas en un rol público' : '',
    sinTerm ? `Agrega al menos un término a ${nombreDe(sinTerm)}` : '',
    sinCorreo ? `Agrega el correo de ${sinCorreo.nombre ?? 'la invitación'} o quítala` : '',
  ];
  bad.push(bad.find(Boolean) ?? '');
  return bad;
}

// ---------- crear_campana ----------
export function parametro(d: DatosB, orgId: string, yo: string | null, hoy: string) {
  const fases = d.fases.filter((p) => p.nombre);
  const de = (n: string) => fases.find((p) => p.nombre === n);
  const camp = de('Campaña'), veda = de('Veda');
  const ambito = AMBITO[d.campana.tipo_eleccion] ?? d.campana.tipo_eleccion;
  const anio = d.campana.jornada ? d.campana.jornada.slice(0, 4) : '';
  const nombre = d.campana.nombre.trim();
  return {
    org_id: orgId,
    campana: {
      nombre,
      contienda: [ambito, anio].filter(Boolean).join(' '),
      titulo_largo: nombre,
      iniciales: inicialesCampana(nombre),
      ambito,
      pais: d.campana.pais,
      territorio: territorio(d),
      fase: faseInicial(d, hoy),
      inicio_campana: camp?.inicio || null,
      fin_campana: camp?.fin || null,
      veda_inicio: veda?.inicio || null,
      veda_fin: veda?.fin || null,
      jornada: d.campana.jornada || null,
      extra: {
        tipo_eleccion: d.campana.tipo_eleccion,
        estado: d.campana.estado || null,
        municipio: d.campana.municipio || null,
        zona_horaria: d.campana.zona_horaria,
        temas: d.temas,
      },
    },
    fases: fases.map((p) => ({ nombre: p.nombre, inicio: p.inicio || null, fin: p.fin || null })),
    figuras: figurasOrdenadas(d.figuras).map((f) => ({
      ...(f.figura_id
        ? { figura_id: f.figura_id }
        : { nueva: { nombre: f.nueva!.nombre.trim(), iniciales: iniciales(f.nueva!.nombre), partido: f.nueva!.partido?.trim() || null, cargo: f.nueva!.cargo?.trim() || null } }),
      relacion: f.relacion,
      terminos: f.terminos.map((t) => ({ texto: t.texto, tipo: t.tipo })),
    })),
    terminos: d.terminos.map((t) => ({ texto: t.texto, tipo: t.tipo })),
    equipo: d.equipo
      .filter((m) => m.persona_id !== yo)
      .map((m) => (m.persona_id ? { persona_id: m.persona_id, rol: m.rol } : { nombre: m.nombre?.trim() || null, email: m.email!.trim(), rol: m.rol })),
  };
}
