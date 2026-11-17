import { lazy, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProveedorAcciones } from './shell/Acciones';
import { ProveedorCampanas, ProveedorPagina, useCampana } from './shell/Campana';
import { Layout } from './shell/Layout';
import { ProveedorSesion, useSesion } from './shell/Sesion';
import Login, { SinAcceso } from './pages/Login';
import { sinConfigurar } from './lib/supabase';

const Panorama = lazy(() => import('./pages/Panorama'));
const NuevaCampana = lazy(() => import('./pages/NuevaCampana'));
const Resumen = lazy(() => import('./pages/Resumen'));
const Figuras = lazy(() => import('./pages/Figuras'));
const Figura = lazy(() => import('./pages/Figura'));
const AgregarFigura = lazy(() => import('./pages/AgregarFigura'));
const Eventos = lazy(() => import('./pages/Eventos'));
const Evento = lazy(() => import('./pages/Evento'));
const CrearEvento = lazy(() => import('./pages/CrearEvento'));
const Menciones = lazy(() => import('./pages/Menciones'));
const Temas = lazy(() => import('./pages/Temas'));
const Alertas = lazy(() => import('./pages/Alertas'));
const Reportes = lazy(() => import('./pages/Reportes'));
const InformePagina = lazy(() => import('./pages/reportes/InformePagina'));
const CampanaCompacta = lazy(() => import('./pages/CampanaCompacta'));

export type SeccionCompacta = 'resumen' | 'figuras' | 'eventos' | 'menciones' | 'temas' | 'alertas';

/** Las campañas con vista compacta (precampaña) muestran una sola pantalla con secciones; el resto, la pantalla completa. */
function Seccion({ nombre, children }: { nombre: SeccionCompacta; children: ReactNode }) {
  const campana = useCampana();
  return campana.vista === 'compacta' ? <CampanaCompacta seccion={nombre} /> : <>{children}</>;
}

function Consola() {
  const { cargando, usuario, org } = useSesion();
  if (sinConfigurar) return <div className="acceso"><div className="card"><h2>Falta configurar Supabase</h2><p className="sm">Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.</p></div></div>;
  if (cargando) return <div className="acceso"><div className="cargando">Cargando…</div></div>;
  if (!usuario) return <Login />;
  if (!org) return <SinAcceso />;
  return (
    <ProveedorCampanas>
      <ProveedorPagina>
        <ProveedorAcciones>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Panorama />} />
              <Route path="nueva-campana" element={<NuevaCampana />} />
              <Route path="c/:campanaId">
                <Route index element={<Seccion nombre="resumen"><Resumen /></Seccion>} />
                <Route path="figuras" element={<Seccion nombre="figuras"><Figuras /></Seccion>} />
                <Route path="figuras/nueva" element={<AgregarFigura />} />
                <Route path="figuras/:figuraId" element={<Figura />} />
                <Route path="eventos" element={<Seccion nombre="eventos"><Eventos /></Seccion>} />
                <Route path="eventos/nuevo" element={<CrearEvento />} />
                <Route path="eventos/:eventoId" element={<Evento />} />
                <Route path="menciones" element={<Seccion nombre="menciones"><Menciones /></Seccion>} />
                <Route path="temas" element={<Seccion nombre="temas"><Temas /></Seccion>} />
                <Route path="alertas" element={<Seccion nombre="alertas"><Alertas /></Seccion>} />
                <Route path="reportes" element={<Reportes />} />
                <Route path="reportes/informe/:reporteId" element={<InformePagina />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </ProveedorAcciones>
      </ProveedorPagina>
    </ProveedorCampanas>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ProveedorSesion>
        <Consola />
      </ProveedorSesion>
    </BrowserRouter>
  );
}
