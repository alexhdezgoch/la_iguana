// Banco de pruebas local: habla lo suficiente del protocolo de Supabase (REST + auth) para que la app corra
// contra un Postgres real con las mismas restricciones y reglas de acceso que tendrá en producción.
// No es PostgREST: cubre solo lo que usa src/lib/db.ts. Uso: node rig/servidor.mjs  (puerto 54321)
import http from 'node:http';
import crypto from 'node:crypto';
import pg from 'pg';

const PUERTO = Number(process.env.RIG_PORT ?? 54321);
const SECRETO = 'rig-secreto-local';
const pool = new pg.Pool({ connectionString: process.env.RIG_DB ?? 'postgres://rig:rig@127.0.0.1:5432/iguana', max: 10 });
const MAX_FILAS = 1000; // igual que el tope por defecto de Supabase

const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
function firmar(payload) {
  const cuerpo = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}`;
  return `${cuerpo}.${crypto.createHmac('sha256', SECRETO).update(cuerpo).digest('base64url')}`;
}
function leerJwt(t) {
  if (!t) return null;
  const [h, p, f] = t.split('.');
  if (!f) return null;
  const ok = crypto.createHmac('sha256', SECRETO).update(`${h}.${p}`).digest('base64url') === f;
  if (!ok) return null;
  try { return JSON.parse(Buffer.from(p, 'base64url').toString()); } catch { return null; }
}
export const CLAVE_ANON = firmar({ role: 'anon', iss: 'rig', exp: 4102444800 });

const ident = (s) => { if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw err(400, 'PGRST100', `Identificador no válido: ${s}`); return `"${s}"`; };
function err(status, code, message, details = null) { return Object.assign(new Error(message), { status, code, details }); }

function sesionDe(usuario) {
  const ahora = Math.floor(Date.now() / 1000);
  const access_token = firmar({ sub: usuario.id, email: usuario.email, role: 'authenticated', aud: 'authenticated', exp: ahora + 3600, iat: ahora });
  const user = { id: usuario.id, aud: 'authenticated', role: 'authenticated', email: usuario.email, app_metadata: {}, user_metadata: {}, created_at: usuario.created_at };
  return { access_token, token_type: 'bearer', expires_in: 3600, expires_at: ahora + 3600, refresh_token: firmar({ sub: usuario.id, r: 1, exp: ahora + 86400 * 30 }), user };
}

async function auth(req, url, cuerpo) {
  const ruta = url.pathname.replace('/auth/v1', '');
  if (ruta === '/token' && req.method === 'POST') {
    const tipo = url.searchParams.get('grant_type');
    if (tipo === 'password') {
      const { rows } = await pool.query('select id, email, created_at from auth.users where lower(email) = lower($1) and clave = $2', [cuerpo.email ?? '', cuerpo.password ?? '']);
      if (!rows.length) return [400, { error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials', message: 'Invalid login credentials' }];
      return [200, sesionDe(rows[0])];
    }
    if (tipo === 'refresh_token') {
      const p = leerJwt(cuerpo.refresh_token);
      const { rows } = p ? await pool.query('select id, email, created_at from auth.users where id = $1', [p.sub]) : { rows: [] };
      if (!rows.length) return [400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token' }];
      return [200, sesionDe(rows[0])];
    }
  }
  if (ruta === '/user' && req.method === 'GET') {
    const p = leerJwt((req.headers.authorization ?? '').replace(/^Bearer /, ''));
    if (!p?.sub) return [401, { message: 'No autorizado' }];
    const { rows } = await pool.query('select id, email, created_at from auth.users where id = $1', [p.sub]);
    return rows.length ? [200, sesionDe(rows[0]).user] : [401, { message: 'No autorizado' }];
  }
  if (ruta === '/logout') return [204, null];
  if (ruta === '/signup') return [422, { msg: 'Signups not allowed for this instance', message: 'Signups not allowed for this instance' }];
  return [404, { message: 'No existe' }];
}

const OPS = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'like', ilike: 'ilike' };
function filtro(col, expr, params) {
  let niega = false;
  if (expr.startsWith('not.')) { niega = true; expr = expr.slice(4); }
  const i = expr.indexOf('.');
  const op = expr.slice(0, i), val = expr.slice(i + 1);
  let sql;
  if (op === 'is') {
    if (!['null', 'true', 'false'].includes(val)) throw err(400, 'PGRST100', `is.${val} no válido`);
    sql = `${ident(col)} is ${val}`;
  } else if (op === 'in') {
    const lista = val.replace(/^\(|\)$/g, '').match(/"(?:[^"\\]|\\.)*"|[^,]+/g)?.map((v) => v.replace(/^"|"$/g, '').replace(/\\(.)/g, '$1')) ?? [];
    params.push(lista);
    sql = `${ident(col)}::text = any($${params.length}::text[])`;
  } else if (op === 'cs') {
    params.push(val);
    sql = `${ident(col)} @> $${params.length}`;
  } else if (OPS[op]) {
    params.push(op === 'like' || op === 'ilike' ? val.replace(/\*/g, '%') : val);
    sql = `${ident(col)} ${OPS[op]} $${params.length}`;
  } else throw err(400, 'PGRST100', `Operador no soportado en el banco de pruebas: ${op}`);
  return niega ? `not (${sql})` : sql;
}
function donde(url, params) {
  const partes = [];
  for (const [k, v] of url.searchParams) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue;
    partes.push(filtro(k, v, params));
  }
  return partes.length ? ' where ' + partes.join(' and ') : '';
}
function orden(url) {
  const o = url.searchParams.get('order');
  if (!o) return '';
  return ' order by ' + o.split(',').map((p) => {
    const [col, ...mods] = p.split('.');
    const dir = mods.includes('desc') ? 'desc' : 'asc';
    const nulos = mods.includes('nullsfirst') ? 'nulls first' : mods.includes('nullslast') ? 'nulls last' : dir === 'desc' ? 'nulls first' : 'nulls last';
    return `${ident(col)} ${dir} ${nulos}`;
  }).join(', ');
}

// Postgres arma el JSON, igual que la API real: fechas como 'AAAA-MM-DD', bigint como número.
async function json(cli, sql, params) {
  const { rows } = await cli.query(`with q as (${sql}) select coalesce(json_agg(q), '[]')::text as j from q`, params);
  return JSON.parse(rows[0].j);
}

async function rest(req, url, cuerpo, cli) {
  const partes = url.pathname.replace('/rest/v1/', '').split('/');
  const prefer = req.headers.prefer ?? '';
  const quiereObjeto = (req.headers.accept ?? '').includes('vnd.pgrst.object');
  const extra = {};

  if (partes[0] === 'rpc') {
    const fn = ident(partes[1]);
    const args = cuerpo ?? {};
    const claves = Object.keys(args);
    const vals = claves.map((k) => (args[k] !== null && typeof args[k] === 'object' ? JSON.stringify(args[k]) : args[k]));
    const { rows } = await cli.query(`select to_json(public.${fn}(${claves.map((k, i) => `${ident(k)} => $${i + 1}`).join(', ')}))::text as j`, vals);
    return [200, JSON.parse(rows[0]?.j ?? 'null'), extra];
  }

  const tabla = `public.${ident(partes[0])}`;
  const params = [];
  let filas;
  if (req.method === 'GET' || req.method === 'HEAD') {
    const w = donde(url, params);
    if (prefer.includes('count=exact')) {
      const c = await cli.query(`select count(*)::int as n from ${tabla}${w}`, params);
      extra['Content-Range'] = `*/${c.rows[0].n}`;
    }
    if (req.method === 'HEAD') return [200, null, extra];
    const lim = Math.min(Number(url.searchParams.get('limit') ?? MAX_FILAS), MAX_FILAS);
    const off = Number(url.searchParams.get('offset') ?? 0);
    filas = await json(cli, `select * from ${tabla}${w}${orden(url)} limit ${lim} offset ${off}`, params);
  } else if (req.method === 'POST') {
    const lista = Array.isArray(cuerpo) ? cuerpo : [cuerpo];
    const cols = [...new Set(lista.flatMap((f) => Object.keys(f)))].map(ident).join(', ');
    if (!cols) throw err(400, 'PGRST102', 'Cuerpo vacío');
    filas = await json(cli, `insert into ${tabla} (${cols}) select ${cols} from jsonb_populate_recordset(null::${tabla}, $1::jsonb) returning *`, [JSON.stringify(lista)]);
  } else if (req.method === 'PATCH') {
    const cols = Object.keys(cuerpo ?? {}).map(ident).join(', ');
    if (!cols) throw err(400, 'PGRST102', 'Cuerpo vacío');
    params.push(JSON.stringify(cuerpo));
    const w = donde(url, params);
    filas = await json(cli, `update ${tabla} set (${cols}) = (select ${cols} from jsonb_populate_record(null::${tabla}, $1::jsonb))${w} returning *`, params);
  } else if (req.method === 'DELETE') {
    const w = donde(url, params);
    if (!w) throw err(400, '21000', 'DELETE requiere un filtro');
    filas = await json(cli, `delete from ${tabla}${w} returning *`, params);
  } else throw err(405, 'PGRST000', 'Método no soportado');

  if (quiereObjeto) {
    if (filas.length !== 1) throw err(406, 'PGRST116', 'JSON object requested, multiple (or no) rows returned', `The result contains ${filas.length} rows`);
    return [req.method === 'POST' ? 201 : 200, filas[0], extra];
  }
  if (req.method !== 'GET' && !prefer.includes('return=representation')) return [req.method === 'POST' ? 201 : 204, null, extra];
  return [req.method === 'POST' ? 201 : 200, filas, extra];
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,HEAD,OPTIONS',
  'Access-Control-Expose-Headers': 'Content-Range',
};
function responder(res, status, cuerpo, extra = {}) {
  const txt = cuerpo == null ? '' : JSON.stringify(cuerpo);
  res.writeHead(status, { ...CORS, ...extra, ...(txt ? { 'Content-Type': 'application/json; charset=utf-8' } : {}) });
  res.end(txt);
}

http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return responder(res, 204, null);
  const url = new URL(req.url, 'http://rig');
  let crudo = '';
  for await (const c of req) crudo += c;
  let cuerpo = null;
  try { cuerpo = crudo ? JSON.parse(crudo) : null; } catch { return responder(res, 400, { message: 'JSON no válido' }); }

  try {
    if (url.pathname.startsWith('/auth/v1')) { const [s, b] = await auth(req, url, cuerpo ?? {}); return responder(res, s, b); }
    if (!url.pathname.startsWith('/rest/v1/')) return responder(res, 404, { message: 'No existe' });

    const jwt = leerJwt((req.headers.authorization ?? '').replace(/^Bearer /, ''));
    if (!jwt) return responder(res, 401, { code: 'PGRST301', message: 'JWT no válido' });
    if (jwt.exp && jwt.exp < Date.now() / 1000) return responder(res, 401, { code: 'PGRST303', message: 'JWT expired' });
    const rol = jwt.role === 'authenticated' ? 'authenticated' : 'anon';
    const cli = await pool.connect();
    try {
      await cli.query('begin');
      await cli.query(`set local role ${rol}`);
      await cli.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(jwt)]);
      const [s, b, extra] = await rest(req, url, cuerpo, cli);
      await cli.query('commit');
      responder(res, s, b, extra);
    } catch (e) {
      await cli.query('rollback').catch(() => {});
      throw e;
    } finally {
      cli.release();
    }
  } catch (e) {
    const pgc = typeof e.code === 'string' && /^[0-9A-Z]{5}$/.test(e.code) ? e.code : null;
    const status = e.status ?? (pgc === '42501' ? 403 : pgc === '23505' || pgc === '23503' ? 409 : pgc === '42P01' || pgc === '42883' ? 404 : 400);
    responder(res, status, { code: e.code ?? 'RIG', message: e.message, details: e.details ?? e.detail ?? null, hint: e.hint ?? null });
  }
}).listen(PUERTO, '127.0.0.1', () => {
  console.log(`Banco de pruebas en http://127.0.0.1:${PUERTO}`);
  console.log(`VITE_SUPABASE_ANON_KEY=${CLAVE_ANON}`);
});
