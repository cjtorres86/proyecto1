import { MigrationInterface, QueryRunner } from 'typeorm';

// "Cargar datos" (mes anterior o archivo Excel) para todos: el permiso
// "importar_excel" queda activado en todos los perfiles. Desde el portal
// (Configuración → Perfiles) se puede desactivar perfil por perfil; esta es la
// copia de los perfiles que guarda Sumarios (el portal hace lo mismo en la suya).
// Se arma en JavaScript para que funcione igual en MySQL y en MariaDB.
export class CargarDatosParaTodos1790480000000 implements MigrationInterface {
  name = 'CargarDatosParaTodos1790480000000';

  public async up(q: QueryRunner): Promise<void> {
    const filas: { id: string; permisos: unknown }[] = await q.query('SELECT `id`, `permisos` FROM `perfiles`');
    for (const f of filas) {
      const p = typeof f.permisos === 'string' ? JSON.parse(f.permisos) : f.permisos;
      if (!p) continue;
      const acciones: string[] = Array.isArray(p.acciones) ? p.acciones : [];
      if (acciones.includes('importar_excel')) continue;
      await q.query('UPDATE `perfiles` SET `permisos` = ? WHERE `id` = ?', [JSON.stringify({ ...p, acciones: [...acciones, 'importar_excel'] }), f.id]);
    }
  }

  public async down(): Promise<void> {
    // No se revierte: no se sabe qué perfiles lo tenían desactivado antes.
  }
}
