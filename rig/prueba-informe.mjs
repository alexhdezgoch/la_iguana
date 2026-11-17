// Prueba de public.informe_datos contra la base local. Uso: node rig/prueba-informe.mjs (después de bash rig/reset.sh)
// Carga un juego mínimo de filas en una campaña desechable, llama a la función como cada rol y revisa las cifras.
// Todo corre en una transacción que se revierte: no deja datos.
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.RIG_DB ?? 'postgres://rig:rig@127.0.0.1:5432/iguana' });
const U = {
  admin: '00000000-0000-4000-8000-000000000001',
  cliente: '00000000-0000-4000-8000-000000000004',
  ajeno: '00000000-0000-4000-8000-000000000005',
};
let fallas = 0, casos = 0;
function revisa(nombre, real, esperado) {
  casos++;
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bien) fallas++;
  console.log(`${bien ? 'ok   ' : 'FALLA'} ${nombre}${bien ? '' : `  → ${JSON.stringify(real)} (esperado ${JSON.stringify(esperado)})`}`);
}

const C = 'prueba-informe';
const FIXTURE = `
insert into campanas (id, org_id, nombre, zona_horaria, es_demo) values ('${C}', 'brujula', 'Campaña de prueba del Informe', 'America/Caracas', true);
insert into ejes (id, campana_id, nombre, regla, orden) values
  ('pi-conv', '${C}', 'Sobre la figura o el evento', 'regla de ejemplo', 1),
  ('pi-foco', '${C}', 'Sobre el evento', 'regla de ejemplo', 2),
  ('pi-comp', '${C}', 'Nombra al medio anfitrión', 'regla de ejemplo', 3),
  ('pi-a', '${C}', 'Eje A', 'regla A', 4),
  ('pi-b', '${C}', 'Eje B', 'regla B', 5);
insert into autores (id, campana_id, canal, handle, tipo, es_organizacion, seguidores, url) values
  ('pi-grande', '${C}', 'X', '@cuenta_opinion_1', 'Cuenta de opinión con gran audiencia', false, 250000, 'https://x.test/cuenta_opinion_1'),
  ('pi-org', '${C}', 'X', '@partido_1', 'Partido u organización', true, 5000, null),
  ('pi-chica', '${C}', 'X', '@persona_1', 'Cuenta personal', false, 900, 'https://x.test/persona_1'),
  ('pi-medio', '${C}', 'Instagram', '@medio_digital_1', 'Medio', true, null, null),
  ('pi-propia', '${C}', 'Instagram', '@emisora_1', 'Emisora', true, 40000, null);
insert into menciones (id, campana_id, canal, fuente, titulo, texto, url, publicada_en, autor_id, vistas, me_gusta, respuestas, compartidos, otro_pais, en_tema) values
  ('pi-m1', '${C}', 'X', 'Cuenta pública', null, 'texto 1', null, '2027-05-10T10:00:00-04:00', 'pi-grande', 1000, 10, 2, 3, false, true),
  ('pi-m2', '${C}', 'X', 'Cuenta pública', null, 'texto 2', 'https://x.test/persona_1/2', '2027-05-11T09:10:00-04:00', 'pi-chica', 5000, 100, 5, 5, false, true),
  ('pi-m3', '${C}', 'X', 'Cuenta pública', null, 'texto 3', 'https://x.test/partido_1/3', '2027-05-11T09:40:00-04:00', 'pi-org', 3000, 50, 0, 0, false, true),
  ('pi-m4', '${C}', 'X', 'Cuenta pública', null, 'texto 4', null, '2027-05-11T09:20:00-04:00', 'pi-grande', 9000, 1, 1, 1, false, true),
  ('pi-m5', '${C}', 'X', 'Cuenta pública', null, 'texto 5', null, '2027-05-11T12:00:00-04:00', 'pi-grande', 700, null, null, null, true, true),
  ('pi-m6', '${C}', 'X', 'Cuenta pública', null, 'texto 6', null, '2027-05-12T03:30:00Z', 'pi-org', null, null, null, null, false, true),
  ('pi-m7', '${C}', 'X', 'Cuenta pública', null, 'texto 7', null, '2027-05-12T10:00:00-04:00', 'pi-grande', 50, null, null, null, false, false),
  ('pi-m8', '${C}', 'Medio digital', 'Portal de noticias 1', 'Nota de ejemplo', null, 'https://noticias.test/1', '2027-05-11T10:00:00-04:00', null, null, null, null, null, false, true),
  ('pi-m9', '${C}', 'Instagram', 'Cuenta oficial', null, 'clip', 'https://ig.test/emisora_1/9', '2027-05-11T08:40:00-04:00', 'pi-propia', 2000, 300, 20, null, false, true),
  ('pi-m10', '${C}', 'Instagram', 'Cuenta oficial', null, 'nota', null, '2027-05-11T09:50:00-04:00', 'pi-medio', 100, 5, 1, null, false, true),
  ('pi-m11', '${C}', 'X', 'Cuenta pública', null, 'fuera', null, '2027-05-12T11:30:00-04:00', 'pi-grande', 10, null, null, null, false, true),
  ('pi-m12', '${C}', 'X', 'Cuenta pública', null, 'base', null, '2027-05-10T03:59:00-04:00', 'pi-chica', null, null, null, null, false, true);
insert into mencion_ejes (campana_id, mencion_id, eje_id, metodo) values
  ('${C}', 'pi-m1', 'pi-conv', 'Regla'), ('${C}', 'pi-m2', 'pi-conv', 'Regla'), ('${C}', 'pi-m2', 'pi-foco', 'Regla'),
  ('${C}', 'pi-m3', 'pi-conv', 'Regla'), ('${C}', 'pi-m3', 'pi-foco', 'Regla'), ('${C}', 'pi-m3', 'pi-comp', 'Regla'),
  ('${C}', 'pi-m4', 'pi-conv', 'Búsqueda'), ('${C}', 'pi-m4', 'pi-foco', 'Búsqueda'),
  ('${C}', 'pi-m5', 'pi-conv', 'Regla'), ('${C}', 'pi-m6', 'pi-conv', 'Regla'), ('${C}', 'pi-m7', 'pi-conv', 'Regla'),
  ('${C}', 'pi-m8', 'pi-conv', 'Manual'), ('${C}', 'pi-m8', 'pi-foco', 'Manual'),
  ('${C}', 'pi-m9', 'pi-conv', 'Manual'), ('${C}', 'pi-m9', 'pi-foco', 'Manual'),
  ('${C}', 'pi-m10', 'pi-conv', 'Regla'), ('${C}', 'pi-m10', 'pi-foco', 'Regla'),
  ('${C}', 'pi-m11', 'pi-conv', 'Regla'), ('${C}', 'pi-m12', 'pi-conv', 'Regla'),
  ('${C}', 'pi-m1', 'pi-a', 'Regla'), ('${C}', 'pi-m2', 'pi-a', 'Regla'), ('${C}', 'pi-m2', 'pi-b', 'Regla'),
  ('${C}', 'pi-m3', 'pi-b', 'Búsqueda'), ('${C}', 'pi-m5', 'pi-a', 'Regla');
insert into recolecciones (campana_id, canal, metodo, eje_id, dia, filas, tope, llego_al_tope, estimado, limites) values
  ('${C}', 'X', 'Búsqueda avanzada', 'pi-a', '2027-05-11', 1500, 1500, true, 2845, '{"tope de 1.500 por eje y día"}'),
  ('${C}', 'X', 'Búsqueda avanzada', 'pi-a', '2027-05-10', 20, 1500, false, null, '{}');

-- Muestra de comentarios ponderada por volumen (estratos del informe de ejemplo) y muestra de 150 publicaciones de X.
insert into codigos (id, campana_id, libro, nombre, tono, orden) values
  ('pi-c-apoyo', '${C}', 'General', 'Apoyo', 'apoyo', 1), ('pi-c-critica', '${C}', 'General', 'Críticas', 'critica', 2),
  ('pi-c-otro', '${C}', 'General', 'Otro', 'neutro', 3);
insert into muestras (id, campana_id, nombre, objeto, ponderacion, estratos, tamano, orden) values
  ('pi-mu-com', '${C}', 'Comentarios', 'comentarios', 'por volumen',
   '[{"canal":"YouTube","universo":98},{"canal":"Instagram","universo":3600},{"canal":"TikTok","universo":2561},{"canal":"Facebook","universo":823}]', 340, 1),
  ('pi-mu-x', '${C}', 'Publicaciones de X', 'menciones', 'ninguna', '[]', 150, 2);
-- Estratos: canal, tamaño, favorables, desfavorables (el resto neutral).
with e(canal, n, fav, des) as (values ('YouTube', 98, 36, 12), ('Instagram', 118, 36, 15), ('TikTok', 84, 39, 3), ('Facebook', 40, 17, 10)),
c as (
  insert into comentarios (id, campana_id, mencion_id, canal, publicada_en, solo_emojis)
  select 'pi-com-' || e.canal || '-' || i, '${C}', case when e.canal = 'Instagram' then 'pi-m9' end, e.canal,
    '2027-05-11T10:00:00-04:00'::timestamptz + i * interval '1 minute', i <= 5
  from e, generate_series(1, e.n) i returning id)
insert into codificaciones (campana_id, muestra_id, comentario_id, sentimiento, codigo_id)
select '${C}', 'pi-mu-com', 'pi-com-' || e.canal || '-' || i,
  case when i <= e.fav then 'Favorable' when i <= e.fav + e.des then 'Desfavorable' else 'Neutral' end,
  case when i <= e.fav then 'pi-c-apoyo' when i <= e.fav + e.des then 'pi-c-critica' else 'pi-c-otro' end
from e, generate_series(1, e.n) i;
insert into menciones (id, campana_id, canal, publicada_en, texto)
select 'pi-x-' || i, '${C}', 'X', '2027-05-01T10:00:00-04:00', 'muestra' from generate_series(1, 150) i;
insert into codificaciones (campana_id, muestra_id, mencion_id, sentimiento)
select '${C}', 'pi-mu-x', 'pi-x-' || i, case when i <= 40 then 'Favorable' when i <= 73 then 'Desfavorable' else 'Neutral' end from generate_series(1, 150) i;

insert into reportes (id, campana_id, nombre, tipo, extra) values
  ('pi-rep-evento', '${C}', 'Informe de prueba', 'Informe', $j$ {"informe": {
    "modo": "evento", "periodo_inicio": "2027-05-10T00:00:00-04:00", "periodo_fin": "2027-05-12T11:00:00-04:00",
    "dia_base": "2027-05-10", "ventana_evento": {"inicio": "2027-05-11T08:30:00-04:00", "fin": "2027-05-11T09:15:00-04:00", "estimada": true},
    "eje_conversacion": "pi-conv", "eje_foco": "pi-foco", "comparacion": {"eje_id": "pi-comp", "etiqueta": "Nombra al medio"},
    "muestras": ["pi-mu-com", "pi-mu-x"], "cuentas_propias": ["pi-propia"],
    "destacadas": [{"mencion_id": "pi-m2", "resumen": "Resumen propio", "etiqueta": "Crítica"}, {"mencion_id": "pi-m9", "grupo": "propias", "resumen": "Clip con la figura"}],
    "titulo": "Informe de impacto de prueba", "nota_version": "Versión 1"}}$j$::jsonb),
  ('pi-rep-tema', '${C}', 'Informe de tema', 'Informe', $j$ {"informe": {
    "modo": "tema", "periodo_inicio": "2027-05-10", "periodo_fin": "2027-05-12", "ejes": ["pi-a", "pi-b"],
    "enmascarar": {"top_publicaciones": "omitir", "top_cuentas": "omitir"}}}$j$::jsonb);
`;

