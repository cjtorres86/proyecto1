import { MigrationInterface, QueryRunner } from 'typeorm';

// Bitácora de usuarios (mejora post-v2.23). Sin llave foránea hacia
// usuarios a propósito: usuario_nombre y perfil_nombre ya guardan la
// foto del momento (ver RegistroBitacora), así que un registro de
// bitácora sigue teniendo sentido leído por sí solo, incluso si algún
// día se permitiera eliminar un usuario.
export class CreateBitacora1790410000000 implements MigrationInterface {
  name = 'CreateBitacora1790410000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`registros_bitacora\` (
        \`id\` varchar(36) NOT NULL,
        \`usuario_id\` varchar(36) NOT NULL,
        \`usuario_nombre\` varchar(100) NOT NULL,
        \`perfil_nombre\` varchar(100) NOT NULL,
        \`ip\` varchar(45) NOT NULL,
        \`accion\` varchar(60) NOT NULL,
        \`descripcion\` text NOT NULL,
        \`detalle\` json NULL,
        \`creado_en\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_bitacora_fecha\` (\`creado_en\`),
        INDEX \`IDX_bitacora_usuario\` (\`usuario_id\`, \`creado_en\`),
        INDEX \`IDX_bitacora_accion\` (\`accion\`, \`creado_en\`)
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `registros_bitacora`');
  }
}
