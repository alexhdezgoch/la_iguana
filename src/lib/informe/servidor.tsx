// El Informe como página HTML completa y autónoma (sin la app): para Imprimir / Guardar PDF (ventana nueva),
// para la descarga HTML y para el PDF sin pantalla (rig/informe-pdf.mjs, y el trabajador de la fase 2).
// Usa renderToStaticMarkup, que corre igual en el navegador y en Node. El CSS va en línea.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import css from './informe.css?raw';
import { Informe, type PropsInforme } from './Informe';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
const PAGINA = 'html,body{margin:0}body{background:#E9ECE6;padding:24px 16px}@media print{body{background:#fff;padding:0}}';

/** HTML completo del Informe. `imprimir`: abre el diálogo de impresión al cargar. */
export function informeHtml(p: PropsInforme, o: { imprimir?: boolean } = {}): string {
  const cuerpo = renderToStaticMarkup(createElement(Informe, p));
  const titulo = esc(p.datos.portada?.titulo ?? 'Informe');
  const auto = o.imprimir ? '<script>window.addEventListener("load",function(){setTimeout(function(){window.focus();window.print();},250);});</script>' : '';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title><style>${PAGINA}${css}</style></head><body data-informe-listo="1">${cuerpo}${auto}</body></html>`;
}

/** Abre el Informe en una ventana nueva lista para imprimir o guardar como PDF. false si el navegador bloqueó la ventana. */
export function imprimirInforme(p: PropsInforme): boolean {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open();
  w.document.write(informeHtml(p, { imprimir: true }));
  w.document.close();
  return true;
}
