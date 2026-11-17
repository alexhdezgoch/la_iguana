# Semilla: de dónde sale cada dato de la demo

Mapa de cada pantalla de `design/demo/*.dc.html` a la base. Si un valor no aparece aquí, es **texto fijo de la interfaz y se queda en el componente**. Si aparece como **derivado**, se calcula al leer y no se guarda.

Los datos están en `supabase/seed/<tabla>.json`. `rig/semilla.mjs` los carga en el orden de `ORDEN`. Las campañas son `presidenciales` (completa), `zulia` y `chacao` (vista compacta) e `informe-ejemplo` (vista compacta, corpus crudo del Informe, sección 16). Además existe `vacia`, que se crea solo en las pruebas.

## Reglas generales

- **Hoy** = `campanas.fecha_corte` (2027-05-13). El periodo es `campanas.periodo_inicio..periodo_fin`, del 14 de abril al 13 de mayo, 30 días. La demo se ve como si fueran las 09:15 en America/Caracas. Todos los instantes llevan `-04:00`.
- **Valores crudos.** Los porcentajes son números (31.0, no "31%"). Las cifras van sin separador y las fechas en ISO. El formato lo pone `src/lib/formato.ts`.
- **Totales guardados.** `temas.menciones`, `figura_metricas.menciones`, `narrativas.menciones` y similares son instantáneas. No se recalculan sumando series. Las series (`series_diarias`) sí suman exactamente el total del periodo, salvo que se diga otra cosa.
- **Pendientes de revisión** (barra lateral, Menciones): `requiere_revision and not revisada and estado <> 'Descartada'`. Hoy hay 3 / 4 / 0 (presidenciales / zulia / chacao) en `v_campanas_resumen.menciones_por_revisar`.
- **Alertas abiertas**: `estado in ('Nueva','En revisión','Pospuesta')`. Hoy hay 5 / 3 / 1 en `v_campanas_resumen.alertas_abiertas`. `ALERTAS_ABIERTAS` está en `tipos`.
- **Personas**: siempre por `persona_id`. El nombre visible es `personas.nombre`. Las iniciales son derivadas. Para mostrar autores y responsables a cualquier rol (también Cliente, que no lee `personas`) está la vista `v_personas_campana` (`id`, `nombre_corto`, `iniciales`) y el hook `useNombres()`.
- **Nombres cortos**: `figuras.nombre_corto` ("Machado", "González U.", "D. Rodríguez", "J. Rodríguez") para encabezados como "Neto de Machado"; `campanas.nombre_corto` ("Presidenciales", "Zulia", "Chacao") para filtros y chips. Pueden ser null: se usa `nombre` (helper `corto()` de `formato.ts`).
- Las citas de publicaciones ciudadanas se guardan como descripciones neutras en tercera persona. La cobertura se cuenta en notas y nunca se valora en dinero. La coordinación siempre es "posible".

### Contenido sobre personas reales (escenario hipotético)

La demo usa figuras públicas reales con cifras y hechos inventados. Toda la semilla sale de `rig/generar-semilla.py` (`python3 rig/generar-semilla.py` y después `node rig/semilla.mjs`); los JSON y `seed.sql` no se editan a mano.

