import { MigrationInterface, QueryRunner } from 'typeorm';

// Ingreso único desde el portal GDP-SLEP Studio (etapa 2).
// portal_id: el identificador de la persona en el portal. Une cada cuenta de
// Sumarios con su persona del portal, aunque cambie de nombre o de usuario.
// Se completa solo, la primera vez que la persona entra desde el portal o que
// el portal avisa un cambio.
export class AddPortalId1790450000000 implements MigrationInterface {
  name = 'AddPortalId1790450000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE `usuarios` ADD `portal_id` varchar(36) NULL');
    await q.query('ALTER TABLE `usuarios` ADD UNIQUE INDEX `UQ_usuarios_portal_id` (`portal_id`)');
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE `usuarios` DROP INDEX `UQ_usuarios_portal_id`');
    await q.query('ALTER TABLE `usuarios` DROP COLUMN `portal_id`');
  }
}
