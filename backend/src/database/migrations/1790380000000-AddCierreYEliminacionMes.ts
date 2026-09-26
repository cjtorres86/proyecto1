import { MigrationInterface, QueryRunner } from 'typeorm';

// Cierre y eliminación de meses (mejora post-v2.23):
//  1. Columnas nuevas en contenedores: cerrado_en / cerrado_por_id (cierre
//     del mes) y eliminado_en / eliminado_por_id (borrado lógico: los datos
//     nunca se borran de la base).
//  2. Todos los meses que ya existen quedan CERRADOS (decisión funcional:
//     son meses consolidados; solo el superadmin puede modificarlos).
//  3. Permiso nuevo "cerrar_mes" para los perfiles Admin y Validador (el
//     superadmin ya puede todo sin perfil).
export class AddCierreYEliminacionMes1790380000000 implements MigrationInterface {
  name = 'AddCierreYEliminacionMes1790380000000';

  private static readonly PERFILES_QUE_CIERRAN = ['perfil_admin', 'perfil_validador'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `contenedores` ' +
        'ADD `cerrado_en` datetime(6) NULL, ' +
        'ADD `cerrado_por_id` varchar(36) NULL, ' +
        'ADD `eliminado_en` datetime(6) NULL, ' +
        'ADD `eliminado_por_id` varchar(36) NULL',
    );
    await queryRunner.query('UPDATE `contenedores` SET `cerrado_en` = CURRENT_TIMESTAMP(6) WHERE `cerrado_en` IS NULL');
    await this.ajustarPermiso(queryRunner, 'agregar');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.ajustarPermiso(queryRunner, 'quitar');
    await queryRunner.query(
      'ALTER TABLE `contenedores` DROP COLUMN `eliminado_por_id`, DROP COLUMN `eliminado_en`, ' +
        'DROP COLUMN `cerrado_por_id`, DROP COLUMN `cerrado_en`',
    );
  }

  // "permisos" es una columna JSON: se lee, se ajusta en JavaScript y se
  // vuelve a escribir, para no depender de funciones JSON específicas de
  // una versión de MySQL.
  private async ajustarPermiso(queryRunner: QueryRunner, accion: 'agregar' | 'quitar'): Promise<void> {
    const ids = AddCierreYEliminacionMes1790380000000.PERFILES_QUE_CIERRAN;
    const filas: { id: string; permisos: unknown }[] = await queryRunner.query(
      'SELECT `id`, `permisos` FROM `perfiles` WHERE `id` IN (?, ?)',
      ids,
    );
    for (const fila of filas) {
      const permisos = typeof fila.permisos === 'string' ? JSON.parse(fila.permisos) : (fila.permisos as { acciones?: string[] });
      const acciones = new Set<string>(permisos.acciones ?? []);
      if (accion === 'agregar') acciones.add('cerrar_mes');
      else acciones.delete('cerrar_mes');
      permisos.acciones = [...acciones];
      await queryRunner.query('UPDATE `perfiles` SET `permisos` = ? WHERE `id` = ?', [JSON.stringify(permisos), fila.id]);
    }
  }
}
