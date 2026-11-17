// Prueba de reglas de acceso contra la base local. Uso: node rig/prueba-acceso.mjs (después de bash rig/reset.sh)
// Cada caso corre en una transacción que se revierte: no deja datos.
import fs from 'node:fs';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.RIG_DB ?? 'postgres://rig:rig@127.0.0.1:5432/iguana' });
const U = {
  admin: '00000000-0000-4000-8000-000000000001',
  analista: '00000000-0000-4000-8000-000000000002',
  lector: '00000000-0000-4000-8000-000000000003',
  cliente: '00000000-0000-4000-8000-000000000004',
  ajeno: '00000000-0000-4000-8000-000000000005',
};
let fallas = 0, casos = 0;

/** Corre `fn` como `quien` (o como anónimo; 'base' = el usuario dueño, como la semilla o el panel de Supabase) y revierte.
 *  `prep` (opcional) corre antes en la misma transacción como el dueño: datos de apoyo que la prueba necesita. Devuelve { ok, valor | error }. */
async function como(quien, fn, prep) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    if (prep) await c.query(prep);
    if (quien === 'base') { /* sin cambiar de rol */ }
    else if (quien === 'anon') await c.query('set local role anon');
    else {
      await c.query('set local role authenticated');
      await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: U[quien], role: 'authenticated' })]);
    }
    return { ok: true, valor: await fn(c) };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    await c.query('rollback').catch(() => {});
    c.release();
  }
}
const cuenta = (sql, p = []) => async (c) => (await c.query(sql, p)).rows.length;
const afecta = (sql, p = []) => async (c) => (await c.query(sql, p)).rowCount;

async function espera(nombre, quien, fn, cond, prep) {
  casos++;
  const r = await como(quien, fn, prep);
  const bien = cond(r);
  if (!bien) fallas++;
  console.log(`${bien ? 'ok   ' : 'FALLA'} ${quien.padEnd(8)} ${nombre}${bien ? '' : '  → ' + JSON.stringify(r)}`);
}
const n = (k) => (r) => r.ok && r.valor === k;
const alguno = (r) => r.ok && r.valor > 0;
const nada = (r) => (r.ok && r.valor === 0) || !r.ok; // sin filas o rechazado
const rechaza = (r) => !r.ok;

// ---------- lectura ----------
await espera('anónimo no lee campañas', 'anon', cuenta('select 1 from campanas'), nada);
await espera('anónimo no lee figuras', 'anon', cuenta('select 1 from figuras'), nada);
await espera('ajeno no ve campañas de Brújula', 'ajeno', cuenta('select 1 from campanas'), n(0));
await espera('ajeno no ve figuras de Brújula', 'ajeno', cuenta('select 1 from figuras'), n(0));
await espera('ajeno no ve personas de Brújula', 'ajeno', cuenta(`select 1 from personas where org_id = 'brujula'`), n(0));
await espera('ajeno no ve menciones ni alertas', 'ajeno', cuenta('select 1 from alertas union all select 1 from menciones'), n(0));
await espera('ajeno no ve la vista de resumen', 'ajeno', cuenta('select 1 from v_campanas_resumen'), n(0));
await espera('admin ve las 5 campañas del equipo', 'admin', cuenta('select 1 from campanas'), n(5));
await espera('admin ve la vista de resumen', 'admin', cuenta('select 1 from v_campanas_resumen'), n(5));
await espera('analista ve solo presidenciales e informe-ejemplo', 'analista', cuenta(`select 1 from campanas where id in ('presidenciales', 'informe-ejemplo')`), n(2));
await espera('analista no ve otras campañas', 'analista', cuenta('select 1 from campanas'), n(2));
await espera('analista no ve figuras vinculadas de Zulia', 'analista', cuenta(`select 1 from campana_figuras where campana_id = 'zulia'`), n(0));
await espera('analista ve el directorio de figuras del equipo', 'analista', cuenta('select 1 from figuras'), n(10));
await espera('cliente ve solo las figuras de su campaña', 'cliente', cuenta('select 1 from figuras'), n(8));
await espera('cliente ve alertas de su campaña', 'cliente', cuenta('select 1 from alertas'), alguno);
await espera('cliente solo se ve a sí mismo en personas', 'cliente', cuenta('select 1 from personas'), n(1));
// Nombres del equipo (v_personas_campana): solo id, nombre corto e iniciales de miembros de campañas visibles.
await espera('cliente ve los nombres del equipo de su campaña', 'cliente', async (c) => {
  const r = await c.query('select * from v_personas_campana order by id');
  const ids = r.rows.map((x) => x.id);
  const cols = r.fields.map((f) => f.name).sort().join(',');
  return JSON.stringify({ cols, lucia: ids.includes('lucia'), carla: ids.includes('carla'), yo: ids.includes('rig-cliente'), valentina: ids.includes('valentina') });
}, (r) => r.ok && r.valor === JSON.stringify({ cols: 'id,iniciales,nombre_corto', lucia: true, carla: true, yo: true, valentina: false }));
// Fuera de los miembros de presidenciales solo puede aparecer quien administra el equipo (rig-admin).
await espera('cliente no ve nombres de personas fuera de su campaña', 'cliente', cuenta(`select 1 from v_personas_campana v
  where v.id not in (select persona_id from miembros_campana where campana_id = 'presidenciales') and v.id <> 'rig-admin'`), n(0));
await espera('ajeno no ve nombres del equipo de Brújula', 'ajeno', cuenta('select 1 from v_personas_campana'), n(0));
await espera('anónimo no lee nombres del equipo', 'anon', cuenta('select 1 from v_personas_campana'), nada);

