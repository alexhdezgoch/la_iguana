import type { SeccionCompacta } from '../App';
import { usePagina } from '../shell/Campana';

export default function CampanaCompacta({ seccion }: { seccion: SeccionCompacta }) {
  usePagina('Resumen');
  return (
    <main className="page">
      <div className="ph"><div><h1>{seccion}</h1><p className="mu">Pantalla en construcción.</p></div></div>
    </main>
  );
}
