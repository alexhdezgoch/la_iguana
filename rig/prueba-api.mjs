// Prueba la capa de datos de la app (supabase-js) contra el banco de pruebas, igual que la usa el navegador.
// Uso: node rig/prueba-api.mjs  (con rig/servidor.mjs corriendo y la base recién reconstruida)
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const env = Object.fromEntries(fs.readFileSync('.env.rig', 'utf8').trim().split('\n').map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
let fallas = 0;
function ok(nombre, cond, extra = '') {
  if (!cond) fallas++;
  console.log(`${cond ? 'ok   ' : 'FALLA'} ${nombre}${cond ? '' : '  → ' + extra}`);
}
async function cliente(email) {
  const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error } = await sb.auth.signInWithPassword({ email, password: 'iguana-rig' });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return sb;
}

const anon = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
{
  const { data, error } = await anon.from('campanas').select('*');
  ok('sin sesión no se leen campañas', !!error || (data ?? []).length === 0, JSON.stringify(data));
  const r = await anon.auth.signInWithPassword({ email: 'analista@rig.test', password: 'mala' });
  ok('contraseña incorrecta se rechaza', !!r.error);
}

const a = await cliente('analista@rig.test');
{
  const r = await a.from('v_figuras_campana').select('*').eq('campana_id', 'presidenciales').order('orden', { ascending: true, nullsFirst: false });
  ok('vista de figuras: 8 filas en orden', !r.error && r.data.length === 8 && r.data[0].figura_id === 'machado', r.error?.message);
  ok('bigint llega como número', typeof r.data?.[0]?.alcance === 'number', typeof r.data?.[0]?.alcance);
  const c = await a.from('campanas').select('*').eq('id', 'presidenciales').limit(1);
  ok('fechas llegan como AAAA-MM-DD', c.data?.[0]?.jornada === '2027-06-06', c.data?.[0]?.jornada);
  const n = await a.from('alertas').select('*', { count: 'exact', head: true }).in('estado', ['Nueva', 'En revisión', 'Pospuesta']);
  ok('conteo con in() y acentos', n.count === 5, String(n.count));
  const b = await a.from('figuras').select('*').ilike('nombre', '%rodr%');
  ok('búsqueda por texto', b.data?.length === 2, JSON.stringify(b.error ?? b.data?.length));
  const d = await a.from('eventos').select('*').gte('fecha_inicio', '2027-05-13').order('fecha_inicio', { ascending: true, nullsFirst: false });
  ok('rango de fechas', d.data?.length === 2 && d.data[0].id === 'pres-segundo-debate', JSON.stringify(d.data?.map((x) => x.id)));
  const nul = await a.from('alertas').select('*').is('responsable_id', null);
  ok('filtro por nulo', nul.data?.length === 2, String(nul.data?.length));

  const ins = await a.from('eventos').insert({ campana_id: 'presidenciales', nombre: 'Prueba API', tipo: 'Mitin', hashtags: ['#a', '#b'], resultados: { pico: [1, 2] } }).select('*').single();
  ok('alta con arreglo y json, valores por defecto', !ins.error && ins.data.estado === 'Borrador' && ins.data.hashtags.length === 2 && ins.data.resultados.pico[1] === 2, ins.error?.message);
  const cs = await a.from('eventos').select('*').contains('hashtags', ['#a']);
  ok('contiene en arreglo', cs.data?.length === 1, JSON.stringify(cs.error ?? cs.data?.length));
  const upd = await a.from('eventos').update({ estado: 'Programado', asistencia: 1200 }).eq('id', ins.data.id).select('*');
  ok('cambio', upd.data?.[0]?.estado === 'Programado' && upd.data[0].asistencia === 1200, upd.error?.message);
  const malo = await a.from('eventos').update({ estado: 'Inventado' }).eq('id', ins.data.id).select('*');
  ok('valor fuera del vocabulario da error', !!malo.error, 'sin error');
  const del = await a.from('eventos').delete().eq('id', ins.data.id).select('id');
  ok('baja', del.data?.length === 1, del.error?.message);
  const z = await a.from('eventos').insert({ campana_id: 'zulia', nombre: 'x', tipo: 'Mitin' }).select('*').single();
  ok('alta en campaña ajena se rechaza', !!z.error, 'sin error');
  const rol = await a.rpc('mi_rol', { p_campana: 'presidenciales' });
  ok('rpc mi_rol', rol.data === 'Análisis', JSON.stringify(rol));
  const ctx = await a.rpc('mi_contexto');
  ok('rpc mi_contexto', ctx.data?.org?.id === 'brujula' && ctx.data?.persona?.id === 'rig-analista' && !('user_id' in ctx.data.persona), JSON.stringify(ctx.error ?? ctx.data));
}