// ---------- notas internas ----------
const nota = `insert into notas_internas (campana_id, entidad, entidad_id, texto) values ('presidenciales', 'figura', 'machado', 'nota de prueba')`;
await espera('analista escribe y lee notas internas', 'analista', async (c) => { await c.query(nota); return (await c.query('select 1 from notas_internas')).rows.length; }, n(1));
await espera('lector no escribe notas internas', 'lector', afecta(nota), rechaza);
{
  // Deja una nota real un momento para comprobar que el cliente no la lee.
  const c = await pool.connect();
  await c.query(`insert into notas_internas (id, campana_id, entidad, entidad_id, texto) values ('prueba-nota', 'presidenciales', 'figura', 'machado', 'x')`);
  c.release();
  await espera('lector lee notas internas', 'lector', cuenta('select 1 from notas_internas'), n(1));
  await espera('cliente NO lee notas internas', 'cliente', cuenta('select 1 from notas_internas'), n(0));
  await pool.query(`delete from notas_internas where id = 'prueba-nota'`);
}

// ---------- escritura ----------
const cambiaAlerta = `update alertas set estado = 'Resuelta' where id = 'pres-alerta-1'`;
await espera('analista cambia una alerta', 'analista', afecta(cambiaAlerta), n(1));
await espera('admin cambia una alerta', 'admin', afecta(cambiaAlerta), n(1));
await espera('lector no cambia una alerta', 'lector', afecta(cambiaAlerta), nada);
await espera('cliente no cambia una alerta', 'cliente', afecta(cambiaAlerta), nada);
await espera('ajeno no cambia una alerta', 'ajeno', afecta(cambiaAlerta), nada);
const altaEvento = (camp) => `insert into eventos (campana_id, nombre, tipo) values ('${camp}', 'Evento de prueba', 'Mitin')`;
await espera('analista crea un evento en su campaña', 'analista', afecta(altaEvento('presidenciales')), n(1));
await espera('analista no crea un evento en Zulia', 'analista', afecta(altaEvento('zulia')), rechaza);
await espera('lector no crea eventos', 'lector', afecta(altaEvento('presidenciales')), rechaza);
await espera('cliente no crea eventos', 'cliente', afecta(altaEvento('presidenciales')), rechaza);
await espera('analista no borra de otra campaña', 'analista', afecta(`delete from campana_figuras where campana_id = 'zulia'`), n(0));
await espera('estado de alerta fuera del vocabulario se rechaza', 'analista', afecta(`update alertas set estado = 'Abierta' where id = 'pres-alerta-1'`), rechaza);
await espera('analista no cambia la campaña', 'analista', afecta(`update campanas set nombre = 'x' where id = 'presidenciales'`), n(0));
await espera('admin cambia la campaña', 'admin', afecta(`update campanas set nombre = 'x' where id = 'presidenciales'`), n(1));
await espera('nadie inserta campañas directo', 'admin', afecta(`insert into campanas (org_id, nombre) values ('brujula', 'x')`), rechaza);
await espera('analista no agrega miembros', 'analista', afecta(`insert into miembros_campana (campana_id, persona_id, rol) values ('presidenciales', 'lucia', 'Análisis')`), rechaza);
await espera('cliente no crea figuras', 'cliente', afecta(`insert into figuras (org_id, nombre) values ('brujula', 'x')`), rechaza);
await espera('ajeno no crea figuras en Brújula', 'ajeno', afecta(`insert into figuras (org_id, nombre) values ('brujula', 'x')`), rechaza);
await espera('nadie escribe personas directo', 'admin', afecta(`insert into personas (org_id, nombre) values ('brujula', 'x')`), rechaza);