- **Fuentes genéricas, nunca un medio real.** `menciones.fuente`, `alertas.detalle.evidencia[].fuente`, `narrativas.detalle.publicaciones[].fuente` e `impulsores[].medio`, `figura_metricas.detalle.cobertura.por_medio[].medio`, `reglas_alerta.condicion.alcance.medios` y los ítems de medios de los reportes usan solo estas etiquetas: `Medio digital nacional`, `Portal de noticias`, `Diario nacional`, `Diario digital`, `Medio regional`, `Emisora de radio`, `Canal de TV`, `Canal de noticias de TV`, o `Cuenta pública`, `Cuenta oficial`, `Cuenta oficial de una figura en seguimiento`, `Cuentas sin afiliación pública`. El tipo (`fuente_tipo`, `canal`) sigue los vocabularios de abajo.
- **Corpus del Informe (`informe-ejemplo`): etiquetas genéricas numeradas.** Ahí las noticias y las cuentas usan etiquetas genéricas con número para que el informe tenga muchas fuentes distintas. Además de la lista de arriba, en esta campaña se usan:
  - `menciones.fuente` de noticias: las etiquetas de arriba con número ("Portal de noticias 7", "Medio regional 3", "Diario digital 2", "Diario nacional 1", "Medio digital nacional 2", "Emisora de radio 2", "Canal de noticias de TV 1").
  - `menciones.fuente` de publicaciones de organizaciones (el `autores.nombre` de la cuenta): "Portal de noticias N", "Medio digital N", "Medio regional N", "Diario digital N", "Emisora de ejemplo", "Partido de ejemplo N", "Partido de ejemplo 1 (exterior)", "Campaña de ejemplo N". Las cuentas que no son organizaciones (personales, periodistas, analistas, cuentas de opinión) llevan "Cuenta pública" y las de la figura propia "Cuenta oficial de una figura en seguimiento".
  - `autores.handle`: `@portal_noticias_3`, `@medio_digital_4`, `@cuenta_opinion_2`, `@periodista_ejemplo_1`, `@partido_ejemplo_1`, `@campana_ejemplo_1`, `@emisora_ejemplo`, `@canal_video_2`, `@cuenta_personal_12`. `autores.id` es neutro (`inf-a-0001`…, no sale del usuario) y `menciones.url` de redes es `https://<red>.example/p/<azar>`, sin el usuario de la cuenta.
  - `recolecciones.faltantes[]`: `{cuenta, motivo, desde?, es_organizacion?}`. `informe_datos` muestra `cuenta` solo si coincide con un autor visible o si la entrada trae `es_organizacion: true`; si no, "Cuenta personal".

  Nunca una cuenta o un medio real. Textos y titulares "de ejemplo" sin comillas ni citas; los resúmenes de destacadas terminan en "(ejemplo)". El generador lo comprueba.
- **Títulos descriptivos "de ejemplo".** "Nota de ejemplo sobre…", "Segmento de radio de ejemplo sobre…", "Publicación ciudadana de ejemplo…". No hay citas, entrevistas ni declaraciones atribuidas a personas reales.
- **Sin acciones atribuidas a personas reales.** Las alertas y reportes dicen "Una cuenta oficial de una figura rival publicó sobre…" y no llevan `figura_id` de la persona (`pres-alerta-3`, `zulia-alerta-3`). La sección "Rivales" del corte diario cuenta publicaciones de cuentas rivales por tema. Las reacciones de rivales al debate no se vinculan a narrativas en contra (`narrativa_id` y `menciones` null).
- **Narrativas en contra sin figuras como impulsoras.** En las narrativas `Desfavorable`, `detalle.impulsores` solo tiene `{medio}` (medios genéricos o `Cuentas sin afiliación pública`); el generador lo comprueba.
- **Nombres de narrativa = temas neutros.** No describen ni valoran a la persona ("Diálogo y fecha electoral", "Negociación y acuerdos", "Renovación política", "Resultados en movilidad"). Las descripciones de posicionamiento dicen "Menciones sobre … asociadas a la figura", sin afirmar que la figura promueve un mensaje. Los ids no cambian (`pres-fuera-del-dialogo`, `pres-linea-dura`, `zulia-mas-de-lo-mismo`, `chacao-trafico`…).
- **Cargos neutros.** `figuras.cargo` es un rol descriptivo ("Dirigente opositora", "Dirigente del PSUV", "Dirigente de Un Nuevo Tiempo", "Dirigente regional", "Dirigente municipal") que no afirma un cargo público vigente ni una candidatura. `machado.extra.subtitulo` = "Nobel de la Paz 2025" (hecho). Las relaciones de campaña (Propia, Rival…) y `extra_campana.candidatura` son del escenario.
- **Nada se envió.** La actividad de alertas no dice que se notificó por WhatsApp, email o Slack. Las notas de envíos fallidos o parciales empiezan con "Ejemplo:".
- **Marca del cliente de ejemplo.** `marca_cliente` = "Cliente de ejemplo · escenario hipotético" (CE) y las listas de destinatarios dicen "(ejemplo)". Todo documento de una campaña `es_demo` (vista previa, impresión, PDF y HTML) lleva arriba de cada página la línea "Escenario hipotético: personas reales, cifras y hechos inventados." (`marcaDe` en `src/lib/reportes/marca.ts` la pone en `Marca.aviso` y `Documento.tsx` la muestra).

