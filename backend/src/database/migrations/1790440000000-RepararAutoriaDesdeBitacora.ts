import { MigrationInterface, QueryRunner } from 'typeorm';

// Reparación de autoría (mejora post-v2.23, hallazgo real en producción).
//
// Problema: hubo un rato entre correr la migración de autoría y que el
// código nuevo quedara publicado en Render. En ese rato el código antiguo
// guardó datos sin autor (ej.: Aconcagua en septiembre). Además, lo que
// algún SLEP cargó ANTES de esa migración quedó atribuido por defecto a
// "César Torres · Superadmin · 1 oct", lo que tampoco es cierto: los SLEP
// tienen cuenta desde el 9 de octubre.
//
// Solución: recuperar el autor REAL desde la Bitácora, que registró cada
// guardado con la persona, su perfil, la fecha y los valores exactos. Para
// cada dato sin autor (o con el autor por defecto), se busca el último
// guardado de la Bitácora que escribió ese MISMO valor en ese MISMO campo,
// SLEP y mes; si existe, se toma su autor. Nada se inventa: lo que no
// tenga registro en la Bitácora queda como estaba.
//
// Después, los campos fijos que se crean solos con un mes (Ministerio,
// Subsecretaría, nombre del SLEP) y que no tengan autor quedan a nombre de
// quien creó el mes.
//
// Se puede correr sin riesgo en cualquier base: si no hay nada que
// reparar, no cambia nada.
export class RepararAutoriaDesdeBitacora1790440000000 implements MigrationInterface {
  name = 'RepararAutoriaDesdeBitacora1790440000000';

  public async up(q: QueryRunner): Promise<void> {
    const candidatos: { contenedor_id: string; pregunta_id: string; valor: string; slep: string; mes: string; anio: string }[] =
      await q.query(
        'SELECT v.contenedor_id, v.pregunta_id, v.valor, c.slep, c.mes_consolidado AS mes, c.anio_consolidado AS anio ' +
          'FROM valores_campo v JOIN contenedores c ON c.id = v.contenedor_id ' +
          "WHERE v.cargado_en IS NULL OR (v.cargado_por_nombre = 'César Torres' AND v.cargado_en = '2026-10-01 03:00:00')",
      );

    // Último guardado (por campo, SLEP y mes) según la Bitácora, en orden
    // cronológico: el último que escribió cada campo gana.
    const guardados: { id: string; descripcion: string; detalle: unknown }[] = await q.query(
      "SELECT id, descripcion, detalle FROM registros_bitacora WHERE accion = 'formulario_guardado' ORDER BY creado_en ASC",
    );
    const ultimoGuardado = new Map<string, { valor: string; bitacoraId: string }>();
    for (const g of guardados) {
      const m = /^Guardó cambios en (.+) — (\S+) (\d{4})\.$/.exec(g.descripcion);
      if (!m) continue;
      const detalle = typeof g.detalle === 'string' ? JSON.parse(g.detalle) : g.detalle;
      if (!detalle || typeof detalle !== 'object') continue;
      for (const [preguntaId, valor] of Object.entries(detalle as Record<string, unknown>)) {
        ultimoGuardado.set(`${m[1]}|${m[2]}|${m[3]}|${preguntaId}`, { valor: String(valor), bitacoraId: g.id });
      }
    }

    let recuperados = 0;
    for (const c of candidatos) {
      const g = ultimoGuardado.get(`${c.slep}|${c.mes}|${c.anio}|${c.pregunta_id}`);
      if (!g || g.valor !== c.valor) continue;
      // Se copia directo desde la fila de la Bitácora (sin pasar por
      // JavaScript) para conservar la fecha y hora exactas del registro.
      await q.query(
        'UPDATE valores_campo v JOIN registros_bitacora b ON b.id = ? ' +
          'SET v.cargado_por_id = b.usuario_id, v.cargado_por_nombre = b.usuario_nombre, ' +
          'v.cargado_por_perfil = b.perfil_nombre, v.cargado_en = b.creado_en ' +
          'WHERE v.contenedor_id = ? AND v.pregunta_id = ?',
        [g.bitacoraId, c.contenedor_id, c.pregunta_id],
      );
      recuperados++;
    }

    // Campos fijos de meses creados después de la migración de autoría.
    const fijos = await q.query(
      'UPDATE valores_campo v ' +
        'JOIN contenedores c ON c.id = v.contenedor_id ' +
        'JOIN preguntas p ON p.id = v.pregunta_id ' +
        'JOIN usuarios u ON u.id = c.creado_por_id ' +
        'LEFT JOIN perfiles pf ON pf.id = u.perfil_id ' +
        "SET v.cargado_por_id = u.id, v.cargado_por_nombre = u.nombre_para_mostrar, " +
        "v.cargado_por_perfil = IF(u.es_superusuario = 1, 'Superadmin', IFNULL(pf.nombre, '—')), v.cargado_en = c.creado_en " +
        "WHERE v.cargado_en IS NULL AND (p.valor_fijo IS NOT NULL OR p.nombre = 'Servicio / SLEP')",
    );
    const fijosActualizados = (fijos as { affectedRows?: number })?.affectedRows ?? 0;
    console.log(`Autoría recuperada desde la Bitácora: ${recuperados} datos. Campos fijos asignados a quien creó el mes: ${fijosActualizados}.`);
  }

  // No se deshace: volver atrás borraría información verdadera recuperada
  // de la Bitácora, que sigue ahí si alguna vez se necesita revisarla.
  public async down(): Promise<void> {}
}
