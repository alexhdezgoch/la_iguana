// Límite de errores del Informe: si pintar el documento falla (una edición congelada con una forma inesperada,
// datos incompletos), se muestra un estado claro en lugar de dejar la pantalla en blanco.
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { EDICION_ILEGIBLE } from './edicion';

interface Props { children: ReactNode; titulo?: string; detalle?: string }
interface Estado { error: boolean }

export class LimiteInforme extends Component<Props, Estado> {
  state: Estado = { error: false };
  static getDerivedStateFromError(): Estado { return { error: true }; }
  componentDidCatch(e: Error, info: ErrorInfo) { console.error('Informe:', e, info.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return <IlegibleInforme titulo={this.props.titulo} detalle={this.props.detalle} />;
  }
}

/** Estado "no se puede mostrar": edición de una versión que esta app no conoce, o datos que no se pudieron pintar. */
export function IlegibleInforme({ titulo = EDICION_ILEGIBLE, detalle }: { titulo?: string; detalle?: string }) {
  return (
    <div className="inf-ilegible" role="alert" style={{ padding: '40px 16px', textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
      <p className="b" style={{ margin: '0 0 6px' }}>{titulo}</p>
      <p className="mu" style={{ margin: 0 }}>{detalle ?? 'La copia guardada tiene una forma que esta versión de la app no sabe leer. Los datos siguen guardados; genera una edición nueva desde el informe para verla.'}</p>
    </div>
  );
}
