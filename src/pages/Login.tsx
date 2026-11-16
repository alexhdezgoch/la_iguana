import { useState, type FormEvent } from 'react';
import { Logo } from '../shell/Iconos';
import { supabase } from '../lib/supabase';
import { useSesion } from '../shell/Sesion';

/** Entrada con correo y contraseña. Las cuentas las crea quien administra Wana: no hay registro abierto. */
export default function Login() {
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setOcupado(true); setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: clave });
      if (error) setError(/invalid login credentials/i.test(error.message) ? 'Correo o contraseña incorrectos.' : error.message);
    } catch {
      setError('No se pudo conectar. Intenta de nuevo.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="acceso">
      <form className="card" onSubmit={enviar}>
        <span className="logo"><Logo />Wana</span>
        <div>
          <h1 style={{ margin: 0, font: "600 20px/26px 'Libre Franklin',system-ui,sans-serif", letterSpacing: '-.015em' }}>Entrar</h1>
          <p className="mu" style={{ margin: '4px 0 0' }}>Consola de monitoreo para campañas políticas.</p>
        </div>
        <label className="campo"><span>Correo</span>
          <input className="entrada" type="email" name="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="campo"><span>Contraseña</span>
          <input className="entrada" type="password" name="password" autoComplete="current-password" required value={clave} onChange={(e) => setClave(e.target.value)} />
        </label>
        {error ? <p className="error-txt" role="alert">{error}</p> : null}
        <button type="submit" className="btn bp" style={{ justifyContent: 'center' }} disabled={ocupado}>{ocupado ? 'Un momento…' : 'Entrar'}</button>
        <p className="mu">¿No tienes cuenta? Pídela a quien administra tu equipo.</p>
      </form>
    </div>
  );
}

/** Sesión válida pero la cuenta no está ligada a ninguna persona de un equipo. */
export function SinAcceso() {
  const { usuario, salir } = useSesion();
  return (
    <div className="acceso">
      <div className="card">
        <span className="logo"><Logo />Wana</span>
        <h2 style={{ margin: 0, font: "600 17px/24px 'Libre Franklin',system-ui,sans-serif" }}>Tu cuenta todavía no tiene acceso</h2>
        <p className="sm">{usuario?.email} no está en ningún equipo. Pide a quien administra Wana que te agregue con este correo.</p>
        <button type="button" className="btn bg" style={{ justifyContent: 'center' }} onClick={() => void salir()}>Cerrar sesión</button>
      </div>
    </div>
  );
}
