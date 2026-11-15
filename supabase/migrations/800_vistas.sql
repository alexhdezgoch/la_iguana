-- Vistas de lectura. security_invoker: aplican las reglas de acceso de quien consulta.

-- Figuras de una campaña con su relación y su corte de 30 días (el único periodo con datos en esta fase).
create view public.v_figuras_campana with (security_invoker = true) as
select
  cf.id, cf.campana_id, cf.figura_id, cf.relacion, cf.orden, cf.responsable_id, cf.extra as extra_campana,
  f.org_id, f.nombre, f.iniciales, f.cargo, f.partido, f.coalicion, f.territorio, f.tipo, f.cuentas, f.trayectoria, f.extra,
  m.periodo, coalesce(m.menciones, 0) as menciones, m.participacion, m.favorable, m.neutral, m.desfavorable, m.neto,
  m.alcance, m.seguidores, m.interaccion, m.notas_medios, m.riesgo, m.riesgo_nivel, coalesce(m.detalle, '{}'::jsonb) as detalle
from public.campana_figuras cf
join public.figuras f on f.id = cf.figura_id
left join public.figura_metricas m on m.campana_id = cf.campana_id and m.figura_id = cf.figura_id and m.periodo = '30d';

-- Una fila por campaña con lo que muestran Panorama y la barra lateral.
create view public.v_campanas_resumen with (security_invoker = true) as
select
  c.id, c.id as campana_id, c.org_id, c.nombre, c.contienda, c.titulo_largo, c.iniciales, c.ambito, c.fase, c.vista, c.es_demo, c.orden,
  c.inicio_campana, c.fin_campana, c.veda_inicio, c.veda_fin, c.jornada, c.fecha_corte, c.zona_horaria, c.figura_propia_id,
  fp.nombre as figura_propia,
  m.menciones, m.participacion, m.neto, m.riesgo, m.riesgo_nivel,
  (select count(*)::int from public.campana_figuras cf where cf.campana_id = c.id) as figuras,
  (select count(*)::int from public.alertas a where a.campana_id = c.id and a.estado in ('Nueva','En revisión','Pospuesta')) as alertas_abiertas,
  (select count(*)::int from public.alertas a where a.campana_id = c.id and a.estado in ('Nueva','En revisión','Pospuesta') and a.severidad = 'Alta') as alertas_altas,
  (select count(*)::int from public.menciones x where x.campana_id = c.id and x.requiere_revision and not x.revisada and x.estado <> 'Descartada') as menciones_por_revisar
from public.campanas c
left join public.figuras fp on fp.id = c.figura_propia_id
left join public.figura_metricas m on m.campana_id = c.id and m.figura_id = c.figura_propia_id and m.periodo = '30d';
