# Semilla: de dónde sale cada dato de la demo

Mapa de cada pantalla de `design/demo/*.dc.html` a la base. Si un valor no aparece aquí, es **texto fijo de la interfaz y se queda en el componente**. Si aparece como **derivado**, se calcula al leer y no se guarda.

Los datos están en `supabase/seed/<tabla>.json`. `rig/semilla.mjs` los carga en el orden de `ORDEN`. Las tres campañas son `presidenciales` (completa), `zulia` y `chacao` (vista compacta). Además existe `vacia`, que se crea solo en las pruebas.

## Reglas generales

- **Hoy** = `campanas.fecha_corte` (2027-05-13). El periodo es `campanas.periodo_inicio..periodo_fin`, del 14 de abril al 13 de mayo, 30 días. La demo se ve como si fueran las 09:15 en America/Caracas. Todos los instantes llevan `-04:00`.
- **Valores crudos.** Los porcentajes son números (31.0, no "31%"). Las cifras van sin separador y las fechas en ISO. El formato lo pone `src/lib/formato.ts`.
- **Totales guardados.** `temas.menciones`, `figura_metricas.menciones`, `narrativas.menciones` y similares son instantáneas. No se recalculan sumando series. Las series (`series_diarias`) sí suman exactamente el total del periodo, salvo que se diga otra cosa.
- **Pendientes de revisión** (barra lateral, Menciones): `requiere_revision and not revisada and estado <> 'Descartada'`. Hoy hay 3 / 4 / 0 (presidenciales / zulia / chacao) en `v_campanas_resumen.menciones_por_revisar`.
- **Alertas abiertas**: `estado in ('Nueva','En revisión','Pospuesta')`. Hoy hay 5 / 3 / 1 en `v_campanas_resumen.alertas_abiertas`. `ALERTAS_ABIERTAS` está en `tipos`.
- **Personas**: siempre por `persona_id`. El nombre visible es `personas.nombre`. Las iniciales son derivadas.
- Las citas de publicaciones ciudadanas se guardan como descripciones neutras en tercera persona. La fuente es el medio, o `Cuenta pública` / `Cuenta oficial`. La cobertura se cuenta en notas y nunca se valora en dinero. La coordinación siempre es "posible".

## Vocabularios

| Campo | Valores |
|---|---|
| `campana_figuras.relacion` | Propia, Aliada, Rival, A observar |
| `miembros_campana.rol` | Administración, Análisis, Solo lectura, Cliente |
| `campana_fases.nombre` | Precampaña, Intercampaña, Campaña, Veda, Jornada electoral, Post-electoral |
| `narrativas.direccion` | Favorable (chip "A favor"), Desfavorable ("En contra"), Sin dirección, Posicionamiento |
| `narrativas.tendencia`, `temas.tendencia` | En aumento, Estable, A la baja, Emergente |
| `narrativas.detalle.relacionadas[].tipo` | Responde a, Comparte términos, Se alimenta de |
| `eventos.tipo` | Mitin, Debate, Gira, Conferencia de prensa, Encuentro ciudadano, Informe, Entrevista, Crisis |
| `eventos.origen` | Propio, De rival, Institucional |
| `eventos.estado` | Borrador, Programado, En curso, En análisis, Cerrado, Cancelado |
| `evento_participantes.rol` | Protagonista, Oradora/or, Invitada/o, Adversaria/o, Moderadora/or |
| `evento_mensajes.estado` | Aterrizó, Parcial, No aterrizó |
| `menciones.canal` | X, Facebook, TikTok, Instagram, Medio digital, YouTube, Radio, Televisión |
| `menciones.fuente_tipo` | Medio, Ciudadana, Oficial |
| `menciones.importancia` | alto, medio, bajo |
| sentimiento | Favorable, Neutral, Desfavorable |
| `reglas_alerta.tipo` (disparador) | Narrativa crece, Índice de riesgo sube, Rival publica en tema propio, Sentimiento neto baja, Nota en medio destacado, Pico de menciones, Posible actividad coordinada |
| `alertas.tipo` (etiqueta) | Narrativa, Riesgo, Rival en tema propio, Sentimiento, Medios, Volumen |
| `alertas.severidad` | Alta, Media, Baja. En las reglas existe también "Según tamaño". |
| `alertas.estado` | Nueva, En revisión, Pospuesta, Resuelta, Descartada |
| `reglas_alerta.canales` | En la app, Email, WhatsApp, Slack, Telegram |
| `reportes.tipo` | Corte diario, Post-evento, Semanal de narrativas, A la medida |
| `reportes.frecuencia` | Diario, Semanal, Por evento, Una vez |
| `reporte_envios.estado` | Borrador, En revisión, Pendiente de envío, Entregado, Envío parcial, Fallido |
| formato de destinatario | Correo con PDF, Enlace con acceso, WhatsApp resumen |
| `reporte_plantillas.marca` | Consultora, Cliente |
| `series_diarias.entidad` | campana, figura, tema, narrativa, evento |
| `alertas.detalle.contexto.enlace` | evento, temas, figura |

