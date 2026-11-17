// Prueba del Informe en la app (Playwright): enlaces seguros, CSV sin fórmulas, ediciones ilegibles, ?envio= de otro
// reporte y aprobación al generar una edición. Uso: node rig/prueba-informe-app.mjs (app en :5173, base con la semilla).
// Crea sus propias filas de reporte_envios para inf-rep-evento y las borra al final.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import pg from 'pg';
const { chromium } = createRequire(import.meta.url)('playwright');

const base = process.env.RIG_APP ?? 'http://127.0.0.1:5173';
const pool = new pg.Pool({ connectionString: process.env.RIG_DB ?? 'postgres://rig:rig@127.0.0.1:5432/iguana' });
const C = 'informe-ejemplo', R = 'inf-rep-evento', R2 = 'inf-rep-tema';
const ADMIN = '00000000-0000-4000-8000-000000000001';
let fallas = 0, casos = 0;
const ok = (n, v, extra = '') => { casos++; if (!v) fallas++; console.log(`${v ? 'ok   ' : 'FALLA'} ${n}${v ? '' : `  ${extra}`}`); };

// Datos del informe como admin (informe_datos revisa la sesión).
const c = await pool.connect();
await c.query('begin');
await c.query('set local role authenticated');
await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: ADMIN, role: 'authenticated' })]);
const datos = (await c.query('select informe_datos($1) as d', [R])).rows[0].d;
await c.query('rollback');
c.release();

// Edición congelada con enlaces maliciosos (como una edición vieja o manipulada) y un titular que parece fórmula.
const mala = structuredClone(datos);
const pubX = mala.rankings.publicaciones.X.por_vistas.find((p) => p.url);
pubX.url = 'javascript:alert(document.domain)';
const dest = mala.destacadas.lista.find((x) => x.url && !x.eje_id && x.grupo !== 'propias');
dest.url = ' JaVaScRiPt:alert(1)';
mala.medios.titulares[0].url = 'data:text/html,<script>alert(1)</script>';
mala.medios.titulares[0].titulo = '=HYPERLINK("http://ejemplo.test","x") de ejemplo';
const contenido = (d) => ({ tipo_doc: 'Informe', titulo: d.portada?.titulo ?? 'Prueba', datos: d, textos: {} });
const ilegible = { ...structuredClone(datos), version: 2 };
const incompleta = structuredClone(datos); delete incompleta.series;

const ids = { mala: 'pia-envio-mala', v2: 'pia-envio-v2', incompleta: 'pia-envio-incompleta' };
await pool.query(`delete from reporte_envios where id like 'pia-envio-%'`);
for (const [k, d] of [['mala', mala], ['v2', ilegible], ['incompleta', incompleta]]) {
  await pool.query(`insert into reporte_envios (id, campana_id, reporte_id, titulo, estado, contenido, extra) values ($1, $2, $3, $4, 'Pendiente de envío', $5, '{}')`,
    [ids[k], C, R, `Prueba ${k}`, JSON.stringify(contenido(d))]);
}
const antes = new Set((await pool.query('select id from reporte_envios where reporte_id = $1', [R])).rows.map((r) => r.id));

