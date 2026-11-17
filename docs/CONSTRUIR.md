# Cómo construir una pantalla de La Iguana

Léelo completo antes de escribir código. Aplica a toda persona o agente que construya una pantalla.

## Qué es

Consola de monitoreo para campañas políticas. React + Vite + TypeScript, datos en Supabase (Postgres con reglas de acceso por campaña). Cada pantalla ya existe como demo estática en `/mnt/project-files/la-iguana/design/demo/<Pantalla>.dc.html`: tu trabajo es reproducirla en React **leyendo y escribiendo datos reales**, no rediseñarla.

## Dónde está cada cosa

| Qué | Dónde | ¿Lo puedes editar? |
|---|---|---|
| Tu pantalla | `src/pages/<Pantalla>.tsx` (ya existe como marcador) | Sí |
| CSS propio de tu pantalla | `src/pages/<Pantalla>.css`, importado desde tu pantalla | Sí |
| Componentes solo tuyos | `src/pages/<pantalla>/...` | Sí |
| Pantalla de referencia | `src/pages/Resumen.tsx` | No. Cópiale el patrón |
| Datos | `src/lib/db.ts`, `src/lib/hooks.ts` | No |
| Tipos de fila | `src/lib/tipos/index.ts` | No |
| Formato de cifras y fechas | `src/lib/formato.ts` | No |
| Barra lateral, barra superior, rutas | `src/shell/*`, `src/App.tsx` | No |
| CSS compartido (idéntico a la demo) | `src/styles/app.css` | No |
| Esquema y reglas de acceso | `supabase/migrations/*.sql` | No |
| Datos de ejemplo | `supabase/seed/*.json`, guía en `docs/semilla.md` | No |

Si necesitas algo de un archivo que no puedes editar (un campo que falta, un helper, un dato de ejemplo), **no lo edites**: resuélvelo dentro de tus archivos y anótalo en tu reporte final bajo "Pendientes para el orquestador". Otros agentes trabajan en paralelo en el mismo árbol.

## Demo → React

- La demo usa plantillas `{{valor}}`, `<sc-for>` y `<sc-if>`, con la lógica en `class Component extends DCLogic` al final del archivo. En React: JSX, `.map()` y estado con `useState`.
- El contenido empieza en `<main class="page">`. **No copies** la barra lateral ni la barra superior: las pone `Layout`. Tu componente devuelve `<main className="page pg-<pantalla>">…</main>`.
- Las clases CSS compartidas (`.card`, `.kpi`, `.tw`, `.chip`, `.btn`, `.bars`, `.tabs`, `.seg`…) ya están en `src/styles/app.css`, iguales a la demo. Úsalas tal cual.
- El bloque `<style>` de cada demo trae al final reglas propias de esa pantalla (después de `.note{max-width:860px}` y la regla `@media (prefers-reduced-motion…)`). Cópialas a tu `<Pantalla>.css` **anteponiendo `.pg-<pantalla> `** a cada selector, para que no choquen con otras pantallas. Los paneles que se montan fuera de `<main>` (modales) llevan su propia clase raíz con el mismo prefijo.
- Enlaces: `<Link to={...}>` de react-router. Rutas existentes (ver `src/App.tsx`):
  `/` Panorama · `/nueva-campana` · `/c/:campanaId` Resumen · `…/figuras` · `…/figuras/nueva` · `…/figuras/:figuraId` · `…/eventos` · `…/eventos/nuevo` · `…/eventos/:eventoId` · `…/menciones` · `…/temas` · `…/alertas` · `…/reportes`.
  En la demo solo Machado y el Primer debate tenían enlace. En la app **toda** figura y **todo** evento enlazan a su detalle.
- Estado que conviene compartir por enlace (pestaña activa, filtro, elemento abierto) va en la URL con `useSearchParams`, no solo en `useState`.

## Datos

