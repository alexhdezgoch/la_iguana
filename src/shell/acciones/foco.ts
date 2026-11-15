// Foco de los paneles modales: Tab y Shift+Tab giran dentro de la caja, y al cerrar el foco vuelve a donde estaba.
import { useEffect, type RefObject } from 'react';

const ENFOCABLES = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';

/** Elementos de la caja a los que se llega con Tab, en orden y visibles. */
export function enfocables(caja: HTMLElement): HTMLElement[] {
  return Array.from(caja.querySelectorAll<HTMLElement>(ENFOCABLES))
    .filter((el) => el.tabIndex >= 0 && (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0));
}

/**
 * Atrapa Tab dentro de `caja` mientras el panel está montado. Siempre mueve el foco a mano (también desde
 * contenedores con scroll, que Chrome hace enfocables), así nunca sale del panel.
 * Si `devolver` es true, al desmontar devuelve el foco al elemento que lo tenía al abrir.
 */
export function useTrampaFoco(caja: RefObject<HTMLElement | null>, devolver = true) {
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !caja.current) return;
      const f = enfocables(caja.current);
      e.preventDefault();
      if (!f.length) { caja.current.focus?.(); return; }
      const i = f.indexOf(document.activeElement as HTMLElement);
      const n = i < 0 ? (e.shiftKey ? f.length - 1 : 0) : (i + (e.shiftKey ? f.length - 1 : 1)) % f.length;
      f[n].focus();
    };
    document.addEventListener('keydown', tecla, true);
    return () => {
      document.removeEventListener('keydown', tecla, true);
      if (devolver && previo && previo !== document.body && previo.isConnected) {
        try { previo.focus({ preventScroll: true }); } catch { /* nada */ }
      }
    };
  }, [caja, devolver]);
}
