import { MigrationInterface, QueryRunner } from 'typeorm';

// Cuentas pendientes + RUT + activo/inactivo (mejora post-v2.23).
// usuario y contrasena_hash pasan a admitir NULL: una cuenta "pendiente"
// (un SLEP registrado de antemano, sin persona asignada todavía) vive en
// la base con esos 2 campos vacíos hasta que se completen, o hasta que
// se le asocie un RUT el día que se conecte ClaveÚnica. MySQL permite
// varias filas con usuario = NULL a la vez incluso con UNIQUE (NULL
// nunca choca contra NULL en una llave única), así que no hace falta
// nada especial para tener 35 cuentas pendientes en simultáneo.
export class AddCuentaPendienteYRut1790420000000 implements MigrationInterface {
  name = 'AddCuentaPendienteYRut1790420000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `usuarios` MODIFY `usuario` varchar(60) NULL');
    await queryRunner.query('ALTER TABLE `usuarios` MODIFY `contrasena_hash` varchar(255) NULL');
    await queryRunner.query('ALTER TABLE `usuarios` ADD `rut` varchar(12) NULL');
    await queryRunner.query('ALTER TABLE `usuarios` ADD UNIQUE INDEX `IDX_usuarios_rut` (`rut`)');
    await queryRunner.query('ALTER TABLE `usuarios` ADD `activo` tinyint NOT NULL DEFAULT 1');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `usuarios` DROP COLUMN `activo`');
    await queryRunner.query('ALTER TABLE `usuarios` DROP INDEX `IDX_usuarios_rut`');
    await queryRunner.query('ALTER TABLE `usuarios` DROP COLUMN `rut`');
    await queryRunner.query('ALTER TABLE `usuarios` MODIFY `contrasena_hash` varchar(255) NOT NULL');
    await queryRunner.query('ALTER TABLE `usuarios` MODIFY `usuario` varchar(60) NOT NULL');
  }
}