// ---------- funciones ----------
const nueva = JSON.stringify({
  org_id: 'brujula',
  campana: { nombre: 'Campaña de prueba', contienda: 'Regionales 2027', iniciales: 'CP', ambito: 'Regionales' },
  fases: [{ nombre: 'Precampaña', inicio: '2027-05-01', fin: '2027-06-01' }],
  figuras: [{ figura_id: 'rosales', relacion: 'Propia', terminos: [{ texto: 'Rosales', tipo: 'Nombre' }] }, { nueva: { nombre: 'Figura nueva', partido: 'X' }, relacion: 'Rival' }],
  terminos: [{ texto: 'spam', tipo: 'Exclusión' }],
  equipo: [{ persona_id: 'daniela', rol: 'Análisis' }, { nombre: 'Cliente nuevo', email: 'nuevo@cliente.test', rol: 'Cliente' }],
});
await espera('analista crea una campaña completa y queda como Administración', 'analista', async (c) => {
  const id = (await c.query('select crear_campana($1::jsonb) as id', [nueva])).rows[0].id;
  const r = await c.query(`select
    (select count(*)::int from campana_figuras where campana_id = $1) as figuras,
    (select count(*)::int from terminos where campana_id = $1) as terminos,
    (select count(*)::int from miembros_campana where campana_id = $1) as miembros,
    (select figura_propia_id from campanas where id = $1) as propia,
    mi_rol($1) as rol`, [id]);
  return JSON.stringify(r.rows[0]);
}, (r) => r.ok && r.valor === JSON.stringify({ figuras: 2, terminos: 2, miembros: 3, propia: 'rosales', rol: 'Administración' }));
await espera('crear_campana guarda zona horaria y nombres cortos', 'analista', async (c) => {
  const p = JSON.stringify({ org_id: 'brujula', campana: { nombre: 'Campaña Z', nombre_corto: 'Z', zona_horaria: 'America/Bogota' }, figuras: [{ nueva: { nombre: 'Figura Z', nombre_corto: 'Z.' }, relacion: 'Propia' }] });
  const id = (await c.query('select crear_campana($1::jsonb) as id', [p])).rows[0].id;
  const r = await c.query(`select c.zona_horaria, c.nombre_corto, f.nombre_corto as fig from campanas c join figuras f on f.id = c.figura_propia_id where c.id = $1`, [id]);
  const id2 = (await c.query('select crear_campana($1::jsonb) as id', [JSON.stringify({ org_id: 'brujula', campana: { nombre: 'Campaña sin zona' } })])).rows[0].id;
  const d = (await c.query('select zona_horaria from campanas where id = $1', [id2])).rows[0].zona_horaria;
  return JSON.stringify({ ...r.rows[0], defecto: d });
}, (r) => r.ok && r.valor === JSON.stringify({ zona_horaria: 'America/Bogota', nombre_corto: 'Z', fig: 'Z.', defecto: 'America/Caracas' }));
await espera('cliente no crea campañas', 'cliente', async (c) => (await c.query('select crear_campana($1::jsonb)', [nueva])).rowCount, rechaza);
await espera('ajeno no crea campañas en Brújula', 'ajeno', async (c) => (await c.query('select crear_campana($1::jsonb)', [nueva])).rowCount, rechaza);
await espera('analista no invita personas', 'analista', async (c) => (await c.query(`select invitar_persona('presidenciales', 'X', 'x@x.test', 'Cliente')`)).rowCount, rechaza);
await espera('admin invita un cliente', 'admin', async (c) => {
  await c.query(`select invitar_persona('presidenciales', 'Cliente X', 'x@x.test', 'Cliente')`);
  return (await c.query(`select 1 from miembros_campana m join personas p on p.id = m.persona_id where p.email = 'x@x.test' and m.rol = 'Cliente' and p.rol_org = 'externo'`)).rows.length;
}, n(1));
await espera('mi_contexto devuelve persona y equipo', 'analista', async (c) => (await c.query('select mi_contexto() as r')).rows[0].r?.org?.id, (r) => r.ok && r.valor === 'brujula');
await espera('mi_contexto vacío para anónimo', 'anon', async (c) => (await c.query('select mi_contexto() as r')).rows[0].r, (r) => !r.ok || r.valor == null);

// ====================================================================
// Regresiones de la revisión de seguridad (rev-seguridad 1–13). Cada caso reproduce el hallazgo y debe fallar cerrado.
// ====================================================================
const uno = (sql, p = []) => async (c) => { const r = await c.query(sql, p); return r.rows[0] ? Object.values(r.rows[0])[0] : null; };
const vale = (v) => (r) => r.ok && r.valor === v;
// Apoyo: una figura y una campaña de la otra organización (la crea el dueño en la misma transacción).
const AJENA = `insert into figuras (id, org_id, nombre) values ('fig-ajena', 'otra-org', 'Figura ajena');
  insert into campanas (id, org_id, nombre) values ('camp-ajena', 'otra-org', 'Campaña ajena');`;

// 1. campanas: id, org_id, creada_por y es_demo no cambian desde la app.
await espera('[1] admin no mueve la campaña a otro equipo', 'admin', afecta(`update campanas set org_id = 'otra-org' where id = 'presidenciales'`), rechaza);
await espera('[1] admin no cambia el id de la campaña', 'admin', afecta(`update campanas set id = 'otra' where id = 'vacia'`), rechaza);
await espera('[1] admin no cambia quién creó la campaña', 'admin', afecta(`update campanas set creada_por = 'rig-admin' where id = 'presidenciales'`), rechaza);
await espera('[1] admin no cambia es_demo', 'admin', afecta(`update campanas set es_demo = not es_demo where id = 'presidenciales'`), rechaza);
await espera('[1] admin sigue cambiando otros campos de la campaña', 'admin', afecta(`update campanas set fase = 'Campaña' where id = 'presidenciales'`), n(1));

// 2. figura_id de otro equipo: ni en vínculos, ni en tablas de datos, ni como figura propia; y figuras_lee no la deja ver.
await espera('[2] ajeno no vincula una figura de Brújula a su campaña', 'ajeno', afecta(`insert into campana_figuras (campana_id, figura_id) values ('camp-ajena', 'machado')`), rechaza, AJENA);
await espera('[2] ajeno no pone términos con una figura de Brújula', 'ajeno', afecta(`insert into terminos (campana_id, figura_id, texto) values ('camp-ajena', 'machado', 'x')`), rechaza, AJENA);
await espera('[2] ajeno no crea métricas ni alertas con una figura de Brújula', 'ajeno', async (c) => {
  let rechazos = 0;
  for (const sql of [`insert into figura_metricas (campana_id, figura_id) values ('camp-ajena', 'machado')`,
    `insert into alertas (campana_id, texto, figura_id) values ('camp-ajena', 'x', 'machado')`,
    `insert into narrativas (campana_id, nombre, figura_id) values ('camp-ajena', 'x', 'machado')`,
    `insert into menciones (campana_id, canal, figura_id) values ('camp-ajena', 'X', 'machado')`]) {
    await c.query('savepoint s');
    try { await c.query(sql); } catch { rechazos++; }
    await c.query('rollback to savepoint s');
  }
  return rechazos;
}, n(4), AJENA);
await espera('[2] ajeno no fija una figura de Brújula como propia', 'ajeno', afecta(`update campanas set figura_propia_id = 'machado' where id = 'camp-ajena'`), rechaza, AJENA);
await espera('[2] admin no fija una figura de otro equipo como propia', 'admin', afecta(`update campanas set figura_propia_id = 'fig-ajena' where id = 'presidenciales'`), rechaza, AJENA);
await espera('[2] ajeno no lee una figura de Brújula aunque exista un vínculo cruzado', 'ajeno', cuenta(`select 1 from figuras where id = 'machado'`), n(0),
  `${AJENA} set local session_replication_role = replica; insert into campana_figuras (campana_id, figura_id) values ('camp-ajena', 'machado'); set local session_replication_role = origin;`);