## Vocabularios

| Campo | Valores |
|---|---|
| `campana_figuras.relacion` | Propia, Aliada, Rival, A observar |
| `miembros_campana.rol` | Administración, Análisis, Solo lectura, Cliente |
| `campana_fases.nombre` | Precampaña, Intercampaña, Campaña, Veda, Jornada electoral, Post-electoral |
| `narrativas.direccion` | Favorable (chip "A favor"), Desfavorable ("En contra"), Sin dirección, Posicionamiento |
| `narrativas.tendencia`, `temas.tendencia` | En aumento, Estable, A la baja, Emergente |
| `narrativas.detalle.relacionadas[].tipo` | Contranarrativa, Relacionada |
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
| `reportes.tipo` | Corte diario, Post-evento, Semanal de narrativas, A la medida, Informe |
| `autores.tipo` | Medio, Periodista, Partido u organización, Campaña política, Cuenta de opinión con gran audiencia, Analista, Emisora, Cuenta personal, Tipo no confirmado |
| `menciones.formato` | Texto, Foto, Video, Reel, Artículo, En vivo |
| `menciones.tipo_pub` | Original, Respuesta, Cita, Repost |
| `mencion_ejes.metodo` | Regla, Búsqueda, Manual (los rankings del Informe usan Regla y Manual) |
| `recolecciones.metodo` | Búsqueda avanzada, Cuentas, Etiquetas, RSS, Búsqueda por palabras, Páginas |
| `codigos.tono` | apoyo, critica, neutro |
| `muestras.objeto` / `muestras.ponderacion` | comentarios, menciones / ninguna, por volumen |
| `codificaciones.codificado_por` | Persona, Modelo |
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
- Breadcrumb: `campanas.titulo_largo`. El botón de periodo muestra el periodo guardado de la campaña (`nombrePeriodo`: "Últimos 30 días" cuando `periodo_fin` es la fecha de corte), porque solo existe el corte `30d`.
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
| Próximo evento | primer `eventos` con `fecha_inicio >= hoy` y estado distinto de Cancelado o Borrador: `pres-segundo-debate`. "En 10 días" es derivado. En Zulia es `zulia-recorrido` (Programado, en 5 días); en Chacao, `chacao-asamblea-altamira` (en 7 días). |
| Temas del periodo | `temas` por `orden`: `nombre`, `porcentaje`, `menciones` |
| Narrativas sobre la figura | `narrativas` con `figura_id` igual a la figura propia o con la figura en `detalle.figura_ids`, ordenadas por `menciones` desc: `nombre`, `menciones`, `tendencia`, `direccion`. Son **6** (5 con `figura_id` = machado más `pres-fecha-cierta`, que la lista en `figura_ids`), igual en Resumen, Temas y Figura. |

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
- Narrativas: `narrativas` con `figura_id`, o la figura dentro de `detalle.figura_ids` (Machado: 6).
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

- Temas: `temas` (nombre, menciones, porcentaje, cambio, tendencia, es_propio). Por canal: `detalle.canales [{canal, porcentaje}]`. "Otros" lleva `detalle.otros = true`.
  - `temas.cambio` es el cambio del periodo guardado frente a los 30 días previos (la leyenda dice "Cambio vs. 30 días previos"). No se puede derivar de la serie, que solo cubre el periodo. `detalle.cambio_ventana` aparece cuando el cambio es de otra ventana ("48 h" en `zulia-electricidad`). Con la ventana de 24 h o 7 días, el cambio sí se deriva de la serie.
