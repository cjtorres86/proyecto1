import { MigrationInterface, QueryRunner } from "typeorm";

export class InitAuth1789567712723 implements MigrationInterface {
    name = 'InitAuth1789567712723'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`perfiles\` (\`id\` varchar(60) NOT NULL, \`nombre\` varchar(120) NOT NULL, \`permisos\` json NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`usuarios\` (\`id\` varchar(36) NOT NULL, \`usuario\` varchar(60) NOT NULL, \`contrasena_hash\` varchar(255) NOT NULL, \`nombre_para_mostrar\` varchar(120) NOT NULL, \`es_superusuario\` tinyint NOT NULL DEFAULT 0, \`alcance\` varchar(60) NOT NULL, \`perfil_id\` varchar(60) NULL, \`creado_en\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_0790a401b9d234fa921e9aa177\` (\`usuario\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`usuarios\` ADD CONSTRAINT \`FK_c115e69677cafa6e8e9609c7b68\` FOREIGN KEY (\`perfil_id\`) REFERENCES \`perfiles\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`usuarios\` DROP FOREIGN KEY \`FK_c115e69677cafa6e8e9609c7b68\``);
        await queryRunner.query(`DROP INDEX \`IDX_0790a401b9d234fa921e9aa177\` ON \`usuarios\``);
        await queryRunner.query(`DROP TABLE \`usuarios\``);
        await queryRunner.query(`DROP TABLE \`perfiles\``);
    }

}