await espera('[2] el dueño tampoco cruza figuras entre equipos', 'base', afecta(`insert into campana_figuras (campana_id, figura_id) values ('camp-ajena', 'machado')`), rechaza, AJENA);
await espera('[2] analista no liga una alerta a un evento de Zulia', 'analista', afecta(`insert into alertas (campana_id, texto, evento_id) values ('presidenciales', 'x', 'zulia-recorrido')`), rechaza);
await espera('[2] analista no asigna una alerta a alguien de otro equipo', 'analista', afecta(`update alertas set responsable_id = 'rig-ajeno' where id = 'pres-alerta-1'`), rechaza);
await espera('[2] analista sí asigna una alerta a alguien del equipo', 'analista', afecta(`update alertas set responsable_id = 'andrea' where id = 'pres-alerta-1'`), n(1));

// 3 y 4. Enlace de cuentas: solo con correo confirmado, solo personas sin cuenta, una sola, sin fallar.
const enlazadas = (email) => uno(`select string_agg(id, ',' order by id) from personas where lower(email) = lower('${email}') and user_id is not null`);
await espera('[4] cuenta sin confirmar no se enlaza con la persona', 'base', async (c) => {
  await c.query(`insert into auth.users (id, email, clave) values ('00000000-0000-4000-8000-0000000000a1', 'sinconfirmar@rig.test', 'x')`);
  return enlazadas('sinconfirmar@rig.test')(c);
}, vale(null), `insert into personas (id, org_id, nombre, email) values ('p-sinconf', 'brujula', 'Sin confirmar', 'sinconfirmar@rig.test')`);
await espera('[4] al confirmar el correo, la cuenta se enlaza', 'base', async (c) => {
  await c.query(`insert into auth.users (id, email, clave) values ('00000000-0000-4000-8000-0000000000a2', 'confirma@rig.test', 'x')`);
  await c.query(`update auth.users set email_confirmed_at = now() where id = '00000000-0000-4000-8000-0000000000a2'`);
  return enlazadas('confirma@rig.test')(c);
}, vale('p-confirma'), `insert into personas (id, org_id, nombre, email) values ('p-confirma', 'brujula', 'Confirma', 'confirma@rig.test')`);
await espera('[3] mismo correo en dos equipos: se enlaza solo la persona más antigua y no falla', 'base', async (c) => {
  await c.query(`insert into auth.users (id, email, clave, email_confirmed_at) values ('00000000-0000-4000-8000-0000000000a3', 'doble@rig.test', 'x', now())`);
  return enlazadas('doble@rig.test')(c);
}, vale('p-doble-1'), `insert into personas (id, org_id, nombre, email, creada_en) values ('p-doble-1', 'brujula', 'Doble', 'doble@rig.test', now() - interval '1 day'), ('p-doble-2', 'otra-org', 'Doble', 'Doble@rig.test', now())`);
await espera('[3] una persona ya enlazada no se reasigna a otra cuenta', 'base', async (c) => {
  await c.query(`insert into auth.users (id, email, clave, email_confirmed_at) values ('00000000-0000-4000-8000-0000000000a4', 'ANALISTA@rig.TEST', 'x', now())`);
  return uno(`select user_id::text from personas where id = 'rig-analista'`)(c);
}, vale(U.analista), `alter table auth.users drop constraint if exists users_email_key`);

// 5. Directorio de figuras: solo quien administra el equipo o tiene Administración/Análisis en una campaña.
await espera('[5] lector no crea figuras en el directorio', 'lector', afecta(`insert into figuras (org_id, nombre) values ('brujula', 'x')`), rechaza);
await espera('[5] lector no cambia figuras del directorio', 'lector', afecta(`update figuras set nombre = 'x' where id = 'machado'`), n(0));
await espera('[5] analista sí crea figuras en el directorio', 'analista', afecta(`insert into figuras (org_id, nombre) values ('brujula', 'x')`), n(1));

