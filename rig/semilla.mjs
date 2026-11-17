// Convierte supabase/seed/<tabla>.json en supabase/seed.sql. Uso: node rig/semilla.mjs
// Cada archivo es un arreglo de filas. Las columnas que una fila no trae toman su valor por defecto.
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve('supabase/seed');
// Orden de carga: primero lo que otras tablas referencian.
export const ORDEN = [
  'organizaciones', 'personas', 'borradores', 'campanas', 'miembros_campana', 'campana_fases',
  'figuras', 'campana_figuras', 'figura_metricas',
  'temas', 'tema_figuras', 'narrativas',
  'eventos', 'evento_participantes', 'evento_mensajes', 'terminos',
  'autores', 'ejes', 'recolecciones',
  'menciones', 'mencion_figuras', 'mencion_ejes', 'comentarios', 'codigos', 'muestras', 'codificaciones',
  'reglas_alerta', 'alertas', 'alerta_actividad',
  'reporte_plantillas', 'reportes', 'reporte_envios', 'notas_internas', 'series_diarias',
];

const archivos = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
const desconocidas = archivos.filter((t) => !ORDEN.includes(t));
if (desconocidas.length) { console.error('Tablas sin orden de carga:', desconocidas.join(', ')); process.exit(1); }

let sql = '-- Generado por rig/semilla.mjs a partir de supabase/seed/*.json. No editar a mano.\nbegin;\n';
let total = 0;
for (const tabla of ORDEN) {
  if (!archivos.includes(tabla)) continue;
  const filas = JSON.parse(fs.readFileSync(path.join(DIR, `${tabla}.json`), 'utf8'));
  if (!Array.isArray(filas)) { console.error(`${tabla}.json no es un arreglo`); process.exit(1); }
  const grupos = new Map();
  for (const f of filas) {
    const clave = Object.keys(f).sort().join(',');
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(f);
  }
  sql += `\n-- ${tabla}: ${filas.length}\n`;
  for (const [clave, lista] of grupos) {
    const cols = clave.split(',').map((c) => `"${c}"`).join(', ');
    const json = JSON.stringify(lista);
    if (json.includes('$semilla$')) throw new Error('Texto reservado en la semilla');
    sql += `insert into public.${tabla} (${cols}) select ${cols} from jsonb_populate_recordset(null::public.${tabla}, $semilla$${json}$semilla$::jsonb);\n`;
  }
  total += filas.length;
}
sql += '\ncommit;\n';
fs.writeFileSync(path.resolve('supabase/seed.sql'), sql);
console.log(`supabase/seed.sql: ${total} filas en ${archivos.length} tablas`);