Las listas de tipos de evento, roles, tipos de figura, redes, tipos de término y opciones de equipo responsable aparecen en los formularios. Son **texto fijo de la interfaz y se quedan en el componente**, con los valores de esta tabla.

---

## Barra lateral y encabezado (compartidos)

- Selector de campaña: `v_campanas_resumen` (nombre, contienda, iniciales, vista).
- Contadores: Menciones = `menciones_por_revisar` y Alertas = `alertas_abiertas`.
- Equipo del pie: `organizaciones` (nombre). El aviso "Escenario hipotético" se muestra cuando `campanas.es_demo`.
- Breadcrumb: `campanas.titulo_largo`. El selector "Últimos 30 días" es texto fijo, porque solo existe el periodo `30d`.
- La campana muestra las alertas abiertas, igual que la barra lateral.

## 1. Resumen (Main) — `/c/:id`

| Bloque | Origen |
|---|---|
| Fecha y periodo | `campanas.fecha_corte`, `periodo_inicio`, `periodo_fin` |
| Barra de fase "Día 40 de 60" | `campana_fases` con `inicio <= hoy <= fin`. Día y duración son derivados. El texto "Faltan N días… veda…" sale de `campanas.jornada`, `veda_inicio` y `veda_fin`. |
| Menciones, participación, neto, riesgo | `v_figuras_campana` con `figura_id = campanas.figura_propia_id`: `menciones`, `participacion`, `neto`, `favorable`, `desfavorable`, `riesgo`, `riesgo_nivel` |
| "de 200,000 entre las 8 figuras" | Derivado: suma de `v_figuras_campana.menciones` y cuenta de figuras con métricas |
| "Primer lugar. Delcy tiene 27.0%" | Derivado: orden por `participacion` |
| Sparkline | `series_diarias` con entidad `figura` y entidad_id de la figura propia (30 filas, suman 62000) |
| Participación en la conversación | `v_figuras_campana` ordenada por `participacion` desc: `relacion`, `neto` |
| Alertas abiertas | `alertas` abiertas, ordenadas por severidad y luego `orden`: `severidad`, `texto` |
| Próximo evento | primer `eventos` con `fecha_inicio >= hoy` y estado distinto de Cancelado o Borrador: `pres-segundo-debate`. "En 10 días" es derivado. |
| Temas del periodo | `temas` por `orden`: `nombre`, `porcentaje`, `menciones` |
| Narrativas sobre la figura | `narrativas` con `figura_id` igual a la figura propia, ordenadas por `menciones` desc: `nombre`, `menciones`, `tendencia`, `direccion`. Son **5** (ver discrepancias). |

## 2. Panorama — `/`

- Una fila por campaña en `v_campanas_resumen`: figura propia, menciones, participación, neto, riesgo, alertas abiertas y altas, menciones por revisar, fase y jornada.
- "Figuras compartidas": figuras que están en más de una campaña, según `v_figuras_campana`. **Derivado:**
  - el neto entre campañas es el promedio ponderado por menciones: Rosales +18, Guanipa +5;
  - el riesgo es el máximo.
- "Alertas para hoy": alertas abiertas de todas las campañas. Se descartan las repetidas por `texto` + `figura_id`, se ordenan por severidad y luego por `detectada_en` desc, y se muestran 5.
- Totales del encabezado: suma derivada de las filas.

## 3. Figuras — `/c/:id/figuras`

- Tabla: `v_figuras_campana`. Columnas: `nombre`, `iniciales`, `cargo` (o `extra_campana.cargo` si existe), `partido`, `coalicion`, `relacion`, `menciones`, `participacion`, `neto`, `riesgo`, `riesgo_nivel`, `alcance`, `interaccion`.
- Filtro por relación: `relacion`. La marca de candidatura es `extra_campana.candidatura` (true en machado, delcy y capriles en presidenciales).
- Responsable: `responsable_id` → `personas`.
- "Agregar figura" abre la pantalla 5.