// 6. Altas de personas: quien no administra el equipo solo da de alta externos, y un externo no tiene Administración ni Análisis.
const campAnalista = JSON.stringify({ org_id: 'brujula', campana: { nombre: 'Campaña del analista' } });
await espera('[6] admin de campaña (no del equipo) no da Análisis a alguien nuevo', 'analista', async (c) => {
  const id = (await c.query('select crear_campana($1::jsonb) as id', [campAnalista])).rows[0].id;
  return (await c.query(`select invitar_persona($1, 'Nuevo', 'nuevo-analista@rig.test', 'Análisis')`, [id])).rowCount;
}, rechaza);
await espera('[6] admin de campaña (no del equipo) da Solo lectura y la persona queda externa', 'analista', async (c) => {
  const id = (await c.query('select crear_campana($1::jsonb) as id', [campAnalista])).rows[0].id;
  const p = (await c.query(`select invitar_persona($1, 'Nuevo', 'nuevo-lector@rig.test', 'Solo lectura') as p`, [id])).rows[0].p;
  return (await c.query(`select rol_org from personas where id = $1`, [p])).rows[0]?.rol_org ?? 'invisible';
}, (r) => r.ok && (r.valor === 'externo' || r.valor === 'invisible'));
await espera('[6] admin del equipo sí da Análisis y la persona queda interna', 'admin', async (c) => {
  const p = (await c.query(`select invitar_persona('presidenciales', 'Nueva', 'nueva-interna@rig.test', 'Análisis') as p`)).rows[0].p;
  return (await c.query(`select rol_org from personas where id = $1`, [p])).rows[0].rol_org;
}, vale('miembro'));
await espera('[6] un externo no recibe Análisis', 'admin', afecta(`update miembros_campana set rol = 'Análisis' where persona_id = 'rig-cliente' and campana_id = 'presidenciales'`), rechaza);
await espera('[6] un externo no recibe Administración por invitación', 'admin', async (c) => (await c.query(`select invitar_persona('presidenciales', 'x', 'cliente@rig.test', 'Administración')`)).rowCount, rechaza);
await espera('[6] crear_campana de un analista no da Análisis a alguien nuevo', 'analista', async (c) =>
  (await c.query('select crear_campana($1::jsonb)', [JSON.stringify({ org_id: 'brujula', campana: { nombre: 'C' }, equipo: [{ nombre: 'N', email: 'n-analisis@rig.test', rol: 'Análisis' }] })])).rowCount, rechaza);

// 7. menciones.url solo http(s).
await espera('[7] url javascript: se rechaza', 'analista', afecta(`update menciones set url = 'javascript:alert(1)' where id = 'pres-mencion-1'`), rechaza);
await espera('[7] url data: se rechaza al dar de alta', 'analista', afecta(`insert into menciones (campana_id, canal, url) values ('presidenciales', 'X', 'data:text/html,x')`), rechaza);
await espera('[7] url https se acepta', 'analista', afecta(`update menciones set url = 'https://ejemplo.test/a' where id = 'pres-mencion-1'`), n(1));

// 8. Lo que se cree después en public no queda abierto a anon ni a public.
await espera('[8] anónimo no lee una tabla nueva', 'anon', cuenta('select 1 from zz_nueva'), rechaza, `create table public.zz_nueva (x int); insert into public.zz_nueva values (1)`);
await espera('[8] anónimo no ejecuta una función nueva', 'anon', uno('select zz_fn()'), rechaza, `create function public.zz_fn() returns int language sql as 'select 1'`);
await espera('[8] 900 es idempotente: correrla dos veces no falla', 'base', async (c) => { await c.query(fs.readFileSync('supabase/migrations/900_acceso.sql', 'utf8')); return 1; }, n(1));

// 9. Autor, quien revisa y quien aprueba son la persona de la sesión.
await espera('[9] nota interna firmada por otra persona queda a nombre de quien la escribe', 'analista', async (c) =>
  (await c.query(`insert into notas_internas (campana_id, entidad, entidad_id, texto, autor_id) values ('presidenciales', 'figura', 'machado', 'x', 'lucia') returning autor_id`)).rows[0].autor_id, vale('rig-analista'));
await espera('[9] actividad de alerta a nombre de otra persona queda a nombre de quien la escribe', 'analista', async (c) =>
  (await c.query(`insert into alerta_actividad (campana_id, alerta_id, texto, persona_id) values ('presidenciales', 'pres-alerta-1', 'x', 'lucia') returning persona_id`)).rows[0].persona_id, vale('rig-analista'));
await espera('[9] revisada_por de otra persona queda a nombre de quien revisa', 'analista', async (c) =>
  (await c.query(`update menciones set revisada = true, revisada_por = 'lucia' where id = 'pres-mencion-1' returning revisada_por`)).rows[0].revisada_por, vale('rig-analista'));
await espera('[9] aprobado_por de otra persona queda a nombre de quien aprueba', 'analista', async (c) =>
  (await c.query(`update reporte_envios set aprobado_por = 'lucia' where id = (select id from reporte_envios where campana_id = 'presidenciales' limit 1) returning aprobado_por`)).rows[0].aprobado_por, vale('rig-analista'));

// 10. Miembros: solo personas del equipo de la campaña.
await espera('[10] admin no agrega a alguien de otro equipo', 'admin', afecta(`insert into miembros_campana (campana_id, persona_id, rol) values ('presidenciales', 'rig-ajeno', 'Solo lectura')`), rechaza);
await espera('[10] admin no cambia un miembro por alguien de otro equipo', 'admin', afecta(`update miembros_campana set persona_id = 'rig-ajeno' where persona_id = 'rig-lector' and campana_id = 'zulia'`), rechaza);

// 11. crear_campana valida correos y reutiliza personas por correo.
await espera('[11] crear_campana rechaza un correo mal formado', 'admin', async (c) =>
  (await c.query('select crear_campana($1::jsonb)', [JSON.stringify({ org_id: 'brujula', campana: { nombre: 'C' }, equipo: [{ nombre: 'N', email: 'no es correo', rol: 'Cliente' }] })])).rowCount, rechaza);
await espera('[11] crear_campana rechaza un rol fuera del vocabulario', 'admin', async (c) =>
  (await c.query('select crear_campana($1::jsonb)', [JSON.stringify({ org_id: 'brujula', campana: { nombre: 'C' }, equipo: [{ persona_id: 'andrea', rol: 'Dueño' }] })])).rowCount, rechaza);
