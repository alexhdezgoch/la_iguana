// Captura una pantalla de la app corriendo en el banco de pruebas.
// Uso: node rig/captura.mjs <ruta> <salida.png> [ancho=1360] [usuario=admin]
//   node rig/captura.mjs /c/presidenciales rig/.run/resumen.png
//   node rig/captura.mjs /c/presidenciales/figuras rig/.run/figuras-390.png 390 lector
// Imprime errores de consola y peticiones fallidas. Sale con código 1 si hubo errores de página.
// Para la demo original: node rig/captura.mjs demo:Figuras.dc.html salida.png  (necesita `bash rig/demo.sh` corriendo)
import { createRequire } from 'node:module';
// Playwright está instalado en la máquina, no en el proyecto: require lo encuentra, import no.
const { chromium } = createRequire(import.meta.url)('playwright');

const [ruta = '/', salida = 'rig/.run/captura.png', ancho = '1360', usuario = 'admin'] = process.argv.slice(2);
const esDemo = ruta.startsWith('demo:');
const base = esDemo ? 'http://127.0.0.1:8765/' : 'http://127.0.0.1:5173';

const nav = await chromium.launch();
const pagina = await nav.newPage({ viewport: { width: Number(ancho), height: 900 }, deviceScaleFactor: 1 });
const errores = [];
pagina.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|Failed to load resource/.test(m.text())) errores.push('consola: ' + m.text()); });
pagina.on('pageerror', (e) => errores.push('página: ' + e.message));
pagina.on('response', (r) => { if (r.status() >= 400 && !/fonts\.g/.test(r.url())) errores.push(`${r.status()} ${r.request().method()} ${r.url()}`); });

if (esDemo) {
  await pagina.goto(base + ruta.slice(5), { waitUntil: 'networkidle' });
} else {
  await pagina.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await pagina.fill('input[name=email]', `${usuario}@rig.test`);
  await pagina.fill('input[name=password]', 'iguana-rig');
  await pagina.click('button[type=submit]');
  await pagina.waitForSelector('.app', { timeout: 10000 });
  await pagina.goto(base + ruta, { waitUntil: 'networkidle' });
  await pagina.waitForSelector('.cargando', { state: 'detached', timeout: 10000 }).catch(() => {});
}
await pagina.waitForTimeout(900); // animaciones de entrada
await pagina.screenshot({ path: salida, fullPage: true });
const desborde = await pagina.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
console.log(`${salida} (${ancho}px)${desborde > 0 ? `  ¡desborde horizontal de ${desborde}px!` : ''}`);
errores.forEach((e) => console.log(e));
await nav.close();
process.exit(errores.some((e) => e.startsWith('página')) ? 1 : 0);