## 4. Figura (ficha) — `/c/:id/figuras/:figuraId`

- Cabecera: `figuras` (nombre, cargo, partido, coalicion, territorio, tipo, trayectoria) y `figuras.extra.subtitulo`.
- Cuentas: `figuras.cuentas` `[{red, usuario, seguidores, verificada}]`. Seguidores totales en `figura_metricas.seguidores`.
- KPIs: `v_figuras_campana` (menciones, participacion, favorable/neutral/desfavorable, neto, alcance, interaccion, notas_medios, riesgo).
- Serie diaria: `series_diarias` con entidad `figura`. Solo tienen serie las figuras propias: machado, rosales y duque.
- Por canal: `figura_metricas.detalle.canales [{canal, menciones}]`.
- Cobertura en medios: `figura_metricas.detalle.cobertura {favorables, neutrales, desfavorables, por_medio:[{medio, notas}]}`. Son conteos, nunca montos.
- Temas de la figura: `tema_figuras` con `figura_id`: `porcentaje`, `porcentaje_propias`, `favorable/neutral/desfavorable`, `neto`.
- Narrativas: `narrativas` con `figura_id`, o la figura dentro de `detalle.figura_ids`.
- Menciones recientes: `menciones` ⋈ `mencion_figuras`.
- Pestañas sin diseño (Audiencia, Comparar): **no sembradas**.

## 5. Agregar figura — `/c/:id/figuras/nueva`

Formulario que escribe en `figuras`, `campana_figuras` y `terminos`. La vista previa de ejemplo (Delsa Solórzano), las estimaciones de volumen y las opciones de tipo, red y responsable son **texto fijo de la interfaz y se quedan en el componente**. El "responsable" de la demo es un nombre de equipo, no una persona: se guarda en `campana_figuras.extra.responsable_equipo` cuando se elige equipo, y en `responsable_id` cuando se elige persona.

## 6. Eventos — `/c/:id/eventos`

- Lista: `eventos` (nombre, tipo, origen, estado, fecha_inicio, fecha_fin, hora, `extra.hora_fin`, sede, ciudad, `extra.estado_region`, menciones, neto, nota_estado).
- "Día 4 de 5" para un evento en curso: **derivado** de las fechas, por eso `nota_estado` es null. "Resultados preliminares / finales" y "Falta la ficha" sí se guardan en `nota_estado`.
- Pestañas por estado: `estado`. Próximos: `fecha_inicio >= hoy`, que hoy son 2 (segundo debate y cierre).

## 7. Evento (ficha) — `/c/:id/eventos/:eventoId` (`pres-primer-debate` completo)

| Bloque | Origen |
|---|---|
| KPIs | `menciones`, `alcance`, `neto`, `neto_antes` (la diferencia es derivada), `notas_medios`, `asistencia` |
| Antes / durante / después | `menciones_antes`, `menciones_durante`, `menciones_despues`. Ventana en `ventana_horas`. |
| Veredicto, objetivos, aprendizajes | `veredicto`, `objetivos`, `aprendizajes` |
| Narrativa del evento y hashtags | `narrativa_id`, `hashtags` |
| Serie | `series_diarias` con entidad `evento` (si existe). El pico está en `resultados.pico {por_minuto, en, contexto, tema_id}`. |
| Participantes | `evento_participantes` (rol, menciones, participacion, fav/neu/desf, neto). `resultados.otros {menciones, participacion}` es el resto. |
| Mensajes | `evento_mensajes` (texto, terminos, menciones, porcentaje, estado). `resultados.sin_mensaje {menciones, porcentaje}`. |
| Cobertura | `resultados.cobertura {digitales, radio, television, favorables, neutrales, desfavorables}` (conteos) |
| Reacciones de rivales | `resultados.reacciones [{figura_id, publicaciones, narrativa_id\|null, menciones\|null}]`. Un null significa "sin mensaje". |
| Hashtags | `resultados.hashtags [{hashtag, menciones, lado: 'propio'\|'rival'\|'neutral', nota?}]` |
| Publicaciones destacadas | `resultados.publicaciones [{titulo, canal, origen, metrica, valor}]` |
| Botón de reporte | `reportes` con tipo Post-evento y el último `reporte_envios` cuyo `extra.evento_id` es el evento |