await espera('[11] crear_campana reutiliza la persona con ese correo', 'admin', async (c) => {
  const id = (await c.query('select crear_campana($1::jsonb) as id', [JSON.stringify({ org_id: 'brujula', campana: { nombre: 'C' }, equipo: [{ nombre: 'Otro nombre', email: ' LECTOR@rig.test ', rol: 'Solo lectura' }] })])).rows[0].id;
  return JSON.stringify((await c.query(`select (select count(*)::int from personas where lower(email) = 'lector@rig.test') as n,
    (select string_agg(persona_id, ',') from miembros_campana where campana_id = $1 and persona_id <> 'rig-admin') as m`, [id])).rows[0]);
}, vale(JSON.stringify({ n: 1, m: 'rig-lector' })));
await espera('[11] invitar_persona rechaza un correo mal formado', 'admin', async (c) => (await c.query(`select invitar_persona('presidenciales', 'x', 'x@', 'Cliente')`)).rowCount, rechaza);

// 12. Funciones de escritura en una transacción: agregar_figura, cambiar_alerta, usar_plantilla.
const figNueva = JSON.stringify({ campana_id: 'presidenciales', relacion: 'Rival', persona_publica: true, notas: 'vigilar',
  nueva: { nombre: 'Figura RPC', cargo: 'Diputada' }, terminos: [{ texto: 'Figura RPC', tipo: 'Nombre' }, { texto: '#RPC', tipo: 'Hashtag' }] });
await espera('[12] agregar_figura crea figura, vínculo, términos y nota de una vez', 'analista', async (c) => {
  const id = (await c.query('select agregar_figura($1::jsonb) as id', [figNueva])).rows[0].id;
  return JSON.stringify((await c.query(`select (select org_id from figuras where id = $1) as org,
    (select relacion from campana_figuras where figura_id = $1 and campana_id = 'presidenciales') as rel,
    (select count(*)::int from terminos where figura_id = $1) as terminos,
    (select autor_id from notas_internas where entidad_id = $1) as autor`, [id])).rows[0]);
}, vale(JSON.stringify({ org: 'brujula', rel: 'Rival', terminos: 2, autor: 'rig-analista' })));
await espera('[12] agregar_figura vincula una figura del directorio con su nombre como término', 'analista', async (c) => {
  const id = (await c.query('select agregar_figura($1::jsonb) as id', [JSON.stringify({ campana_id: 'presidenciales', figura_id: 'caldera', relacion: 'A observar' })])).rows[0].id;
  return (await c.query(`select count(*)::int as n from terminos where figura_id = $1 and campana_id = 'presidenciales' and tipo = 'Nombre'`, [id])).rows[0].n;
}, (r) => r.ok && r.valor >= 1);
await espera('[12] agregar_figura sin confirmar persona pública se rechaza', 'analista', async (c) => (await c.query('select agregar_figura($1::jsonb)', [JSON.stringify({ ...JSON.parse(figNueva), persona_publica: false })])).rowCount, rechaza);
await espera('[12] agregar_figura con figura de otro equipo se rechaza', 'analista', async (c) => (await c.query('select agregar_figura($1::jsonb)', [JSON.stringify({ campana_id: 'presidenciales', figura_id: 'fig-ajena', relacion: 'Rival' })])).rowCount, rechaza, AJENA);
await espera('[12] agregar_figura: lector no puede', 'lector', async (c) => (await c.query('select agregar_figura($1::jsonb)', [figNueva])).rowCount, rechaza);
await espera('[12] agregar_figura: cliente no puede', 'cliente', async (c) => (await c.query('select agregar_figura($1::jsonb)', [figNueva])).rowCount, rechaza);
await espera('[12] agregar_figura: ajeno no puede', 'ajeno', async (c) => (await c.query('select agregar_figura($1::jsonb)', [figNueva])).rowCount, rechaza);
await espera('[12] cambiar_alerta cambia el estado y deja la actividad firmada', 'analista', async (c) => {
  const id = (await c.query(`select cambiar_alerta('pres-alerta-1', '{"estado":"Resuelta","motivo_cierre":"ok"}'::jsonb, 'resolvió la alerta') as id`)).rows[0].id;
  return JSON.stringify((await c.query(`select (select estado from alertas where id = 'pres-alerta-1') as estado, (select persona_id from alerta_actividad where id = $1) as quien`, [id])).rows[0]);
}, vale(JSON.stringify({ estado: 'Resuelta', quien: 'rig-analista' })));
await espera('[12] cambiar_alerta con nota guarda nota y actividad', 'analista', async (c) => {
  await c.query(`select cambiar_alerta('pres-alerta-1', '{}'::jsonb, 'agregó una nota interna', 'nota rpc')`);
  return (await c.query(`select count(*)::int as n from notas_internas where entidad_id = 'pres-alerta-1' and texto = 'nota rpc' and autor_id = 'rig-analista'`)).rows[0].n;
}, n(1));
await espera('[12] cambiar_alerta no cambia columnas fuera de la lista', 'analista', async (c) => (await c.query(`select cambiar_alerta('pres-alerta-1', '{"texto":"x"}'::jsonb, 'x')`)).rowCount, rechaza);
await espera('[12] cambiar_alerta: lector no puede', 'lector', async (c) => (await c.query(`select cambiar_alerta('pres-alerta-1', '{"estado":"Resuelta"}'::jsonb, 'x')`)).rowCount, rechaza);
await espera('[12] cambiar_alerta: cliente no puede', 'cliente', async (c) => (await c.query(`select cambiar_alerta('pres-alerta-1', '{}'::jsonb, 'x')`)).rowCount, rechaza);
await espera('[12] cambiar_alerta: ajeno no puede', 'ajeno', async (c) => (await c.query(`select cambiar_alerta('pres-alerta-1', '{}'::jsonb, 'x')`)).rowCount, rechaza);
await espera('[12] usar_plantilla suma un uso', 'analista', async (c) => {
  const antes = (await c.query(`select usos from reporte_plantillas where id = 'pres-plantilla-diario'`)).rows[0].usos;
  const despues = (await c.query(`select usar_plantilla('pres-plantilla-diario') as u`)).rows[0].u;
  return despues - antes;
}, n(1));
await espera('[12] usar_plantilla: lector no puede', 'lector', async (c) => (await c.query(`select usar_plantilla('pres-plantilla-diario')`)).rowCount, rechaza);

