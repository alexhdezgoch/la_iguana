// Convierte supabase/seed/<tabla>.json en supabase/seed.sql. Uso: node rig/semilla.mjs
// También escribe supabase/seed_informe.sql: solo las filas de la campaña informe-ejemplo, con `on conflict do nothing`,
// para cargarlas en producción sobre una base que ya tiene el resto (organización, personas y figuras de Brújula).
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

/** SQL de carga de las filas que cumplen `elegir`; `sufijo` va al final de cada insert. */
function generar(cabecera, elegir = () => true, sufijo = '') {
  let sql = `${cabecera}\nbegin;\n`;
  let total = 0, tablas = 0;
  for (const tabla of ORDEN) {
    if (!archivos.includes(tabla)) continue;
    const todas = JSON.parse(fs.readFileSync(path.join(DIR, `${tabla}.json`), 'utf8'));
    if (!Array.isArray(todas)) { console.error(`${tabla}.json no es un arreglo`); process.exit(1); }
    const filas = todas.filter((f) => elegir(tabla, f));
    if (!filas.length && sufijo) continue;
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
      sql += `insert into public.${tabla} (${cols}) select ${cols} from jsonb_populate_recordset(null::public.${tabla}, $semilla$${json}$semilla$::jsonb)${sufijo};\n`;
    }
    total += filas.length;
    tablas++;
  }
  sql += '\ncommit;\n';
  return { sql, total, tablas };
}

const todo = generar('-- Generado por rig/semilla.mjs a partir de supabase/seed/*.json. No editar a mano.');
fs.writeFileSync(path.resolve('supabase/seed.sql'), todo.sql);
console.log(`supabase/seed.sql: ${todo.total} filas en ${archivos.length} tablas`);

// Campaña del Informe de ejemplo, sola, para producción (requiere 100_informe.sql y 860_informe.sql aplicados).
const CI = 'informe-ejemplo';
const informe = generar(
  `-- Generado por rig/semilla.mjs a partir de supabase/seed/*.json. No editar a mano.
-- Solo las filas de la campaña ${CI} (Monitoreo de ejemplo · Venezuela 2027), para cargar en producción con psql -f.
-- Supone que ya existen la organización brujula, sus personas (miembros) y sus figuras. Se puede correr más de una vez:
-- cada insert lleva on conflict do nothing y no pisa filas existentes.`,
  (tabla, f) => (tabla === 'campanas' ? f.id === CI : f.campana_id === CI),
  ' on conflict do nothing',
);
fs.writeFileSync(path.resolve('supabase/seed_informe.sql'), informe.sql);
console.log(`supabase/seed_informe.sql: ${informe.total} filas en ${informe.tablas} tablas`);
