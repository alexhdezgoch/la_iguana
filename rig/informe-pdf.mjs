// PDF de un Informe sin pantalla, con Chromium de Playwright: el mismo HTML que "Imprimir / Guardar PDF" de la app.
// Uso: node rig/informe-pdf.mjs <reporte_id | envio_id> <salida.pdf> [usuario=admin]
//   node rig/informe-pdf.mjs <id de reporte tipo Informe> rig/.run/informe.pdf
//   node rig/informe-pdf.mjs <id de reporte_envios (edición)> rig/.run/edicion.pdf cliente
// Inicia sesión como el usuario de prueba, abre /c/<campaña>/reportes/informe/<reporte>?vista=impresion[&envio=<id>]
// (la página se reemplaza por el documento autónomo) y lo imprime en A4 con fondos. Las reglas de acceso aplican:
// un usuario sin acceso a la campaña no obtiene el informe. Es el camino que usará el trabajador de la fase 2.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import pg from 'pg';
const { chromium } = createRequire(import.meta.url)('playwright');

const [id, salida = 'rig/.run/informe.pdf', usuario = 'admin'] = process.argv.slice(2);
if (!id) { console.error('Uso: node rig/informe-pdf.mjs <reporte_id | envio_id> <salida.pdf> [usuario]'); process.exit(2); }
const base = process.env.RIG_APP ?? 'http://127.0.0.1:5173';

// ¿Reporte o edición? Solo para armar la ruta: los datos los lee la app con la sesión del usuario.
const pool = new pg.Pool({ connectionString: process.env.RIG_DB ?? 'postgres://rig:rig@127.0.0.1:5432/iguana' });
let ruta;
const r = (await pool.query(`select id, campana_id, tipo from reportes where id = $1`, [id])).rows[0];
if (r) {
  if (r.tipo !== 'Informe') { console.error(`El reporte ${id} es de tipo "${r.tipo}", no un Informe.`); process.exit(2); }
  ruta = `/c/${r.campana_id}/reportes/informe/${r.id}?vista=impresion`;
} else {
  const e = (await pool.query(`select id, campana_id, reporte_id, contenido->>'tipo_doc' as tipo from reporte_envios where id = $1`, [id])).rows[0];
  if (!e) { console.error(`No hay reporte ni envío con id ${id}.`); process.exit(2); }
  if (e.tipo !== 'Informe') { console.error(`El envío ${id} no es una edición de un Informe.`); process.exit(2); }
  ruta = `/c/${e.campana_id}/reportes/informe/${e.reporte_id}?envio=${e.id}&vista=impresion`;
}
await pool.end();

const nav = await chromium.launch();
const pagina = await nav.newPage({ viewport: { width: 1200, height: 900 } });
const errores = [];
pagina.on('pageerror', (e) => errores.push('página: ' + e.message));
await pagina.goto(base + '/', { waitUntil: 'domcontentloaded' });
await pagina.fill('input[name=email]', `${usuario}@rig.test`);
await pagina.fill('input[name=password]', 'iguana-rig');
await pagina.click('button[type=submit]');
await pagina.waitForSelector('.app', { timeout: 15000 });
await pagina.goto(base + ruta, { waitUntil: 'domcontentloaded' });
try {
  await pagina.waitForSelector('body[data-informe-listo]', { timeout: 30000 });
} catch {
  const txt = (await pagina.textContent('main').catch(() => '')) ?? '';
  console.error(`No se armó el informe (${ruta}). ${txt.replace(/\s+/g, ' ').slice(0, 300)}`);
  errores.forEach((e) => console.error(e));
  await nav.close();
  process.exit(1);
}
await pagina.evaluate(() => document.fonts?.ready);
mkdirSync(dirname(salida), { recursive: true });
await pagina.pdf({ path: salida, format: 'A4', printBackground: true, preferCSSPageSize: true });
console.log(`${salida} (${ruta})`);
errores.forEach((e) => console.log(e));
await nav.close();
