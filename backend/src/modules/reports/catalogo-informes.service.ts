import { Injectable, Logger } from '@nestjs/common';
import { CATALOGO_RESPALDO, InformeCatalogo } from './catalogo-respaldo';

const APLICACION_ID = 'reporte_avance_sumarios';
// Cuánto se recuerda la versión del portal antes de volver a pedirla.
const VIGENCIA_MS = 5 * 60_000;

// Los informes de Sumarios (nombres, formatos, descripciones y orden) salen
// del catálogo único del portal: así el Asistente Virtual y esta ventana de
// descargas siempre dicen lo mismo. Se pide de servidor a servidor, con la
// clave de integración. Si el portal no responde se usa la última versión
// recibida y, si nunca llegó ninguna, la copia de respaldo.
@Injectable()
export class CatalogoInformesService {
  private readonly log = new Logger('CatalogoInformes');
  private ultimo: { hasta: number; lista: InformeCatalogo[] } | null = null;

  async obtener(): Promise<{ origen: 'portal' | 'respaldo'; informes: InformeCatalogo[] }> {
    if (this.ultimo && this.ultimo.hasta > Date.now()) return { origen: 'portal', informes: this.ultimo.lista };
    const url = process.env.PORTAL_API_URL;
    const clave = process.env.CLAVE_INTEGRACION;
    if (url && clave) {
      try {
        const r = await fetch(`${url.replace(/\/$/, '')}/integracion/catalogo?aplicacionId=${APLICACION_ID}`, {
          headers: { 'x-clave-aplicacion': clave },
          signal: AbortSignal.timeout(20000),
        });
        if (!r.ok) throw new Error(`respondió ${r.status}`);
        const lista = (await r.json()) as InformeCatalogo[];
        if (!Array.isArray(lista) || !lista.length) throw new Error('llegó vacío');
        this.ultimo = { hasta: Date.now() + VIGENCIA_MS, lista };
        return { origen: 'portal', informes: lista };
      } catch (e) {
        this.log.warn(`No se pudo pedir el catálogo al portal: ${(e as Error).message}`);
      }
    }
    // Sin portal: la última versión conocida (aunque haya vencido) o el respaldo.
    if (this.ultimo) return { origen: 'portal', informes: this.ultimo.lista };
    return { origen: 'respaldo', informes: CATALOGO_RESPALDO };
  }
}