```tsx
import { useTabla, useFila, useCuenta } from '../lib/hooks';
import { db, avisar } from '../lib/db';
import { useCampana, usePagina, hoyDe, useRol } from '../shell/Campana';
import { useSesion } from '../shell/Sesion';
import { useAcciones } from '../shell/Acciones';

usePagina('Figuras');                       // título de pestaña y última miga
const campana = useCampana();               // campaña de la ruta
const hoy = hoyDe(campana);                 // "hoy" de los datos (AAAA-MM-DD). Nunca uses new Date() para calcular "hace 2 h" o "en 10 días"
const { puedeEditar } = useRol();           // false para Solo lectura y Cliente
const { persona } = useSesion();            // quién soy (persona.id, persona.nombre_corto)
const { aviso } = useAcciones();            // aviso breve: aviso('Evento creado', { texto: 'Ver', a: '/c/…' })

const figuras = useTabla<FiguraCampana>('v_figuras_campana', { eq: { campana_id: campana.id }, orden: 'orden' });
// figuras.datos, figuras.cargando, figuras.error. Se recarga solo cuando alguien escribe en esa tabla.

await db.cambiar('alertas', id, { estado: 'Resuelta' });   // lanza Error con mensaje legible si el rol no puede
```

- Lee `src/lib/db.ts` (opciones de filtro), `src/lib/tipos/index.ts` (columnas) y `docs/semilla.md` (qué datos de ejemplo hay para tu pantalla y en qué columna o clave de `detalle` están).
- `v_figuras_campana` (figura + relación + cifras de 30 días) y `v_campanas_resumen` cubren casi todas las lecturas de figuras y campañas. Las figuras son del equipo; su relación con cada campaña está en `campana_figuras`.
- **Nada de datos en el componente.** Ni nombres, ni cifras, ni listas de figuras, temas o eventos escritos en el `.tsx`. Si la demo muestra un dato que no está en la semilla, no lo inventes en el código: muestra el estado vacío y repórtalo.
- **Los totales son cortes guardados** (menciones, participación, neto, riesgo). No los recalcules sumando filas de ejemplo, y no cambian al corregir una mención. **Excepción: el Informe** (`reportes.tipo = 'Informe'`) calcula todo desde filas crudas (`menciones`, `comentarios`, `codificaciones`, `recolecciones`) con `informe_datos()` (`supabase/migrations/860_informe.sql`, contrato en `src/lib/informe/tipos.ts`); sus ediciones guardan el resultado congelado. Sí puedes derivar: porcentajes de barra, posiciones, "día 40 de 60", "en 10 días".
- Fechas: en la base son fechas reales (`2027-05-13`, `2027-05-13T07:12:00-04:00`). Textos como "hoy, 9:10", "ayer", "hace 2 h" se calculan contra `hoyDe(campana)` con los helpers de `formato.ts`.
- **Toda pantalla debe funcionar con una campaña vacía** (recién creada con el asistente): sin figuras, sin eventos, sin menciones. Estados vacíos con `<Vacio>` de `src/shell/Estados`, con un enlace a la acción que lo llena. Y con cualquier figura o evento, no solo los de la demo: los campos pueden venir nulos.
- Envuelve la pantalla en `<Carga estados={[...]}>` como en Resumen.

## Escrituras

- Todo control que en la demo cambia algo debe **guardar en la base** y seguir ahí al recargar: estados de alerta, corrección de sentimiento, notas, reglas, reportes, altas.
- Antes de inventar dónde guardar, busca la columna en `tipos/index.ts`. Notas del equipo → tabla `notas_internas` (el rol Cliente no las ve). Bitácora de una alerta → `alerta_actividad`.
- Escrituras de varias tablas: funciones `crear_campana` e `invitar_persona` (ver `supabase/migrations/850_funciones.sql`) con `db.rpc(...)` y luego `avisar('tabla', …)`. Lo demás son llamadas `db.crear` / `db.cambiar` en secuencia.
- Si `puedeEditar` es false: deshabilita o esconde los controles que escriben. Aun así captura el error de `db.*` y muéstralo con `aviso(error.message)`.
- Lo que depende de la ingesta o del correo (fase 2) **no se finge**: no hay "enviado" si nada se envió, ni "analizando URL" si nada se analiza. Guarda lo que sí es real (la fila queda `Por procesar`, el envío queda `Pendiente de envío`) y dilo en el texto del control o del aviso. No uses etiquetas "Pronto".
- Sin controles muertos: cada botón y enlace hace algo visible y cierto.

