import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import puppeteer from 'puppeteer';
import { Usuario } from '../../auth/entities/usuario.entity';

// PDF real del Informe Interactivo (mejora post-v2.23) — no es un
// "guardar como PDF" del navegador: un Chrome sin interfaz (Puppeteer)
// carga la MISMA página Angular de /informe, espera a que renderice con
// datos reales, y la captura como PDF de verdad. El PDF es literalmente
// el interactivo, impreso — no una segunda implementación en paralelo.
//
// Autenticación: Puppeteer abre un navegador nuevo, sin la sesión de
// nadie — se le pasa un JWT normal (mismo AuthModule, misma firma) pero
// de vida muy corta (2 minutos) y de un solo uso práctico, nunca la
// sesión real del usuario. authGuard (frontend) sabe leer ese token
// desde la URL.
@Injectable()
export class PdfService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async generarPdfInforme(usuario: Usuario, mes: string, anio: string, slep?: string): Promise<Buffer> {
    const token = this.jwtService.sign({ sub: usuario.id }, { expiresIn: '2m' });
    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:4200';
    const slepQuery = slep ? `&slep=${encodeURIComponent(slep)}` : '';
    const url = `${frontendUrl}/informe/${encodeURIComponent(mes)}/${encodeURIComponent(anio)}?token=${token}${slepQuery}`;

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try {
      const page = await browser.newPage();
      // Viewport más ancho que la hoja (816px) para que nada de la vista
      // previa quede recortado antes de pasar a modo impresión.
      await page.setViewport({ width: 1280, height: 1000 });
      await page.goto(url, { waitUntil: 'networkidle0' });
      // Espera la señal explícita del propio informe: datos pintados,
      // fuentes cargadas y ajuste a hoja carta ya calculado (ver
      // InformeComponent.programarAjuste). Nada de tiempos adivinados
      // para esta parte.
      await page.waitForFunction(
        () => (window as unknown as Record<string, unknown>)['__informeListo'] === true,
        { timeout: 20000 },
      );
      // Las barras (CIC, Procedimientos, Sanciones, ranking, el
      // indicador de avance) arrancan en 0% y suben a su valor real con
      // una transición de 700ms (el efecto de "se va llenando solo").
      // Sin esta espera, Puppeteer capturaba la página en el mismo
      // instante en que esa animación recién empezaba — las barras
      // salían invisibles, no por un bug de renderizado sino porque
      // literalmente estaban en 0% en el momento exacto de la foto.
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // Fuerza explícitamente el modo impresión antes de capturar.
      await page.emulateMediaType('print');
      // URL limpia para el pie de página — a propósito NO se usa
      // <span class="url"></span> (la clase automática de Puppeteer):
      // esa rellena la URL real que cargó la página, con el ?token=...
      // incluido — exponía el token de acceso, de vida corta pero de
      // todas formas no debería aparecer nunca a la vista, ni verse
      // como un texto gigante en el pie de página.
      const urlLimpia = `${frontendUrl}/informe/${encodeURIComponent(mes)}/${encodeURIComponent(anio)}${slep ? ' — ' + slep : ''}`;
      const pdf = await page.pdf({
        format: 'letter',
        printBackground: true,
        // bottom más grande que el resto a propósito — ahí vive el pie
        // de página de una sola línea (ver footerTemplate). Nada de
        // esto tiene que ver con el encabezado/pie que Chrome agrega
        // solo al usar Ctrl+P — eso lo controla el navegador de cada
        // persona, esto lo controla el PDF real que genera el sistema.
        margin: { top: '1cm', bottom: '1.5cm', left: '1cm', right: '1cm' },
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: `
          <div style="font-size: 8px; width: 100%; text-align: center; color: #999; padding: 0 1cm;">
            <span class="date"></span> · <span class="title"></span> · ${urlLimpia} · Página <span class="pageNumber"></span> de <span class="totalPages"></span>
          </div>
        `,
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}
