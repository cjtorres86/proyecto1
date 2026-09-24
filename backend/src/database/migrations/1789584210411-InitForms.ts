import { MigrationInterface, QueryRunner } from "typeorm";

export class InitForms1789584210411 implements MigrationInterface {
    name = 'InitForms1789584210411'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`slep\` (\`nombre\` varchar(60) NOT NULL, PRIMARY KEY (\`nombre\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`preguntas\` (\`id\` varchar(10) NOT NULL, \`grupo\` varchar(40) NOT NULL, \`rol\` varchar(60) NULL, \`texto\` text NOT NULL, \`alias\` json NOT NULL, \`tipo\` varchar(20) NOT NULL, \`nombre\` varchar(200) NOT NULL, \`help_name\` varchar(200) NULL, \`ayuda\` json NOT NULL, \`valor_fijo\` varchar(200) NULL, \`opciones\` json NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`formulario_preguntas\` (\`formulario_id\` varchar(60) NOT NULL, \`pregunta_id\` varchar(10) NOT NULL, \`posicion_canonica\` int NOT NULL, \`validaciones\` json NOT NULL, PRIMARY KEY (\`formulario_id\`, \`pregunta_id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`formularios\` (\`id\` varchar(60) NOT NULL, \`label\` varchar(150) NOT NULL, \`descripcion\` text NULL, \`icono\` varchar(10) NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`formulario_preguntas\` ADD CONSTRAINT \`FK_1a6a16f3abb86c2bc4923a615a0\` FOREIGN KEY (\`formulario_id\`) REFERENCES \`formularios\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`formulario_preguntas\` ADD CONSTRAINT \`FK_7e180eb743f577c7e1de903c0f3\` FOREIGN KEY (\`pregunta_id\`) REFERENCES \`preguntas\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`formulario_preguntas\` DROP FOREIGN KEY \`FK_7e180eb743f577c7e1de903c0f3\``);
        await queryRunner.query(`ALTER TABLE \`formulario_preguntas\` DROP FOREIGN KEY \`FK_1a6a16f3abb86c2bc4923a615a0\``);
        await queryRunner.query(`DROP TABLE \`formularios\``);
        await queryRunner.query(`DROP TABLE \`formulario_preguntas\``);
        await queryRunner.query(`DROP TABLE \`preguntas\``);
        await queryRunner.query(`DROP TABLE \`slep\``);
    }

}
