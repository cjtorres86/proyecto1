import { MigrationInterface, QueryRunner } from 'typeorm';

// Permiso individual de cargar datos + autoría por campo (mejora post-v2.23).
//
// 1. usuarios.puede_cargar_datos: la ÚNICA llave para guardar valores y
//    cargar Excel (reemplaza al permiso de perfil "editar_formulario").
//    Por persona, no por perfil. Valores iniciales:
//      Superadmin, Admin y Digitador → sí.
//      Validador → no, salvo Ximena (pedido explícito: carga desde hoy).
//    Se revisa en el servidor en CADA guardado: quitarlo bloquea al
//    instante, aunque la persona tenga la sesión abierta.
//
// 2. valores_campo: quién cargó cada dato y cuándo. Nombre y perfil se
//    guardan "congelados" al momento de cargar (como en la Bitácora): si la
//    persona cambia de nombre o de perfil después, el registro histórico
//    sigue diciendo quién era en ese momento.
//    Los valores que ya existían quedan atribuidos a César Torres
//    (Superadmin), 1 de octubre de 2026 a las 00:00 hora de Chile —
//    guardado como 03:00 UTC, la misma convención (UTC) que usa el resto
//    de las fechas del sistema en producción.
export class AddCargaDatosYAutoria1790430000000 implements MigrationInterface {
  name = 'AddCargaDatosYAutoria1790430000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE `usuarios` ADD `puede_cargar_datos` tinyint NOT NULL DEFAULT 0');
    await q.query(
      "UPDATE `usuarios` SET `puede_cargar_datos` = 1 " +
        "WHERE `es_superusuario` = 1 OR `perfil_id` IN ('perfil_admin', 'perfil_digitador') OR `usuario` = 'Ximena'",
    );

    await q.query(
      'ALTER TABLE `valores_campo` ' +
        'ADD `cargado_por_id` varchar(36) NULL, ' +
        'ADD `cargado_por_nombre` varchar(120) NULL, ' +
        'ADD `cargado_por_perfil` varchar(60) NULL, ' +
        'ADD `cargado_en` datetime(6) NULL',
    );
    await q.query(
      "UPDATE `valores_campo` SET " +
        "`cargado_por_id` = (SELECT `id` FROM `usuarios` WHERE `usuario` = 'cesar' LIMIT 1), " +
        "`cargado_por_nombre` = 'César Torres', " +
        "`cargado_por_perfil` = 'Superadmin', " +
        "`cargado_en` = '2026-10-01 03:00:00' " +
        'WHERE `cargado_en` IS NULL',
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(
      'ALTER TABLE `valores_campo` DROP COLUMN `cargado_en`, DROP COLUMN `cargado_por_perfil`, ' +
        'DROP COLUMN `cargado_por_nombre`, DROP COLUMN `cargado_por_id`',
    );
    await q.query('ALTER TABLE `usuarios` DROP COLUMN `puede_cargar_datos`');
  }
}