const c = await pool.connect();
try {
  await c.query('begin');
  await c.query(FIXTURE);
  const llamar = async (quien, id) => {
    await c.query('savepoint s');
    await c.query('set local role authenticated');
    await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: U[quien], role: 'authenticated' })]);
    const t0 = Date.now();
    const r = (await c.query('select informe_datos($1) as d', [id])).rows[0].d;
    const ms = Date.now() - t0;
    await c.query('rollback to savepoint s');
    return { r, ms };
  };

  // ---------- acceso ----------
  revisa('ajeno recibe null', (await llamar('ajeno', 'pi-rep-evento')).r, null);
  revisa('cliente de otra campaña recibe null', (await llamar('cliente', 'pi-rep-evento')).r, null);
  revisa('reporte inexistente: null', (await llamar('admin', 'no-existe')).r, null);

  const { r: d, ms } = await llamar('admin', 'pi-rep-evento');
  console.log(`      informe_datos (evento) en ${ms} ms`);
  revisa('modo, zona y días', [d.modo, d.zona, d.dias.map((x) => x.fecha)], ['evento', 'America/Caracas', ['2027-05-10', '2027-05-11', '2027-05-12']]);
  revisa('día base, día del evento, último día parcial hasta 11:00',
    [d.dias[0].es_base, d.dias[1].es_evento, d.dias[2].parcial, d.dias[2].hasta, d.periodo.ventana_evento.hora_inicio, d.periodo.ventana_evento.hora_fin],
    [true, true, true, '11:00', '08:30', '09:15']);
  revisa('canales en orden fijo', d.canales, ['Medio digital', 'X', 'Instagram']);
  // Filas: todo lo recolectado del periodo (incluye otro país y fuera de tema; excluye 11:30 del 12, fin excluido).
  revisa('filas por día en X', d.series.filas.por_canal.X, [2, 5, 1]);
  revisa('filas totales por día', d.series.filas.total, [2, 8, 1]);
  // Conversación: sin otro país (m5) ni fuera de tema (m7); m6 (03:30 UTC del 12) cae el 11 a las 23:30 en Caracas.
  revisa('conversación por día en X', d.series.conversacion.por_canal.X, [2, 4, 0]);
  revisa('foco por día en X', d.series.foco.por_canal.X, [0, 3, 0]);
  revisa('otro país por día en X', d.series.otro_pais.por_canal.X, [0, 1, 0]);
  revisa('vistas de la conversación en X', d.series.vistas_conversacion.por_canal.X, [1000, 17000, 0]);
  revisa('interacción de la conversación en X', d.series.interaccion_conversacion.por_canal.X, [15, 163, 0]);
  revisa('comparación y sus vistas en X', [d.series.comparacion.por_canal.X, d.series.vistas_comparacion.por_canal.X], [[0, 1, 0], [0, 3000, 0]]);
  revisa('solo por búsqueda en X (fuera de rankings)', d.series.solo_busqueda.por_canal.X, [0, 1, 0]);
  revisa('comentarios por día', [d.canales_comentarios, d.series.comentarios.total], [['Instagram', 'TikTok', 'YouTube', 'Facebook'], [0, 340, 0]]);
  // Hora por hora del 11: tres publicaciones de X a las 09 y una a las 23. Base: 2 en el día → 2/24.
  revisa('hora por hora en X', [d.por_hora.conversacion.por_canal.X[9], d.por_hora.conversacion.por_canal.X[23]], [3, 1]);
  revisa('pico y veces el promedio base', [d.por_hora.pico.por_canal.X.hora, d.por_hora.pico.por_canal.X.n, d.por_hora.pico.por_canal.X.veces_base, d.por_hora.promedio_base.por_canal.X],
    [9, 3, 36, 0.1]);
  // Desglose del foco.
  const fx = d.desglose.foco.filas.find((x) => x.canal === 'X');
  revisa('desglose del foco en X', [fx.publicaciones, fx.vistas, fx.me_gusta, fx.interaccion], [3, 17000, 151, 163]);
  const fm = d.desglose.foco.filas.find((x) => x.canal === 'Medio digital');
  revisa('noticias sin vistas: pct null', [fm.publicaciones, fm.con_vistas, fm.pct_vistas], [1, 0, null]);
  revisa('total del foco', [d.desglose.foco.total.publicaciones, d.desglose.foco.total.vistas], [6, 19100]);
  // Rankings: solo Regla o Manual (m4, por búsqueda, queda fuera); la cuenta chica sale como "Cuenta personal" sin enlace.
  const px = d.rankings.publicaciones.X.por_vistas;
  revisa('top de X por vistas sin la de búsqueda', px.map((p) => p.mencion_id), ['pi-m2', 'pi-m3']);
  revisa('cuenta chica enmascarada sin enlaces', [px[0].cuenta.etiqueta, px[0].cuenta.handle, px[0].cuenta.url, px[0].url, px[0].cuenta.autor_id],
    ['Cuenta personal', null, null, null, null]);
  revisa('organización chica visible con enlace', [px[1].cuenta.etiqueta, px[1].url], ['@partido_1', 'https://x.test/partido_1/3']);
  revisa('nada del ranking filtra el usuario chico', JSON.stringify(d).includes('persona_1'), false);
  revisa('top de cuentas en X', d.rankings.cuentas.X.por_vistas.map((x) => [x.etiqueta, x.publicaciones, x.vistas]), [['Cuenta personal', 1, 5000], ['@partido_1', 1, 3000]]);
  revisa('noticias: titulares y medios', [d.medios.titulares.map((x) => x.fuente), d.medios.por_fuente, d.medios.total_titulares], [['Portal de noticias 1'], [{ fuente: 'Portal de noticias 1', articulos: 1 }], 1]);
  revisa('cuentas de medios en Instagram', d.medios.cuentas.Instagram.map((x) => [x.etiqueta, x.publicaciones]), [['@medio_digital_1', 1]]);
  revisa('comparación', [d.comparacion.eje_id, d.comparacion.etiqueta], ['pi-comp', 'Nombra al medio']);
  // Comentarios: los 118 de Instagram están en una publicación del foco y de una cuenta propia.
  const ci = d.comentarios.por_canal.Instagram;
  revisa('concentración de comentarios en Instagram', [ci.comentarios, ci.publicaciones, ci.pct_en_ambito, ci.pct_de_cuentas_propias, ci.solo_emojis, ci.top[0].mencion_id, ci.top[0].pct],
    [118, 1, 100, 100, 5, 'pi-m9', 100]);
  // Muestras: margen máx. = round(1.96·√(0.25/n)·100) y % ponderado por universo de cada estrato.
  const [mc, mx] = d.muestras;
  revisa('márgenes por estrato 10/9/11/15', mc.estratos.map((e) => [e.canal, e.n, e.margen_max]),
    [['YouTube', 98, 10], ['Instagram', 118, 9], ['TikTok', 84, 11], ['Facebook', 40, 15]]);
  revisa('ponderado 38/11/51', [mc.ponderado.favorable, mc.ponderado.desfavorable, mc.ponderado.neutral].map(Math.round), [38, 11, 51]);
  revisa('muestra de comentarios n=340', [mc.n, mc.margen_max], [340, 5]);
  revisa('muestra de X n=150: margen 8', [mx.n, mx.margen_max, mx.ponderado, mx.sentimiento.favorable.pct], [150, 8, null, 26.7]);
  const apoyo = mc.temas.find((t) => t.codigo_id === 'pi-c-apoyo');
  revisa('tema ponderado igual al favorable ponderado', [apoyo.n, apoyo.pct_ponderado, apoyo.por_estrato.YouTube.n], [128, mc.ponderado.favorable, 36]);
  // Destacadas y cuentas propias.
  revisa('destacadas con la regla de publicación', d.destacadas.lista.map((x) => [x.mencion_id, x.cuenta.etiqueta, x.url, x.grupo]),
    [['pi-m2', 'Cuenta personal', null, 'destacadas'], ['pi-m9', '@emisora_1', 'https://ig.test/emisora_1/9', 'propias']]);
  revisa('publicaciones propias con "qué es"', d.cuentas_propias.publicaciones.map((x) => [x.mencion_id, x.que_es]), [['pi-m9', 'Clip con la figura']]);
  revisa('cuentas distintas en X', d.cuentas_distintas.por_canal.X, 3);

  // ---------- modo tema ----------
  const { r: t } = await llamar('admin', 'pi-rep-tema');
  revisa('tema: periodo por fechas en la zona', [t.dias.map((x) => x.fecha), t.periodo.fin_local], [['2027-05-10', '2027-05-11', '2027-05-12'], '2027-05-13T00:00']);
  const ea = t.ejes.lista.find((e) => e.eje_id === 'pi-a'), eb = t.ejes.lista.find((e) => e.eje_id === 'pi-b');
  revisa('ejes por día en X (sin otro país)', [ea.por_canal.X.por_dia, eb.por_canal.X.por_dia], [[1, 1, 0], [0, 2, 0]]);
  revisa('tope y estimado del eje A el 11', [ea.por_canal.X.tope, ea.por_canal.X.estimado], [[false, true, false], [null, 2845, null]]);
  revisa('total sin duplicados, otro país y sin eje en X', [t.series.sin_duplicados.por_canal.X, t.series.otro_pais.por_canal.X, t.series.sin_eje.por_canal.X],
    [[1, 2, 0], [0, 1, 0], [1, 2, 2]]);
  revisa('filas = sin duplicados + otro país + sin eje', t.series.filas.por_canal.X, [2, 5, 2]);
  revisa('tema: modo omitir deja fuera la cuenta chica y la cuenta', [t.rankings.publicaciones.X.por_vistas.map((p) => p.mencion_id), t.rankings.publicaciones.X.omitidas.por_vistas],
    [['pi-m1'], 1]);
  revisa('tema: cuentas omitidas', [t.rankings.cuentas.X.por_vistas.map((x) => x.etiqueta), t.rankings.cuentas.X.omitidas.por_vistas], [['@cuenta_opinion_1'], 1]);
  revisa('tema: sin día de evento', t.por_hora, null);
  revisa('recolecciones del periodo', t.recolecciones.map((x) => [x.dia, x.llego_al_tope, x.eje_nombre]), [['2027-05-10', false, 'Eje A'], ['2027-05-11', true, 'Eje A']]);

  // Campaña vacía: un Informe sin filas no falla.
  await c.query(`insert into reportes (id, campana_id, nombre, tipo, extra) values ('pi-rep-vacio', 'vacia', 'Vacío', 'Informe', '{"informe": {"modo": "evento"}}')`);
  const { r: v } = await llamar('admin', 'pi-rep-vacio');
  revisa('campaña vacía: estructura con ceros', [v.canales, v.series.conversacion.total.length > 0, v.muestras, v.rankings.publicaciones], [[], true, [], {}]);
} finally {
  await c.query('rollback').catch(() => {});
  c.release();
}
console.log(`\n${casos - fallas} de ${casos} casos pasan.`);
await pool.end();
process.exit(fallas ? 1 : 0);