const l = await cliente('lector@rig.test');
{
  const u = await l.from('alertas').update({ estado: 'Resuelta' }).eq('id', 'pres-alerta-1').select('*');
  ok('solo lectura: el cambio no afecta filas', !u.error && u.data.length === 0, JSON.stringify(u.error ?? u.data));
  const i = await l.from('eventos').insert({ campana_id: 'presidenciales', nombre: 'x', tipo: 'Mitin' }).select('*').single();
  ok('solo lectura: alta rechazada', !!i.error, 'sin error');
}

const x = await cliente('ajeno@rig.test');
{
  const r = await x.from('v_campanas_resumen').select('*');
  ok('otra organización no ve nada', (r.data ?? []).length === 0, JSON.stringify(r.data));
}

// Revisión de seguridad: login con correo sin confirmar, personas sin user_id, funciones de escritura por la API.
{
  const db = new pg.Client({ connectionString: process.env.RIG_DB ?? 'postgres://rig:rig@127.0.0.1:5432/iguana' });
  await db.connect();
  await db.query(`delete from auth.users where email = 'sinconfirmar-api@rig.test'`);
  await db.query(`insert into auth.users (email, clave) values ('sinconfirmar-api@rig.test', 'iguana-rig')`);
  const r = await createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
    .auth.signInWithPassword({ email: 'sinconfirmar-api@rig.test', password: 'iguana-rig' });
  ok('[4] correo sin confirmar no inicia sesión', !!r.error && /not confirmed/i.test(r.error.message), JSON.stringify(r.error ?? 'entró'));
  await db.query(`delete from auth.users where email = 'sinconfirmar-api@rig.test'`);
  await db.end();
}
{
  const ad = await cliente('admin@rig.test');
  const todo = await ad.from('personas').select('*');
  ok('[13] personas con select=* se rechaza', !!todo.error, JSON.stringify(todo.data?.length));
  const cols = await ad.from('personas').select('id,org_id,nombre,nombre_corto,iniciales,email,puesto,rol_org,activa,extra,creada_en').eq('org_id', 'brujula');
  ok('[13] personas por columnas, sin user_id', !cols.error && cols.data.length > 0 && !('user_id' in cols.data[0]), JSON.stringify(cols.error));
  const ctx = await ad.rpc('mi_contexto');
  ok('[13] mi_contexto sigue funcionando para admin', ctx.data?.persona?.id === 'rig-admin', JSON.stringify(ctx.error ?? ctx.data));
  const alerta = await a.rpc('cambiar_alerta', { p_alerta: 'pres-alerta-2', p_cambios: {}, p_texto: 'prueba api', p_en: '2027-05-13T10:00:00Z' });
  ok('[12] rpc cambiar_alerta por la API', !alerta.error && typeof alerta.data === 'string', JSON.stringify(alerta.error));
  if (alerta.data) await a.from('alerta_actividad').delete().eq('id', alerta.data);
  const lect = await l.rpc('cambiar_alerta', { p_alerta: 'pres-alerta-2', p_cambios: { estado: 'Resuelta' }, p_texto: 'x' });
  ok('[12] rpc cambiar_alerta: lector rechazado', !!lect.error, 'sin error');
}

console.log(fallas ? `\n${fallas} fallas.` : '\nTodo pasa.');
process.exit(fallas ? 1 : 0);