const nav = await chromium.launch();
try {
  const ctx = await nav.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  p.on('dialog', (dl) => { errores.push('diálogo: ' + dl.message()); dl.dismiss(); });
  await p.goto(base + '/'); await p.fill('input[name=email]', 'admin@rig.test'); await p.fill('input[name=password]', 'iguana-rig');
  await p.click('button[type=submit]'); await p.waitForSelector('.app');

  // ---------- enlaces: javascript: y data: salen sin href ----------
  const hrefsMalos = () => p.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href') ?? '').filter((h) => !/^https?:\/\//i.test(h.trim()) && !h.startsWith('/') && !h.startsWith('#')));
  await p.goto(`${base}/c/${C}/reportes/informe/${R}?envio=${ids.mala}`); await p.waitForSelector('.inf-sec');
  const malos = await hrefsMalos();
  ok('edición con javascript: y data: se pinta sin esos href', malos.length === 0, JSON.stringify(malos));
  ok('la publicación con url javascript: sigue en la tabla, sin enlace', await p.locator('.inf-tabla td', { hasText: (pubX.titulo ?? pubX.texto ?? '').slice(0, 30) }).count() > 0);
  ok('los demás enlaces http(s) siguen', (await p.$$eval('.inf a[href^="http"]', (as) => as.length)) > 3);
  ok('ningún enlace del documento con javascript:', (await p.$$eval('.inf a', (as) => as.filter((a) => /javascript:|data:/i.test(a.getAttribute('href') ?? '')).length)) === 0);

  // ---------- CSV: celdas que parecen fórmula llevan apóstrofo ----------
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('button:has-text("Descargar CSV")')]);
  const csv = fs.readFileSync(await dl.path(), 'utf8');
  ok('CSV: el titular con = va con apóstrofo', csv.includes(`"'=HYPERLINK(""http://ejemplo.test"",""x"") de ejemplo`), csv.split('\r\n').find((l) => l.includes('HYPERLINK')));
  ok('CSV: ninguna celda empieza con = + @', !csv.split('\r\n').some((l) => l.split(',').some((x) => /^"?[=+@]/.test(x))));
  ok('CSV: sin la url javascript:', !/javascript:/i.test(csv));

  // Vista de impresión de la misma edición (la que usa el PDF).
  await p.goto(`${base}/c/${C}/reportes/informe/${R}?envio=${ids.mala}&vista=impresion`);
  await p.waitForSelector('body[data-informe-listo]', { timeout: 30000 });
  ok('vista de impresión sin href javascript:', (await p.$$eval('a', (as) => as.filter((a) => /javascript:|data:/i.test(a.getAttribute('href') ?? '')).length)) === 0);

  // ---------- ediciones ilegibles ----------
  for (const k of ['v2', 'incompleta']) {
    await p.goto(`${base}/c/${C}/reportes/informe/${R}?envio=${ids[k]}`);
    await p.waitForSelector('text=Esta edición no se puede mostrar', { timeout: 15000 }).catch(() => {});
    ok(`edición ${k}: "Esta edición no se puede mostrar" en la pantalla del Informe`, await p.locator('text=Esta edición no se puede mostrar').count() > 0 && !(await p.$('.inf-sec')));
    await p.goto(`${base}/c/${C}/reportes?envio=${ids[k]}`);
    await p.waitForSelector('text=Esta edición no se puede mostrar', { timeout: 15000 }).catch(() => {});
    ok(`edición ${k}: el mismo estado en el historial`, await p.locator('text=Esta edición no se puede mostrar').count() > 0);
  }
  await p.goto(`${base}/c/${C}/reportes?tab=hist`); await p.waitForSelector('table');
  ok('el historial se pinta con ediciones ilegibles', await p.locator('text=Prueba v2').count() > 0);

  // ---------- ?envio= de otro reporte: no disponible ----------
  await p.goto(`${base}/c/${C}/reportes/informe/${R2}?envio=${ids.mala}`);
  await p.waitForSelector('text=Esta edición no está disponible', { timeout: 15000 }).catch(() => {});
  ok('?envio= de otro reporte: "no está disponible" y sin documento', await p.locator('text=Esta edición no está disponible').count() > 0 && !(await p.$('.inf-sec')));
  await p.goto(`${base}/c/presidenciales/reportes/informe/${R}?envio=${ids.mala}`);
  await p.waitForTimeout(2500);
  ok('?envio= desde otra campaña: sin documento', !(await p.$('.inf-sec')));

  // ---------- generar edición: aprobado_por como ponerEnCola ----------
  await p.goto(`${base}/c/${C}/reportes/informe/${R}`); await p.waitForSelector('.inf-sec');
  await p.click('button:has-text("Generar edición")');
  let nueva = null;
  for (let i = 0; i < 20 && !nueva; i++) {
    await p.waitForTimeout(500);
    nueva = (await pool.query('select id, aprobado_por, estado from reporte_envios where reporte_id = $1 order by generado_en desc', [R])).rows.find((r) => !antes.has(r.id)) ?? null;
  }
  const req = (await pool.query('select requiere_aprobacion from reportes where id = $1', [R])).rows[0].requiere_aprobacion;
  ok('generar edición: requiere aprobación → aprobado_por = quien la genera', !!nueva && req === true && nueva.aprobado_por === 'rig-admin', JSON.stringify(nueva));

  ok('sin errores de página ni diálogos', errores.length === 0, errores.join(' | '));
} finally {
  await nav.close();
  const nuevas = (await pool.query('select id from reporte_envios where reporte_id = $1', [R])).rows.map((r) => r.id).filter((id) => !antes.has(id));
  await pool.query(`delete from reporte_envios where id like 'pia-envio-%' or id = any($1)`, [nuevas]);
  await pool.end();
}
console.log(`\n${casos - fallas} de ${casos} casos pasan.`);
process.exit(fallas ? 1 : 0);
