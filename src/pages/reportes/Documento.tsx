// Páginas del reporte tal como las recibe el destinatario. Se usa en la vista previa y para imprimir o descargar.
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { Contenido, ItemDoc, SeccionDoc } from './documento';

const TONO: Record<string, string> = { fav: '#3A76C4', unf: '#D07A2D', own: '#285A32', watch: '#8A928C' };

export interface Marca { iniciales: string; nombre: string }
export interface PropsDoc {
  contenido: Contenido;
  marca: Marca;
  /** Pie izquierdo: "Confidencial · Preparado por …". */
  pie: string;
  /** Ids de secciones que no se muestran. */
  apagadas?: Set<string>;
}

function Item({ i }: { i: ItemDoc }) {
  return (
    <div className="pi">
      <div className="gr">
        <span className="b">{i.texto}</span>
        {i.detalle ? <span className="pgs">{i.detalle}</span> : null}
        {i.enlace ? <span className="pgs">{i.enlace}</span> : null}
      </div>
      {i.barra != null ? <span className="bar" style={{ flex: '0 1 110px' }}><i style={{ width: `${Math.max(0, Math.min(100, i.barra))}%`, background: TONO[i.tono ?? ''] ?? '#454E48' }} /></span> : null}
      {i.chip ? <span className={'chip ' + (i.chip_tono ?? 'watch')}>{i.chip}</span> : null}
      {i.valor || i.valor2 ? <span className="pv2"><span className="b">{i.valor}</span>{i.valor2 ? <span className="pgs">{i.valor2}</span> : null}</span> : null}
    </div>
  );
}

function Seccion({ s }: { s: SeccionDoc }) {
  return (
    <section className="ps">
      <div className="psh">
        <span className="pst">{s.titulo}</span>
        {s.ia && (s.texto || s.puntos?.length) ? <span className="chip warn">Borrador IA, revisar</span> : null}
        {s.nota ? <span className="pgs sp">{s.nota}</span> : null}
      </div>
      {s.texto ? <p className="ptx">{s.texto}</p> : null}
      {s.cifras?.length ? (
        <div className="pk">{s.cifras.map((k, n) => <div key={n}><span className="pgs">{k.etiqueta}</span><span className="pkv">{k.valor}</span>{k.detalle ? <span className="pgs">{k.detalle}</span> : null}</div>)}</div>
      ) : null}
      {s.puntos?.map((b, n) => (
        <div className="pb" key={n}>
          <span className="pbn">{n + 1}</span>
          <div>
            <p className="b">{b.texto}</p>
            {b.por_que ? <p><span className="plb">Por qué importa</span>{b.por_que}</p> : null}
            {b.que_hacer ? <p><span className="plb">Qué hacer</span>{b.que_hacer}</p> : null}
          </div>
        </div>
      ))}
      {s.items?.length ? <div>{s.items.map((i, n) => <Item key={n} i={i} />)}</div> : null}
      {s.vacio && !s.texto && !s.cifras?.length && !s.puntos?.length && !s.items?.length ? <p className="pgs">{s.vacio}</p> : null}
    </section>
  );
}

/** Reparte las secciones visibles por página (campo `pagina`). */
export function paginas(c: Contenido, apagadas?: Set<string>): SeccionDoc[][] {
  const visibles = (c.secciones ?? []).filter((s) => !apagadas?.has(s.id));
  const nums = [...new Set(visibles.map((s) => s.pagina ?? 1))].sort((a, b) => a - b);
  return nums.map((n) => visibles.filter((s) => (s.pagina ?? 1) === n));
}

export function Documento({ contenido, marca, pie, apagadas }: PropsDoc) {
  const pags = paginas(contenido, apagadas);
  const conNotas = (contenido.secciones ?? []).some((s) => s.id === 'notas' && !apagadas?.has('notas'));
  return (
    <>
      {pags.map((secs, i) => (
        <article className="pg" key={i}>
          {i === 0 ? (
            <header className="pgh">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="pgm" aria-hidden="true">{marca.iniciales}</span><span className="b">{marca.nombre}</span></span>
                <span className="pgs">{contenido.tipo_doc}</span>
              </div>
              <div className="pgt">{contenido.titulo}</div>
              <div className="pgs">{contenido.meta}</div>
            </header>
          ) : null}
          {secs.map((s) => <Seccion key={s.id} s={s} />)}
          <footer className="pgf"><span>{pie}</span><span>{conNotas ? 'Incluye notas internas' : 'Sin notas internas'}</span><span>Página {i + 1} de {pags.length}</span></footer>
        </article>
      ))}
    </>
  );
}

