-- Solo para el banco de pruebas: cuentas de prueba, una por rol. Contraseña de todas: iguana-rig
-- admin@rig.test     admin del equipo Brújula (ve todo)
-- analista@rig.test  Análisis en presidenciales e informe-ejemplo
-- lector@rig.test    Solo lectura en presidenciales, zulia, vacia e informe-ejemplo
-- cliente@rig.test   Cliente en presidenciales e informe-ejemplo (sin notas internas)
-- ajeno@rig.test     otra organización (no debe ver nada de Brújula)
insert into public.organizaciones (id, nombre, iniciales) values ('otra-org', 'Otra consultora', 'OC') on conflict do nothing;
-- Campaña vacía, para probar estados sin datos: /c/vacia
insert into public.campanas (id, org_id, nombre, contienda, titulo_largo, iniciales, ambito, fase, orden) values
  ('vacia', 'brujula', 'Campaña vacía', 'Prueba 2027', 'Campaña vacía de prueba', 'CV', 'Municipales', 'Precampaña', 9) on conflict do nothing;
insert into public.personas (id, org_id, nombre, nombre_corto, iniciales, email, rol_org) values
  ('rig-admin', 'brujula', 'Admin de prueba', 'Admin P.', 'AP', 'admin@rig.test', 'admin'),
  ('rig-analista', 'brujula', 'Analista de prueba', 'Analista P.', 'AN', 'analista@rig.test', 'miembro'),
  ('rig-lector', 'brujula', 'Lector de prueba', 'Lector P.', 'LP', 'lector@rig.test', 'miembro'),
  ('rig-cliente', 'brujula', 'Cliente de prueba', 'Cliente P.', 'CP', 'cliente@rig.test', 'externo'),
  ('rig-ajeno', 'otra-org', 'Ajeno de prueba', 'Ajeno P.', 'AJ', 'ajeno@rig.test', 'admin')
on conflict do nothing;
insert into public.miembros_campana (campana_id, persona_id, rol) values
  ('presidenciales', 'rig-analista', 'Análisis'),
  ('presidenciales', 'rig-lector', 'Solo lectura'),
  ('presidenciales', 'rig-cliente', 'Cliente'),
  ('zulia', 'rig-lector', 'Solo lectura'),
  ('vacia', 'rig-lector', 'Solo lectura'),
  -- Informe de ejemplo: los mismos roles que en presidenciales.
  ('informe-ejemplo', 'rig-analista', 'Análisis'),
  ('informe-ejemplo', 'rig-lector', 'Solo lectura'),
  ('informe-ejemplo', 'rig-cliente', 'Cliente')
on conflict do nothing;
-- Borrador del asistente para admin@rig.test: copia del sembrado (Alcaldía de Maracaibo), para retomarlo en /nueva-campana.
insert into public.borradores (id, org_id, persona_id, tipo, datos, actualizado_en)
select 'borrador-rig-admin', b.org_id, 'rig-admin', b.tipo, b.datos, b.actualizado_en from public.borradores b where b.id = 'borrador-maracaibo'
on conflict do nothing;
insert into auth.users (id, email, clave, email_confirmed_at) values
  ('00000000-0000-4000-8000-000000000001', 'admin@rig.test', 'iguana-rig', now()),
  ('00000000-0000-4000-8000-000000000002', 'analista@rig.test', 'iguana-rig', now()),
  ('00000000-0000-4000-8000-000000000003', 'lector@rig.test', 'iguana-rig', now()),
  ('00000000-0000-4000-8000-000000000004', 'cliente@rig.test', 'iguana-rig', now()),
  ('00000000-0000-4000-8000-000000000005', 'ajeno@rig.test', 'iguana-rig', now())
on conflict do nothing;