## Reglas de contenido (personas reales)

- Los datos de ejemplo son un escenario hipotético con figuras públicas reales y cifras inventadas. No escribas en el código ni en textos de interfaz citas, acusaciones o hechos sobre personas reales.
- Sentimiento: "favorable / neutral / desfavorable" para la figura. Hallazgos de coordinación o cuentas automatizadas: siempre "posible". La cobertura en medios se cuenta, nunca se valora en dinero.
- Copia de interfaz en español latino neutro, frases cortas, misma voz que la demo. Cifras con `formato.ts`: `62,000`, `31.0%`, `+17`, `4.8 M`.

## Probar (obligatorio antes de terminar)

El banco de pruebas es un Postgres real con el mismo esquema y reglas de acceso que producción, una API local y cuentas de prueba (`admin`, `analista`, `lector`, `cliente`, `ajeno` `@rig.test`, contraseña `iguana-rig`). Ya está corriendo: app en `http://127.0.0.1:5173`, API en `:54321`, demo original en `http://127.0.0.1:8765/`.

```bash
npx tsc --noEmit                                               # sin errores en TUS archivos
node rig/captura.mjs /c/presidenciales/figuras rig/.run/figuras.png          # tu pantalla, 1360 px, como admin
node rig/captura.mjs /c/presidenciales/figuras rig/.run/figuras-390.png 390  # móvil: sin desborde horizontal
node rig/captura.mjs demo:Figuras.dc.html rig/.run/demo-figuras.png          # la demo, para comparar
node rig/captura.mjs /c/presidenciales/figuras rig/.run/figuras-lector.png 1360 lector   # como Solo lectura
```

- Abre las capturas con Read y compáralas con la demo: mismas secciones, densidad y jerarquía. Arregla lo que se vea distinto, roto o apretado.
- Para estados con interacción (pestañas, panel de detalle, pasos, guardar y recargar) escribe tu propio script de Playwright en `rig/.run/` (copia el inicio de sesión de `rig/captura.mjs`; Playwright se carga con `createRequire`, ver ese archivo). Comprueba cada escritura: hazla, recarga la página y verifica que sigue ahí.
- **No reinicies la base ni los servidores** (`rig/reset.sh`, `rig/arrancar.sh`): los comparten todos los agentes. Si necesitas datos limpios, crea los tuyos con nombres propios y bórralos al final. No modifiques ni borres las filas de ejemplo de otras pantallas más allá de lo que tu prueba necesite, y devuélvelas a su estado.
- Si la app deja de responder porque otro agente dejó un error de compilación en su archivo, espera un minuto y reintenta: cada pantalla se carga por separado y un error ajeno no rompe la tuya.
- No hagas `git commit`, `git push` ni instales paquetes. No toques `/mnt/project-files/`.

## Reporte final (lo único que ve el orquestador)

1. Archivos escritos.
2. Qué lee la pantalla (tablas) y qué escribe (tabla y columna por cada control).
3. Qué probaste y cómo quedó: capturas (rutas), escrituras verificadas tras recargar, comportamiento como `lector`, campaña vacía.
4. Diferencias conscientes con la demo y por qué.
5. Pendientes para el orquestador: datos que faltan en la semilla, columnas o helpers que necesitas, cualquier cosa que dejaste sin terminar. Sé literal: lo que no esté aquí se da por terminado.