// ---------- documento autónomo (imprimir / HTML) ----------
const CSS = `*{box-sizing:border-box}body{margin:0;background:#E9ECE6;color:#1B211D;font:400 13px/18px 'Source Sans 3','Segoe UI',system-ui,sans-serif;font-variant-numeric:tabular-nums lining-nums}
p{margin:0}.doc{display:flex;flex-direction:column;align-items:center;gap:20px;padding:24px 16px}
.pg{width:100%;max-width:640px;min-height:900px;background:#fff;box-shadow:0 0 0 1px rgb(22 32 25/.07),0 8px 16px -4px rgb(22 32 25/.08);border-radius:2px;padding:36px 40px 24px;display:flex;flex-direction:column;gap:16px}
.pgh{display:flex;flex-direction:column;gap:6px;padding-bottom:14px;border-bottom:2px solid #1B211D}
.pgm{flex:none;width:24px;height:24px;border-radius:6px;background:#285A32;color:#fff;display:flex;align-items:center;justify-content:center;font:700 10px/1 'Libre Franklin',system-ui,sans-serif}
.pgt{font:700 22px/28px 'Libre Franklin',system-ui,sans-serif;letter-spacing:-.015em;margin-top:8px}
.pgs{font-size:12px;line-height:16px;color:#636C66}.b{font-weight:600}.sp{margin-left:auto}
.ps{display:flex;flex-direction:column;gap:6px;break-inside:avoid}
.psh{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;padding-bottom:4px;border-bottom:1px solid rgb(22 32 25/.10)}
.pst{font:700 12px/18px 'Libre Franklin',system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase;color:#285A32}
.chip{display:inline-flex;align-items:center;padding:1px 6px;border-radius:6px;font-size:11px;line-height:16px;font-weight:600;white-space:nowrap;background:#EEF0EC;color:#4A524D}
.fav{background:#E8F0FA;color:#1D4F91}.unf{background:#FCEFE2;color:#8F4A0B}.warn{background:#FBF3D9;color:#7A5A00}.live,.own{background:#E7F0E8;color:#285A32}
.pk{display:flex;flex-wrap:wrap;gap:8px}.pk>div{flex:1 1 76px;min-width:0;display:flex;flex-direction:column;gap:1px;padding:8px;border-radius:6px;background:#F1F3EF}
.pkv{font:600 18px/24px 'Libre Franklin',system-ui,sans-serif;letter-spacing:-.02em}
.pb{display:flex;gap:10px;padding:5px 0}.pb>div{display:flex;flex-direction:column;gap:2px;min-width:0}
.pbn{flex:none;width:20px;height:20px;border-radius:50%;background:#E7F0E8;color:#285A32;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}
.plb{margin-right:6px;font-size:11px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:#636C66}
.pi{display:flex;align-items:center;gap:10px;padding:5px 0;border-top:1px solid rgb(22 32 25/.07)}.pi:first-child{border-top:0}
.gr{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.bar{flex:1;min-width:40px;height:8px;border-radius:999px;background:#ECEFEA;overflow:hidden}.bar>i{display:block;height:100%;border-radius:999px}
.pv2{flex:none;display:flex;flex-direction:column;align-items:flex-end;text-align:right}
.pgf{margin-top:auto;display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 12px;padding-top:10px;border-top:1px solid rgb(22 32 25/.10);font-size:11px;line-height:16px;color:#636C66}
@media print{body{background:#fff}.doc{padding:0;gap:0}.pg{max-width:none;min-height:0;box-shadow:none;padding:0 0 12px;break-after:page}.pg:last-child{break-after:auto}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}`;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

/** HTML completo del documento, sin depender de la app: sirve para imprimir o guardar. */
export function documentoHtml(p: PropsDoc, opciones: { imprimir?: boolean } = {}): string {
  const div = document.createElement('div');
  const raiz = createRoot(div);
  flushSync(() => raiz.render(createElement(Documento, p)));
  const cuerpo = div.innerHTML;
  raiz.unmount();
  const titulo = esc(p.contenido.titulo ?? 'Reporte');
  const auto = opciones.imprimir ? '<script>window.addEventListener("load",function(){setTimeout(function(){window.focus();window.print();},150);});</script>' : '';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title><style>${CSS}</style></head><body><div class="doc">${cuerpo}</div>${auto}</body></html>`;
}

/** Abre el documento en una ventana nueva y lanza el diálogo de impresión (desde ahí se guarda como PDF). */
export function imprimir(p: PropsDoc): boolean {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open();
  w.document.write(documentoHtml(p, { imprimir: true }));
  w.document.close();
  return true;
}
