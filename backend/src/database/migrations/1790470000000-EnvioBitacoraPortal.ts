import { MigrationInterface, QueryRunner } from 'typeorm';

// Bitácora central (etapa 4): cada registro de la Bitácora de Sumarios se
// envía al portal GDP-SLEP Studio. "enviado_portal_en" marca cuándo el portal
// lo confirmó; mientras esté vacío, se sigue intentando (si el portal está
// dormido o caído, no se pierde nada). Sumarios conserva su propia copia.
//
// Los registros que ya existen parten vacíos: así el HISTORIAL completo
// también llega al portal, en tandas, sin hacer nada más.
export class EnvioBitacoraPortal1790470000000 implements MigrationInterface {
  name = 'EnvioBitacoraPortal1790470000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE `registros_bitacora` ADD `enviado_portal_en` datetime NULL');
    await q.query('ALTER TABLE `registros_bitacora` ADD INDEX `IDX_bitacora_envio` (`enviado_portal_en`, `creado_en`)');
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE `registros_bitacora` DROP INDEX `IDX_bitacora_envio`');
    await q.query('ALTER TABLE `registros_bitacora` DROP COLUMN `enviado_portal_en`');
  }
}
