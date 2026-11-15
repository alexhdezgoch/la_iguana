// Prueba de reglas de acceso contra la base local. Uso: node rig/prueba-acceso.mjs (después de bash rig/reset.sh)
// Cada caso corre en una transacción que se revierte: no deja datos.
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

/** Corre `fn` como `quien` (o como anónimo) y revierte. Devuelve { ok, valor | error }. */
async function como(quien, fn) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    if (quien === 'anon') await c.query('set local role anon');
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

async function espera(nombre, quien, fn, cond) {
  casos++;
  const r = await como(quien, fn);
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
await espera('admin ve las 4 campañas del equipo', 'admin', cuenta('select 1 from campanas'), n(4));
await espera('admin ve la vista de resumen', 'admin', cuenta('select 1 from v_campanas_resumen'), n(4));
await espera('analista ve solo presidenciales', 'analista', cuenta('select 1 from campanas'), n(1));
await espera('analista no ve figuras vinculadas de Zulia', 'analista', cuenta(`select 1 from campana_figuras where campana_id = 'zulia'`), n(0));
await espera('analista ve el directorio de figuras del equipo', 'analista', cuenta('select 1 from figuras'), n(10));
await espera('cliente ve solo las figuras de su campaña', 'cliente', cuenta('select 1 from figuras'), n(8));
await espera('cliente ve alertas de su campaña', 'cliente', cuenta('select 1 from alertas'), alguno);
await espera('cliente solo se ve a sí mismo en personas', 'cliente', cuenta('select 1 from personas'), n(1));

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
await espera('cliente no crea campañas', 'cliente', async (c) => (await c.query('select crear_campana($1::jsonb)', [nueva])).rowCount, rechaza);
await espera('ajeno no crea campañas en Brújula', 'ajeno', async (c) => (await c.query('select crear_campana($1::jsonb)', [nueva])).rowCount, rechaza);
await espera('analista no invita personas', 'analista', async (c) => (await c.query(`select invitar_persona('presidenciales', 'X', 'x@x.test', 'Cliente')`)).rowCount, rechaza);
await espera('admin invita un cliente', 'admin', async (c) => {
  await c.query(`select invitar_persona('presidenciales', 'Cliente X', 'x@x.test', 'Cliente')`);
  return (await c.query(`select 1 from miembros_campana m join personas p on p.id = m.persona_id where p.email = 'x@x.test' and m.rol = 'Cliente' and p.rol_org = 'externo'`)).rows.length;
}, n(1));
await espera('mi_contexto devuelve persona y equipo', 'analista', async (c) => (await c.query('select mi_contexto() as r')).rows[0].r?.org?.id, (r) => r.ok && r.valor === 'brujula');
await espera('mi_contexto vacío para anónimo', 'anon', async (c) => (await c.query('select mi_contexto() as r')).rows[0].r, (r) => !r.ok || r.valor == null);

console.log(`\n${casos - fallas} de ${casos} casos pasan.`);
await pool.end();
process.exit(fallas ? 1 : 0);
