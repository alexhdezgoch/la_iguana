// Monta el panel abierto. Cada panel vive en su propio archivo de esta carpeta.
import { useAcciones } from '../Acciones';
import { Buscador } from './Buscador';
import { Periodo } from './Periodo';
import { AgregarUrl } from './AgregarUrl';
import { Descarga } from './Descarga';

export function Paneles() {
  const { panel, cerrarPanel } = useAcciones();
  if (!panel) return null;
  const p = { panel, cerrar: cerrarPanel };
  switch (panel.tipo) {
    case 'buscador': return <Buscador {...p} />;
    case 'periodo': return <Periodo {...p} />;
    case 'url': return <AgregarUrl {...p} />;
    case 'descarga': return <Descarga {...p} />;
  }
}