- Nota del encabezado: `campanas.extra.nota_temas`.
- Series de temas: `series_diarias` con entidad `tema` (7 × 30, cada una suma `temas.menciones`).
- Mapa de calor tema × figura: `tema_figuras`.
  - `porcentaje` = % del tema que corresponde a la figura. Las menciones de la figura propia en los 7 temas suman exactamente su total (62,000).
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
- Serie de narrativas: `series_diarias` con entidad `narrativa` (11 × 30). Cada serie es 0 antes de `detectada_el`, suma `menciones` y reproduce lo guardado:
  - último día = `menciones_24h`; `cambio_24h` = último día frente al anterior;
  - `cambio_7d` = días 24-30 frente a 17-23 (null en las emergentes, que la tabla muestra como "nueva");
  - `veces_promedio` (solo emergentes) = último día / promedio de los 7 días anteriores, contando como 0 los días previos a la detección.
  - El generador comprueba las tres cosas. En `pres-fuera-del-dialogo` ("Diálogo y fecha electoral") el día anterior es 1,240 y el último 2,010, igual que la gráfica de `pres-alerta-1`.

## 11. Alertas — `/c/:id/alertas`

- Bandeja: `alertas`:
  - severidad, estado, tipo, texto, detectada_en, disparos;
  - responsable_id → personas, pospuesta_hasta, resuelta_en, motivo_cierre;
  - FKs a figura, narrativa, tema y evento.
- Detalle:
  - `explicacion`, `valor`, `umbral`, `ventana`
  - `detalle.grafica {metrica, serie[], umbral, rango[min,max], indice_disparo, desde, hasta, signo?}`
  - `detalle.evidencia [{fuente, canal, publicada_en, descripcion, alcance, sentimiento}]`
  - `detalle.menciones_relacionadas` (número): cuántas menciones sembradas abre "Ver las N en Menciones" (mismo filtro que la pantalla: narrativa, evento, tema o figura)
  - `detalle.contexto {texto, enlace}`
  - `detalle.pasos [str]`: los pasos sugeridos se guardan en cada alerta; el mapa STEPS de la demo no se usa
  - `detalle.nota_estado?`
- Actividad: `alerta_actividad` (texto sin el nombre al inicio, persona_id cuando la acción la hizo una persona, creada_en). Las fechas de los textos son absolutas ("hasta el 14 may, 7:00"), no relativas. No hay filas de notificación enviada.
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
  `pres-envio-cliente-0503` conserva su id, pero es la versión para el cliente del corte del jueves 13 de mayo (periodo 12 may 7:00 a 13 may 7:00, generado el 13 a las 7:05), igual que su contenido. "Menciones en 24 h" del corte es el último día de la serie de Machado (3,051, +3%). Los cambios del semanal son los `cambio_7d` de las narrativas.
- Marca del cliente: `campanas.extra.marca_cliente {nombre, iniciales}` ("Cliente de ejemplo · escenario hipotético", CE).
- Las secciones de "Descargar reporte" son **texto fijo de la interfaz y se quedan en el componente**.

## 13. Nueva campaña (asistente) — `/nueva`

- Borrador: `borradores` (`borrador-maracaibo`, persona valentina, tipo `nueva-campana`). El asistente usa el reloj real, así que `actualizado_en` (2026-11-10) es anterior a hoy y no a la fecha de la demo. `datos {paso, campana{…}, fases[], figuras[{figura_id, relacion, terminos[]}], confirmo_personas_publicas, terminos[], temas[], equipo[{persona_id, rol}]}`.
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
- Eventos: `eventos` (3). `zulia-recorrido` es Programado: es el próximo evento (en 5 días). Menciones: `menciones` (6, de ellas 4 por revisar). Alertas: `alertas` (4, de ellas 3 abiertas). `zulia-alerta-2` tiene el mismo texto que `pres-alerta-4` (Panorama las cuenta una vez), con los valores de Zulia (neto +4).

## 15. Chacao (vista compacta) — `/c/chacao`

Igual que Zulia:

- figura propia duque (participación 52%; el resto es conversación sin figura monitoreada);
- `avance_fase` 10;
- 6 temas, 3 narrativas y 3 eventos;
- 5 menciones (ninguna por revisar);
- 2 alertas (1 abierta);
- serie de duque con pico el día 20.

## 16. Informe de ejemplo — `/c/informe-ejemplo` (y `/c/informe-ejemplo/reportes`)

