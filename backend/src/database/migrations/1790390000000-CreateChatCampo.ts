import { MigrationInterface, QueryRunner } from 'typeorm';

// Chat por campo (mejora post-v2.23): mensajes, reacciones y lecturas.
// Tipos de las claves foráneas calcados de las tablas existentes
// (contenedores.id y usuarios.id varchar(36), preguntas.id varchar(20)).
// Sin charset/collation explícitos a propósito: toman el de la base,
// igual que las tablas creadas por las migraciones anteriores, así las
// claves foráneas siempre calzan (MySQL exige que coincidan).
// Fechas en datetime(3): ver comentario en MensajeCampo.
export class CreateChatCampo1790390000000 implements MigrationInterface {
  name = 'CreateChatCampo1790390000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`mensajes_campo\` (
        \`id\` varchar(36) NOT NULL,
        \`contenedor_id\` varchar(36) NOT NULL,
        \`pregunta_id\` varchar(20) NOT NULL,
        \`autor_id\` varchar(36) NOT NULL,
        \`texto\` text NOT NULL,
        \`texto_original\` text NULL,
        \`respuesta_a_id\` varchar(36) NULL,
        \`creado_en\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`editado_en\` datetime(3) NULL,
        \`eliminado_en\` datetime(3) NULL,
        \`eliminado_por_id\` varchar(36) NULL,
        \`cambio_usado\` tinyint NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_mensajes_campo_hilo\` (\`contenedor_id\`, \`pregunta_id\`, \`creado_en\`),
        CONSTRAINT \`FK_mensajes_campo_contenedor\` FOREIGN KEY (\`contenedor_id\`) REFERENCES \`contenedores\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_mensajes_campo_pregunta\` FOREIGN KEY (\`pregunta_id\`) REFERENCES \`preguntas\`(\`id\`),
        CONSTRAINT \`FK_mensajes_campo_autor\` FOREIGN KEY (\`autor_id\`) REFERENCES \`usuarios\`(\`id\`),
        CONSTRAINT \`FK_mensajes_campo_respuesta\` FOREIGN KEY (\`respuesta_a_id\`) REFERENCES \`mensajes_campo\`(\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);
    await queryRunner.query(`
      CREATE TABLE \`reacciones_mensaje\` (
        \`mensaje_id\` varchar(36) NOT NULL,
        \`usuario_id\` varchar(36) NOT NULL,
        \`tipo\` varchar(10) NOT NULL,
        PRIMARY KEY (\`mensaje_id\`, \`usuario_id\`, \`tipo\`),
        CONSTRAINT \`FK_reacciones_mensaje_mensaje\` FOREIGN KEY (\`mensaje_id\`) REFERENCES \`mensajes_campo\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_reacciones_mensaje_usuario\` FOREIGN KEY (\`usuario_id\`) REFERENCES \`usuarios\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
    await queryRunner.query(`
      CREATE TABLE \`lecturas_campo\` (
        \`usuario_id\` varchar(36) NOT NULL,
        \`contenedor_id\` varchar(36) NOT NULL,
        \`pregunta_id\` varchar(20) NOT NULL,
        \`leido_hasta\` datetime(3) NOT NULL,
        PRIMARY KEY (\`usuario_id\`, \`contenedor_id\`, \`pregunta_id\`),
        CONSTRAINT \`FK_lecturas_campo_usuario\` FOREIGN KEY (\`usuario_id\`) REFERENCES \`usuarios\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_lecturas_campo_contenedor\` FOREIGN KEY (\`contenedor_id\`) REFERENCES \`contenedores\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `lecturas_campo`');
    await queryRunner.query('DROP TABLE `reacciones_mensaje`');
    await queryRunner.query('DROP TABLE `mensajes_campo`');
  }
}
