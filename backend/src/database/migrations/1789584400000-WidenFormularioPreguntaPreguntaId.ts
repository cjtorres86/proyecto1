import { MigrationInterface, QueryRunner } from "typeorm";

// Corrige un hallazgo real reportado por un usuario corriendo esto en su
// propia máquina, contra una base de datos genuinamente nueva (no la de
// desarrollo de este proyecto): InitForms crea preguntas.id como
// varchar(10) — el banco de preguntas del PMV usa ids mixtos, algunos
// descriptivos como "YA_SUMARIADOS" (13 caracteres), que no entran ahí.
// La versión anterior de este archivo asumía que preguntas.id ya estaba
// ensanchado a varchar(20) por un intento previo — cierto solo en la
// base de desarrollo original (con su historial de intentos fallidos),
// nunca en una base nueva. Se corrige acá: se ensanchan las DOS columnas
// (la llave primaria y la llave foránea que la referencia), soltando la
// restricción antes de tocarlas y reponiéndola al final — funciona igual
// de bien en una base nueva que en una que ya tuviera el ajuste aplicado.
export class WidenFormularioPreguntaPreguntaId1789584400000 implements MigrationInterface {
    name = 'WidenFormularioPreguntaPreguntaId1789584400000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`formulario_preguntas\` DROP FOREIGN KEY \`FK_7e180eb743f577c7e1de903c0f3\``);
        await queryRunner.query(`ALTER TABLE \`preguntas\` MODIFY \`id\` varchar(20) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`formulario_preguntas\` MODIFY \`pregunta_id\` varchar(20) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`formulario_preguntas\` ADD CONSTRAINT \`FK_7e180eb743f577c7e1de903c0f3\` FOREIGN KEY (\`pregunta_id\`) REFERENCES \`preguntas\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`formulario_preguntas\` DROP FOREIGN KEY \`FK_7e180eb743f577c7e1de903c0f3\``);
        await queryRunner.query(`ALTER TABLE \`formulario_preguntas\` MODIFY \`pregunta_id\` varchar(10) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`preguntas\` MODIFY \`id\` varchar(10) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`formulario_preguntas\` ADD CONSTRAINT \`FK_7e180eb743f577c7e1de903c0f3\` FOREIGN KEY (\`pregunta_id\`) REFERENCES \`preguntas\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }
}