// 13. personas.user_id no se lee desde la app (mi_contexto y las columnas visibles siguen funcionando).
await espera('[13] analista no lee personas.user_id', 'analista', cuenta('select user_id from personas'), rechaza);
await espera('[13] select * de personas se rechaza (la app pide columnas)', 'analista', cuenta('select * from personas'), rechaza);
await espera('[13] analista lee las columnas visibles de personas', 'analista', cuenta('select id, org_id, nombre, nombre_corto, iniciales, email, puesto, rol_org, activa, extra, creada_en from personas'), alguno);
await espera('[13] nadie filtra personas por user_id', 'admin', cuenta(`select id from personas where user_id is not null`), rechaza);

// ====================================================================
// Informe (100_informe.sql y 860_informe.sql): filas crudas solo para el equipo interno; informe_datos para todo miembro.
// ====================================================================
const INF = `insert into autores (id, campana_id, canal, handle, seguidores) values ('pa-autor', 'presidenciales', 'X', '@persona_prueba', 50);
  insert into ejes (id, campana_id, nombre) values ('pa-eje', 'presidenciales', 'Eje de prueba');
  insert into recolecciones (id, campana_id, canal) values ('pa-recol', 'presidenciales', 'X');
  insert into codigos (id, campana_id, nombre) values ('pa-codigo', 'presidenciales', 'Código de prueba');
  insert into muestras (id, campana_id, nombre) values ('pa-muestra', 'presidenciales', 'Muestra de prueba');
  insert into mencion_ejes (campana_id, mencion_id, eje_id) values ('presidenciales', 'pres-mencion-1', 'pa-eje');
  insert into comentarios (id, campana_id, mencion_id, canal, publicada_en, texto) values ('pa-com', 'presidenciales', 'pres-mencion-1', 'X', now(), 'texto de un tercero');
  insert into codificaciones (campana_id, muestra_id, comentario_id, sentimiento) values ('presidenciales', 'pa-muestra', 'pa-com', 'Neutral');
  update menciones set autor_id = 'pa-autor' where id = 'pres-mencion-1';
  insert into reportes (id, campana_id, nombre, tipo, extra) values ('pa-informe', 'presidenciales', 'Informe de prueba', 'Informe',
    '{"informe": {"modo": "evento", "periodo_inicio": "2027-04-14", "periodo_fin": "2027-05-13", "eje_conversacion": "pa-eje", "eje_foco": "pa-eje"}}');`;
const CRUDAS = ['autores', 'comentarios', 'codificaciones', 'recolecciones'];
const ABIERTAS = ['ejes', 'mencion_ejes', 'codigos', 'muestras'];
for (const t of CRUDAS) {
  await espera(`[inf] lector lee ${t}`, 'lector', cuenta(`select 1 from ${t}`), alguno, INF);
  await espera(`[inf] cliente NO lee ${t}`, 'cliente', cuenta(`select 1 from ${t}`), n(0), INF);
}
for (const t of [...CRUDAS, ...ABIERTAS]) await espera(`[inf] ajeno no ve ${t}`, 'ajeno', cuenta(`select 1 from ${t}`), n(0), INF);
for (const t of ABIERTAS) await espera(`[inf] cliente lee ${t}`, 'cliente', cuenta(`select 1 from ${t}`), alguno, INF);
await espera('[inf] anónimo no lee autores', 'anon', cuenta('select 1 from autores'), nada, INF);
const altasInf = {
  autores: `insert into autores (campana_id, canal, handle) values ('presidenciales', 'X', '@otra')`,
  comentarios: `insert into comentarios (campana_id, mencion_id, canal) values ('presidenciales', 'pres-mencion-1', 'X')`,
  recolecciones: `insert into recolecciones (campana_id, canal, metodo) values ('presidenciales', 'X', 'RSS')`,
  codificaciones: `insert into codificaciones (campana_id, muestra_id, mencion_id, sentimiento) values ('presidenciales', 'pa-muestra', 'pres-mencion-1', 'Favorable')`,
  ejes: `insert into ejes (campana_id, nombre) values ('presidenciales', 'Otro eje')`,
  mencion_ejes: `insert into mencion_ejes (campana_id, mencion_id, eje_id, metodo) values ('presidenciales', 'pres-mencion-2', 'pa-eje', 'Manual')`,
};
for (const [t, sql] of Object.entries(altasInf)) {
  await espera(`[inf] analista escribe ${t}`, 'analista', afecta(sql), n(1), INF);
  await espera(`[inf] lector no escribe ${t}`, 'lector', afecta(sql), rechaza, INF);
  await espera(`[inf] cliente no escribe ${t}`, 'cliente', afecta(sql), rechaza, INF);
}
await espera('[inf] lector no cambia ni borra autores', 'lector', async (c) =>
  (await c.query(`update autores set seguidores = 1 where id = 'pa-autor'`)).rowCount + (await c.query(`delete from autores where id = 'pa-autor'`)).rowCount, n(0), INF);
