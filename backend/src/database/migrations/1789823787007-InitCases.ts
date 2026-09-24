import { MigrationInterface, QueryRunner } from "typeorm";

export class InitCases1789823787007 implements MigrationInterface {
    name = 'InitCases1789823787007'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`contenedores\` (\`id\` varchar(36) NOT NULL, \`slep\` varchar(60) NOT NULL, \`mes_consolidado\` varchar(20) NOT NULL, \`anio_consolidado\` varchar(4) NOT NULL, \`formulario_id\` varchar(60) NOT NULL, \`status\` varchar(10) NOT NULL DEFAULT 'pending', \`filled\` int NOT NULL DEFAULT '0', \`total\` int NOT NULL DEFAULT '0', \`creado_por_id\` varchar(255) NULL, \`creado_en\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`actualizado_en\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`valores_campo\` (\`contenedor_id\` varchar(255) NOT NULL, \`pregunta_id\` varchar(20) NOT NULL, \`valor\` varchar(500) NOT NULL, PRIMARY KEY (\`contenedor_id\`, \`pregunta_id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`contenedores\` ADD CONSTRAINT \`FK_f1afe7aadceb6e622a132ce713e\` FOREIGN KEY (\`formulario_id\`) REFERENCES \`formularios\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`contenedores\` ADD CONSTRAINT \`FK_3ab9ba7d7b437131a3f9969aee5\` FOREIGN KEY (\`creado_por_id\`) REFERENCES \`usuarios\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`valores_campo\` ADD CONSTRAINT \`FK_b6f79023fdfd974093db6ba476f\` FOREIGN KEY (\`contenedor_id\`) REFERENCES \`contenedores\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`valores_campo\` ADD CONSTRAINT \`FK_e61366b4a148bbdcbf077919386\` FOREIGN KEY (\`pregunta_id\`) REFERENCES \`preguntas\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`valores_campo\` DROP FOREIGN KEY \`FK_e61366b4a148bbdcbf077919386\``);
        await queryRunner.query(`ALTER TABLE \`valores_campo\` DROP FOREIGN KEY \`FK_b6f79023fdfd974093db6ba476f\``);
        await queryRunner.query(`ALTER TABLE \`contenedores\` DROP FOREIGN KEY \`FK_3ab9ba7d7b437131a3f9969aee5\``);
        await queryRunner.query(`ALTER TABLE \`contenedores\` DROP FOREIGN KEY \`FK_f1afe7aadceb6e622a132ce713e\``);
        await queryRunner.query(`DROP TABLE \`valores_campo\``);
        await queryRunner.query(`DROP TABLE \`contenedores\``);
    }

}