## 8. Crear evento — `/c/:id/eventos/nuevo`

Formulario sobre `eventos`, `evento_participantes`, `evento_mensajes` y `terminos (evento_id)`. Los valores por defecto, la vista previa, los tipos y roles y la sugerencia de fase son **texto fijo de la interfaz y se quedan en el componente**. La fase sugerida se deriva de `campana_fases`.

## 9. Menciones — `/c/:id/menciones`

- Lista: `menciones` ordenadas por `publicada_en desc`: canal, fuente, fuente_tipo, titulo, resumen, url, alcance, interacciones, importancia, sentimiento (o `sentimiento_manual`).
- Figuras de cada mención: `mencion_figuras`. La principal también está en `menciones.figura_id`. Las secundarias pueden tener el sentimiento null.
- Por revisar: el filtro de las reglas generales, que hoy da 3. Al revisar se escriben `revisada`, `revisada_por` y `revisada_en`.
- Conteos de los filtros (por tema, por canal): **derivados** de `tema_figuras` y de las propias menciones, no de los conteos impresos en la demo.

## 10. Temas y narrativas — `/c/:id/temas`

- Temas: `temas` (nombre, menciones, porcentaje, cambio, tendencia, es_propio). Por canal: `detalle.canales [{canal, porcentaje}]`. "Otros" lleva `detalle.otros = true`. `detalle.cambio_ventana` aparece cuando el cambio no es de 7 días ("48 h").
- Nota del encabezado: `campanas.extra.nota_temas`.
- Series de temas: `series_diarias` con entidad `tema` (7 × 30, cada una suma `temas.menciones`).
- Mapa de calor tema × figura: `tema_figuras`.
  - `porcentaje` = % del tema que corresponde a la figura.
  - `porcentaje_propias` = % de las publicaciones propias de la figura.
  - `neto`, y `favorable/neutral/desfavorable` solo para la figura propia.
  - "Rival en tema propio": `porcentaje_hace_7d` y `porcentaje_propias_hace_7d`.
- Narrativas: `narrativas`, con todos estos campos:
  - Columnas: menciones, menciones_24h, cambio_24h, cambio_7d, veces_promedio, tendencia, direccion, detectada_el, alcance, cuentas_unicas, neto, seguida, descripcion, resumen, resumen_aprobado.
  - `detalle`:
    - `canales [{canal, porcentaje}]`
    - `impulsores [{figura_id | medio, porcentaje}]`
    - `publicaciones [{canal, fuente, descripcion, alcance}]`
    - `terminos [str]`
    - `relacionadas [{narrativa_id, tipo}]`
    - `coordinacion {nivel, senales[]}`, solo en `pres-fuera-del-dialogo` y siempre como "posible"
    - `figura_ids` cuando la narrativa toca a varias figuras
- Serie de narrativas: `series_diarias` con entidad `narrativa` (11 × 30). El último día es igual a `menciones_24h`.

## 11. Alertas — `/c/:id/alertas`

- Bandeja: `alertas`:
  - severidad, estado, tipo, texto, detectada_en, disparos;
  - responsable_id → personas, pospuesta_hasta, resuelta_en, motivo_cierre;
  - FKs a figura, narrativa, tema y evento.
- Detalle:
  - `explicacion`, `valor`, `umbral`, `ventana`
  - `detalle.grafica {metrica, serie[], umbral, rango[min,max], indice_disparo, desde, hasta, signo?}`
  - `detalle.evidencia [{fuente, canal, publicada_en, descripcion, alcance, sentimiento}]`
  - `detalle.menciones_relacionadas` (número)
  - `detalle.contexto {texto, enlace}`
  - `detalle.pasos [str]`: los pasos sugeridos se guardan en cada alerta; el mapa STEPS de la demo no se usa
  - `detalle.nota_estado?`
- Actividad: `alerta_actividad` (texto sin el nombre al inicio, persona_id cuando la acción la hizo una persona, creada_en).
- Reglas: `reglas_alerta`:
  - `tipo` = disparador, más severidad, canales, activa y figura_id.
  - `condicion {texto, umbral, unidad, ventana, alcance:{relaciones?, direccion?, tema_ids?, figura_ids?, medios?}, alcance_texto}`.
  - `destinatarios [{persona_id}]`. Las métricas de ingesta van en `disparos_30d` y `ultimo_disparo`.
  - El catálogo de disparadores del constructor de reglas es **texto fijo de la interfaz y se queda en el componente**.
