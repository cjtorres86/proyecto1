import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

const APLICACION_ID = 'reporte_avance_sumarios';
const CADA_MS = 10_000; // revisa cada 10 segundos si hay registros sin enviar
const TANDA = 200;
const MAX_TANDAS_POR_VUELTA = 25; // hasta 5.000 por vuelta (útil para el historial)

// Bitácora central: envía al portal cada registro de la Bitácora de Sumarios.
// Si el portal no responde (ej. Render lo tiene dormido), los registros
// quedan pendientes y se reintentan en la vuelta siguiente: no se pierde
// ninguno. El portal no duplica un registro aunque llegue dos veces.
@Injectable()
export class EnvioBitacoraService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('EnvioBitacora');
  private reloj?: NodeJS.Timeout;
  private trabajando = false;

  constructor(private readonly dataSource: DataSource) {}

  onModuleInit(): void {
    if (!process.env.PORTAL_API_URL || !process.env.CLAVE_INTEGRACION) return; // sin portal configurado, no hace nada
    this.reloj = setInterval(() => void this.enviarPendientes(), CADA_MS);
    this.reloj.unref();
  }

  onModuleDestroy(): void {
    if (this.reloj) clearInterval(this.reloj);
  }

  // Envía los pendientes, del más antiguo al más nuevo. Devuelve cuántos envió.
  async enviarPendientes(): Promise<number> {
    if (this.trabajando) return 0;
    const url = process.env.PORTAL_API_URL;
    const clave = process.env.CLAVE_INTEGRACION;
    if (!url || !clave) return 0;
    this.trabajando = true;
    let enviados = 0;
    try {
      for (let vuelta = 0; vuelta < MAX_TANDAS_POR_VUELTA; vuelta++) {
        const filas: {
          id: string; creado_en: Date; usuario_nombre: string; perfil_nombre: string; ip: string;
          accion: string; descripcion: string; detalle: unknown; portal_id: string | null;
        }[] = await this.dataSource.query(
          'SELECT b.id, b.creado_en, b.usuario_nombre, b.perfil_nombre, b.ip, b.accion, b.descripcion, b.detalle, u.portal_id ' +
            'FROM registros_bitacora b LEFT JOIN usuarios u ON u.id = b.usuario_id ' +
            'WHERE b.enviado_portal_en IS NULL ORDER BY b.creado_en ASC LIMIT ?',
          [TANDA],
        );
        if (!filas.length) break;
        const r = await fetch(`${url.replace(/\/$/, '')}/integracion/bitacora`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-clave-aplicacion': clave },
          body: JSON.stringify({
            aplicacionId: APLICACION_ID,
            registros: filas.map((f) => ({
              origenId: f.id,
              creadoEn: new Date(f.creado_en).toISOString(),
              personaPortalId: f.portal_id,
              personaNombre: f.usuario_nombre,
              personaPerfil: f.perfil_nombre,
              accion: f.accion,
              descripcion: f.descripcion,
              detalle: typeof f.detalle === 'string' ? safeJson(f.detalle) : f.detalle,
              ip: f.ip,
            })),
          }),
          signal: AbortSignal.timeout(30_000),
        });
        if (!r.ok) {
          this.log.warn(`El portal respondió ${r.status} al recibir la Bitácora; se reintenta en la próxima vuelta.`);
          break;
        }
        const { recibidos } = (await r.json()) as { recibidos: string[] };
        if (!recibidos?.length) break;
        await this.dataSource.query('UPDATE registros_bitacora SET enviado_portal_en = NOW() WHERE id IN (?)', [recibidos]);
        enviados += recibidos.length;
        if (filas.length < TANDA) break;
      }
    } catch (e) {
      this.log.warn(`No se pudo enviar la Bitácora al portal (se reintenta solo): ${(e as Error).message}`);
    } finally {
      this.trabajando = false;
    }
    if (enviados) this.log.log(`${enviados} registro(s) de la Bitácora enviados al portal.`);
    return enviados;
  }
}

function safeJson(t: string): unknown {
  try { return JSON.parse(t); } catch { return t; }
}
