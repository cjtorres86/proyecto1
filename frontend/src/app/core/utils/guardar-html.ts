// "Guardar" de los informes interactivos: arma un archivo .html que se abre
// solo, sin el sistema (sin sesión ni conexión), con los estilos de la página,
// su contenido y, si hace falta, un script propio para la interacción.

// Todos los estilos que usa la página ahora (Tailwind, Angular Material y los
// de cada componente), como texto.
export function estilosDeLaPagina(): string {
  let css = '';
  for (const hoja of Array.from(document.styleSheets)) {
    try {
      css += Array.from(hoja.cssRules).map((r) => r.cssText).join('\n') + '\n';
    } catch {
      // Hoja de otro origen (no se puede leer): se omite.
    }
  }
  return css;
}

const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Un documento completo. "script" se incluye tal cual (el cierre de etiqueta
// se protege para que un texto con "</script>" no rompa el archivo).
export function documentoAutonomo(o: { titulo: string; estilos: string; cuerpo: string; script?: string; claseHtml?: string }): string {
  const script = o.script ? `<script>\n${o.script.replace(/<\/script/gi, '<\\/script')}\n</script>` : '';
  return `<!doctype html>
<html lang="es"${o.claseHtml ? ` class="${o.claseHtml}"` : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Reporte Avance de Sumarios">
<title>${escapar(o.titulo)}</title>
<style>${o.estilos.replace(/<\/style/gi, '<\\/style')}</style>
</head>
<body>
${o.cuerpo}
${script}
</body>
</html>`;
}

// Descarga el texto como archivo .html con el nombre del informe.
export function descargarHtml(nombre: string, html: string): void {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre.endsWith('.html') ? nombre : `${nombre}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Interruptor claro/oscuro para el archivo guardado (sin Angular): la misma
// pastilla de la aplicación (sol / luna). Va en el lugar marcado con
// [data-lugar-tema] (el banner de los informes interactivos) o, si no hay,
// fija en la esquina. Cambia la clase "dark" del documento; los estilos
// guardados ya traen las dos versiones. Al imprimir el archivo, sale en claro.
export const INTERRUPTOR_TEMA = {
  estilos: `
.sw-tema{position:fixed;top:10px;right:12px;z-index:9999;width:50px;height:27px;padding:0;border:none;border-radius:999px;cursor:pointer;background:linear-gradient(135deg,#7DD3FC,#FDE68A);box-shadow:inset 0 1px 3px rgba(0,0,0,.15);transition:background .45s ease}
.sw-tema.en-lugar{position:relative;top:auto;right:auto;z-index:auto;flex:none}
.dark .sw-tema{background:linear-gradient(135deg,#1E2A4A,#4338CA)}
.sw-tema span{position:absolute;top:3px;left:3px;width:21px;height:21px;border-radius:50%;background:#fff;display:grid;place-items:center;font-size:12px;line-height:1;transition:transform .4s cubic-bezier(.34,1.56,.64,1),background .4s}
.dark .sw-tema span{transform:translateX(23px);background:#1E2A4A}
@media print{.sw-tema{display:none}}`,
  cuerpo: `<button type="button" class="sw-tema" role="switch" aria-label="Cambiar entre modo claro y oscuro" title="Modo claro / oscuro"><span aria-hidden="true">☀</span></button>`,
  script: `(function(){var h=document.documentElement,b=document.querySelector('.sw-tema'),s=b.querySelector('span');
var l=document.querySelector('[data-lugar-tema]');if(l){l.insertBefore(b,l.firstChild);b.classList.add('en-lugar')}
function pintar(){var o=h.classList.contains('dark');b.setAttribute('aria-checked',o);s.textContent=o?'☾':'☀';s.style.color=o?'#C7D2FE':'#F59E0B'}
b.addEventListener('click',function(){h.classList.toggle('dark');pintar()});pintar();
var era=false;window.addEventListener('beforeprint',function(){era=h.classList.contains('dark');h.classList.remove('dark')});
window.addEventListener('afterprint',function(){if(era)h.classList.add('dark')});})();`,
};

// JSON seguro para incrustar dentro de <script>.
export const jsonParaScript = (valor: unknown) => JSON.stringify(valor).replace(/</g, '\\u003c');
