import { MigrationInterface, QueryRunner } from 'typeorm';

// Índices de rendimiento (optimización, fase 2). Cada uno responde a una
// consulta frecuente que, según EXPLAIN, revisaba la tabla ENTERA fila por
// fila (type: ALL) o la ordenaba completa (Using filesort). Con pocos meses
// no se nota; sin índices, empeora con cada mes y cada mensaje nuevo.
//
//  - contenedores (mes, año, SLEP): formularios de un mes (Formulario,
//    Dashboard, Errores, Excel) y la lista de meses — que cada usuario
//    conectado pide cada 60 segundos. Evita además la tabla temporal y el
//    ordenamiento aparte de la lista de meses.
//  - contenedores (SLEP, mes, año): todo lo que se pide de UN SLEP
//    (Histórico por SLEP, Excel del Digitador, alcance de un Digitador).
//  - mensajes_campo (creado_en): el aviso de mensaje sin leer al iniciar
//    sesión busca el MÁS RECIENTE; con este índice lee desde el más nuevo
//    y se detiene en el primero que sirve, en vez de ordenar todos.
//
// valores_campo, formulario_preguntas, usuarios, lecturas_campo y el hilo
// del chat ya tenían índices adecuados (sus claves primarias y los creados
// antes); no se duplican.
export class AddIndicesRendimiento1790400000000 implements MigrationInterface {
  name = 'AddIndicesRendimiento1790400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE INDEX `IDX_contenedores_mes_slep` ON `contenedores` (`mes_consolidado`, `anio_consolidado`, `slep`)');
    await queryRunner.query('CREATE INDEX `IDX_contenedores_slep_mes` ON `contenedores` (`slep`, `mes_consolidado`, `anio_consolidado`)');
    await queryRunner.query('CREATE INDEX `IDX_mensajes_campo_creado` ON `mensajes_campo` (`creado_en`)');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX `IDX_mensajes_campo_creado` ON `mensajes_campo`');
    await queryRunner.query('DROP INDEX `IDX_contenedores_slep_mes` ON `contenedores`');
    await queryRunner.query('DROP INDEX `IDX_contenedores_mes_slep` ON `contenedores`');
  }
}
