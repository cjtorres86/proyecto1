import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import puppeteer, { Browser } from 'puppeteer';
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
//
// Rendimiento (optimización): antes se abría un Chrome NUEVO por cada PDF
// y se cerraba al terminar — en el plan gratuito de Render (muy poco
// procesador) solo arrancar Chrome ya cuesta varios segundos, y como cada
// Chrome empezaba "sin memoria", volvía a descargar el sistema completo
// desde Vercel. Ahora se reutiliza UN Chrome entre PDFs: desde el segundo
// PDF no hay arranque y el sistema ya está en su caché. Se cierra solo
// tras unos minutos sin uso (para no ocupar memoria, que en el plan
// gratuito es poca) y se vuelve a abrir si se cae.
@Injectable()
export class PdfService implements OnModuleDestroy {
  private navegador: Promise<Browser> | null = null;
  private cierrePorInactividad: NodeJS.Timeout | null = null;
  private static readonly MINUTOS_INACTIVIDAD = 5;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.cerrarNavegador();
  }

  // El Chrome compartido: se abre la primera vez que se pide un PDF (no al
  // arrancar el servidor) y se reutiliza mientras siga vivo.
  private obtenerNavegador(): Promise<Browser> {
    if (this.cierrePorInactividad) clearTimeout(this.cierrePorInactividad);
    if (!this.navegador) {
      this.navegador = puppeteer
        .launch({
          headless: true,
          // En Render/Docker apunta al Chromium del sistema (ver Dockerfile);
          // en tu Windows local la variable no existe y Puppeteer usa el suyo.
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            // En Docker, la memoria compartida (/dev/shm) es muy chica y
            // Chrome se pone lento o se cae; así usa el disco temporal.
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-extensions',
            '--no-first-run',
            '--no-default-browser-check',
          ],
        })
        .then((navegador) => {
          // Si Chrome se cae, la próxima vez se abre uno nuevo.
          navegador.on('disconnected', () => (this.navegador = null));
          return navegador;
        })
        .catch((error) => {
          this.navegador = null;
          throw error;
        });
    }
    return this.navegador;
  }

  private programarCierre(): void {
    if (this.cierrePorInactividad) clearTimeout(this.cierrePorInactividad);
    this.cierrePorInactividad = setTimeout(() => void this.cerrarNavegador(), PdfService.MINUTOS_INACTIVIDAD * 60_000);
  }

  private async cerrarNavegador(): Promise<void> {
    if (this.cierrePorInactividad) clearTimeout(this.cierrePorInactividad);
    const pendiente = this.navegador;
    this.navegador = null;
    if (pendiente) await (await pendiente.catch(() => null))?.close().catch(() => undefined);
  }

  async generarPdfInforme(usuario: Usuario, mes: string, anio: string, slep?: string): Promise<Buffer> {
    const token = this.jwtService.sign({ sub: usuario.id }, { expiresIn: '2m' });
    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:4200';
    const slepQuery = slep ? `&slep=${encodeURIComponent(slep)}` : '';
    const url = `${frontendUrl}/informe/${encodeURIComponent(mes)}/${encodeURIComponent(anio)}?token=${token}${slepQuery}`;

    const navegador = await this.obtenerNavegador();
    const page = await navegador.newPage();
    try {
      // Viewport más ancho que la hoja (816px) para que nada de la vista
      // previa quede recortado antes de pasar a modo impresión.
      await page.setViewport({ width: 1280, height: 1000 });
      // Sin animaciones: las barras aparecen directo en su valor final
      // (ver regla prefers-reduced-motion en styles.scss). Antes había que
      // esperar 1 segundo fijo a que terminaran de "llenarse".
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
      // 'domcontentloaded' y no 'networkidle0': el Informe avisa
      // explícitamente cuando está listo (__informeListo, abajo), así que
      // no hace falta esperar a que TODA la red quede en silencio.
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      // Espera la señal explícita del propio informe: datos pintados,
      // fuentes cargadas y ajuste a hoja carta ya calculado (ver
      // InformeComponent.programarAjuste).
      await page.waitForFunction(
        () => (window as unknown as Record<string, unknown>)['__informeListo'] === true,
        { timeout: 30000 },
      );
      // 2 cuadros de pantalla: garantiza que las barras ya tomaron su valor
      // final (se asigna en el cuadro siguiente al render) — en vez de un
      // segundo fijo adivinado.
      await page.evaluate(() => new Promise<void>((listo) => requestAnimationFrame(() => requestAnimationFrame(() => listo()))));
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
      // Se cierra la pestaña, no Chrome: queda listo para el próximo PDF.
      await page.close().catch(() => undefined);
      this.programarCierre();
    }
  }
}
