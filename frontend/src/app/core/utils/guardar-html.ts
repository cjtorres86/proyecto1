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

// JSON seguro para incrustar dentro de <script>.
export const jsonParaScript = (valor: unknown) => JSON.stringify(valor).replace(/</g, '\\u003c');