await espera('[inf] analista no escribe autores en Zulia', 'analista', afecta(`insert into autores (campana_id, canal, handle) values ('zulia', 'X', '@z')`), rechaza, INF);
// Referencias entre campañas: ni ejes, ni autores, ni muestras de otra campaña.
const ZULIA_INF = `${INF} insert into ejes (id, campana_id, nombre) values ('pa-eje-zulia', 'zulia', 'Eje de Zulia');
  insert into autores (id, campana_id, canal, handle) values ('pa-autor-zulia', 'zulia', 'X', '@z');
  insert into muestras (id, campana_id, nombre) values ('pa-muestra-zulia', 'zulia', 'Muestra de Zulia');`;
await espera('[inf] analista no liga una mención a un eje de Zulia', 'analista', afecta(`insert into mencion_ejes (campana_id, mencion_id, eje_id) values ('presidenciales', 'pres-mencion-2', 'pa-eje-zulia')`), rechaza, ZULIA_INF);
await espera('[inf] analista no pone un autor de Zulia en una mención', 'analista', afecta(`update menciones set autor_id = 'pa-autor-zulia' where id = 'pres-mencion-2'`), rechaza, ZULIA_INF);
await espera('[inf] el dueño tampoco liga una codificación a una muestra de Zulia', 'base', afecta(`insert into codificaciones (campana_id, muestra_id, comentario_id, sentimiento) values ('presidenciales', 'pa-muestra-zulia', 'pa-com', 'Neutral')`), rechaza, ZULIA_INF);
// Vocabularios.
await espera('[inf] formato fuera del vocabulario se rechaza', 'analista', afecta(`update menciones set formato = 'Podcast' where id = 'pres-mencion-1'`), rechaza);
await espera('[inf] codificación sin ítem o con dos ítems se rechaza', 'analista', async (c) => {
  let rechazos = 0;
  for (const sql of [`insert into codificaciones (campana_id, muestra_id, sentimiento) values ('presidenciales', 'pa-muestra', 'Neutral')`,
    `insert into codificaciones (campana_id, muestra_id, mencion_id, comentario_id) values ('presidenciales', 'pa-muestra', 'pres-mencion-1', 'pa-com')`]) {
    await c.query('savepoint s');
    try { await c.query(sql); } catch { rechazos++; }
    await c.query('rollback to savepoint s');
  }
  return rechazos;
}, n(2), INF);
// informe_datos: lo reciben los miembros (también Cliente, sin filas crudas), nunca un ajeno.
const informe = uno(`select informe_datos('pa-informe')`);
await espera('[inf] cliente recibe informe_datos de su campaña', 'cliente', informe, (r) => r.ok && r.valor?.reporte?.id === 'pa-informe', INF);
await espera('[inf] lector recibe informe_datos', 'lector', informe, (r) => r.ok && r.valor?.campana?.id === 'presidenciales', INF);
await espera('[inf] ajeno recibe null de informe_datos', 'ajeno', informe, vale(null), INF);
await espera('[inf] anónimo no ejecuta informe_datos', 'anon', informe, (r) => !r.ok || r.valor == null, INF);
await espera('[inf] informe_datos no muestra la cuenta chica ni el texto de comentarios al cliente', 'cliente', async (c) => {
  const d = (await c.query(`select informe_datos('pa-informe')::text as t`)).rows[0].t;
  return [d.includes('persona_prueba'), d.includes('texto de un tercero'), JSON.parse(d).series.conversacion.total.reduce((a, b) => a + b, 0)];
}, (r) => r.ok && r.valor[0] === false && r.valor[1] === false && r.valor[2] >= 1, INF);
// Informe de ejemplo sembrado (campaña informe-ejemplo): el cliente lo recibe sin cuentas chicas ni textos de comentarios.
await espera('[inf] cliente recibe el Informe de ejemplo sin cuentas personales ni comentarios', 'cliente', async (c) => {
  const d = (await c.query(`select informe_datos('inf-rep-evento')::text as t`)).rows[0].t;
  return [JSON.parse(d).reporte.id, /cuenta_personal_|Comentario de ejemplo/.test(d)];
}, (r) => r.ok && r.valor[0] === 'inf-rep-evento' && r.valor[1] === false);
await espera('[inf] ajeno recibe null del Informe de ejemplo', 'ajeno', uno(`select informe_datos('inf-rep-tema')`), vale(null));
await espera('[inf] cliente no lee comentarios crudos del Informe de ejemplo', 'cliente', cuenta(`select 1 from comentarios where campana_id = 'informe-ejemplo'`), n(0));
await espera('[inf] lector no cambia el Informe de ejemplo', 'lector', afecta(`update reportes set nombre = 'x' where id = 'inf-rep-evento'`), n(0));
await espera('[inf] 860 es re-ejecutable y deja el permiso', 'base', async (c) => {
  await c.query(fs.readFileSync('supabase/migrations/860_informe.sql', 'utf8'));
  return (await c.query(`select has_function_privilege('authenticated', 'public.informe_datos(text)', 'execute') and not has_function_privilege('anon', 'public.informe_datos(text)', 'execute') as ok`)).rows[0].ok;
}, vale(true));

console.log(`\n${casos - fallas} de ${casos} casos pasan.`);
await pool.end();
process.exit(fallas ? 1 : 0);