- "Yo", para "Asignadas a mí", es la persona de la sesión (`mi_contexto`).

## 12. Reportes — `/c/:id/reportes`

- Programados: `reportes`:
  - nombre, tipo, frecuencia, hora, formato, estado, requiere_aprobacion, ultimo_envio, proximo_envio, plantilla_id.
  - `destinatarios [{lista | persona_id, formato}]`. Las listas están en `campanas.extra.listas_destinatarios [{id, nombre, descripcion, personas}]`.
  - `secciones [{id, titulo, ia, activa}]`.
  - `extra {descripcion, marca, confidencial, seccion_analisis, borrador_hora, borrador_cierre, periodo_texto, dia, proximo_evento_id}`.
- Plantillas: `reporte_plantillas` (nombre, etiqueta, descripcion, tipo, secciones, marca, usos, orden).
- Historial: `reporte_envios` ordenado por `generado_en desc` (9 filas):
  - titulo, periodo_inicio, periodo_fin, generado_en, enviado_en, estado, destinatarios, entregados, aprobado_por;
  - `extra {nota, cierra_en, evento_id}`.
- Vista previa del documento: `reporte_envios.contenido`, que tiene esta forma:

```
{tipo_doc, titulo, meta, marca: 'Consultora'|'Cliente',
 secciones: [{id, pagina, titulo, ia, nota?, texto?,
   cifras?: [{etiqueta, valor, detalle}],
   puntos?: [{texto, por_que, que_hacer}],
   items?:  [{texto, detalle?, enlace?, barra?, tono?, chip?, chip_tono?, valor?, valor2?}]}]}
```

  Tiene contenido en: cliente-0503, diario-0513, post-primer-debate y semanal-0510 (el borrador). En los demás envíos `contenido` es `{}`.
- Marca del cliente: `campanas.extra.marca_cliente {nombre, iniciales}`.
- Las secciones de "Descargar reporte" son **texto fijo de la interfaz y se quedan en el componente**.

## 13. Nueva campaña (asistente) — `/nueva`

- Borrador: `borradores` (`borrador-maracaibo`, persona valentina, tipo `nueva-campana`). `datos {paso, campana{…}, fases[], figuras[{figura_id, relacion, terminos[]}], confirmo_personas_publicas, terminos[], temas[], equipo[{persona_id, rol}]}`.
- Al terminar, el asistente llama a `crear_campana` (850).
- Las figuras existentes para elegir están en `figuras` del equipo. Las personas del equipo están en `personas` del mismo `org_id`.
- Las estimaciones de volumen por término son **no sembradas** (fase 2).

## 14. Zulia (vista compacta) — `/c/zulia`

- Encabezado y fase: `v_campanas_resumen`, `campana_fases` (Precampaña sin fechas). El avance se toma de `campanas.extra.avance_fase` (18).
- Figuras: `v_figuras_campana`:
  - orden: rosales, caldera, guanipa;
  - cargo: `extra_campana.cargo` cuando existe, si no `figuras.cargo`.
- Serie de la figura propia: `series_diarias` con entidad `figura` y entidad_id `rosales` (pico el día 22).
- Temas: `temas` con `tendencia` (6). Narrativas: `narrativas` con figura rosales (4) y `descripcion`.
- Eventos: `eventos` (3). Menciones: `menciones` (6, de ellas 4 por revisar). Alertas: `alertas` (4, de ellas 3 abiertas).

## 15. Chacao (vista compacta) — `/c/chacao`

Igual que Zulia:

- figura propia duque (participación 52%; el resto es conversación sin figura monitoreada);
- `avance_fase` 10;
- 6 temas, 3 narrativas y 3 eventos;
- 5 menciones (ninguna por revisar);
- 2 alertas (1 abierta);
- serie de duque con pico el día 20.

## No sembrado / fijo en la interfaz

- **`notas_internas`: vacía.** Las pruebas de acceso exigen que no haya notas sembradas.
- **`terminos`: vacía.** Los términos de la demo viven en el borrador del asistente, en `evento_mensajes.terminos` y en `narrativas.detalle.terminos`.
- **No sembrados:** estimaciones de volumen de términos, la vista previa simulada de "Agregar URL" y los ejemplos de AgregarFigura y CrearEvento.
- **Texto fijo de la interfaz:** catálogos de formularios, pasos por tipo de alerta, catálogo del constructor de reglas y secciones de descarga.