Campaña `es_demo` "Monitoreo de ejemplo · Venezuela 2027" (vista compacta, figura propia machado; rivales delcy-rodriguez y capriles, aliada gonzalez-urrutia). Mismo equipo que presidenciales; en el banco de pruebas `analista`, `lector` y `cliente` tienen ahí el mismo rol que en presidenciales (`rig/usuarios.sql`). Solo tiene filas crudas: no hay `figura_metricas`, temas, narrativas ni alertas, así que sus pantallas de cortes guardados salen vacías. Todo sale de la sección "Informe de ejemplo" de `rig/generar-semilla.py` (RNG con semilla fija); `node rig/semilla.mjs` escribe además `supabase/seed_informe.sql`, solo con esta campaña y `on conflict do nothing`, para cargarla en producción.

- Evento `inf-programa-radio` "Programa de radio de ejemplo" (tipo Encuentro ciudadano: el vocabulario no tiene un tipo para un programa de radio y no se usa Entrevista, para no atribuir una entrevista a la figura), martes 11 de mayo 08:30–09:15 (hora estimada). Los textos hablan del "programa de ejemplo" o del "segmento de ejemplo", nunca de una entrevista ni de lo que la figura dijo; el generador rechaza "entrevista", "lo dicho" y "declaración" en esta campaña.
- Ejes (`ejes`): `inf-eje-conversacion` (Sobre la figura o el evento), `inf-eje-foco` (Sobre el evento), `inf-eje-anfitrion` (Nombra al medio anfitrión) y los cuatro del tema: `inf-eje-figura`, `inf-eje-servicios`, `inf-eje-fecha`, `inf-eje-economia`. Cada uno con `regla`.
- `autores`: 79 cuentas en X, Instagram, TikTok, YouTube y Facebook (las noticias no tienen autor: su `fuente` es el medio). Seguidores a los dos lados de 100.000; en Instagram no hay seguidores (solo se publican organizaciones y la cuenta de la figura).
- `menciones`: unas 4,400. Evento (10 al 12 de mayo 11:00): ~2,000 filas, conversación 724 / 965 / 201 por día (1.33 veces la base), pico a las 09:00 del 11, foco 206, filas fuera de tema (`en_tema` false: publicaciones de la emisora sobre otros temas) y de otro país. Tema (6 al 10): noticias, X, Instagram y Facebook; el 10 sale del corpus del evento. `mencion_ejes` con método Regla, Búsqueda (fuera de los rankings) y Manual.
- `comentarios`: 2,060 (1,010 del evento en 26 publicaciones, 76 % de TikTok en un video; 1,050 del tema). Sin autor. Algunos `solo_emojis` y `duplicado`.
- `codigos`: libro `General` (12 códigos, evento) y libro `Tema` (11). `muestras`: `inf-mu-comentarios` (340, estratos por canal con universo = comentarios recolectados, ponderada por volumen), `inf-mu-x` (150 publicaciones de X), `inf-mu-tema` (420 de Instagram y Facebook). 910 `codificaciones` (Persona y Modelo, revisado).
- `recolecciones`: una por canal y método, con pedidas, leídas, faltantes, límites y topes. En X, Figura propia llega al tope de 250 el 6 y el 9 de mayo (`estimado` 472 y 419).
- `reportes` de tipo Informe: `inf-rep-evento` (modo evento, día base 10, ventana estimada, comparación, destacadas y cuentas propias de la emisora con su "Qué es") e `inf-rep-tema` (modo tema, cuatro ejes, `canales` sin TikTok ni YouTube, cuentas personales omitidas en las tablas de cuentas, ejemplos por eje). Textos de sección vacíos: los llena quien analiza. Sin ediciones: las crea "Generar edición".

## No sembrado / fijo en la interfaz

- **`notas_internas`: vacía.** Las pruebas de acceso exigen que no haya notas sembradas.
- **`terminos`: vacía.** Los términos de la demo viven en el borrador del asistente, en `evento_mensajes.terminos` y en `narrativas.detalle.terminos`.
- **No sembrados:** estimaciones de volumen de términos, la vista previa simulada de "Agregar URL" y los ejemplos de AgregarFigura y CrearEvento.
- **Texto fijo de la interfaz:** catálogos de formularios, pasos por tipo de alerta, catálogo del constructor de reglas y secciones de descarga.
