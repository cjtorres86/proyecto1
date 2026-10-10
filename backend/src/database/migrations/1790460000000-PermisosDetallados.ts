import { MigrationInterface, QueryRunner } from 'typeorm';

// Etapa 3: los perfiles se administran en el portal GDP-SLEP Studio, con un
// catálogo de permisos más detallado (ej. reabrir o eliminar un mes, editar
// meses cerrados, mensajes, histórico, Excel consolidado / por SLEP).
//
// Esta migración deja los 3 perfiles de hoy con los permisos nuevos que
// equivalen EXACTAMENTE a lo que ya podían hacer (nadie gana ni pierde nada),
// y agrega "Visita" (solo ver y descargar). Desde ahora, el portal los
// mantiene al día: cada cambio en Configuración → Perfiles llega aquí al
// instante. "gestionar_usuarios" sale de los perfiles: las personas se
// administran en el portal.
const PERFILES = [
  {
    "id": "perfil_admin",
    "nombre": "Admin",
    "permisos": {
      "vistas": [
        "dashboard",
        "formulario",
        "inspector",
        "exportar_informe",
        "historico"
      ],
      "acciones": [
        "importar_excel",
        "crear_mes",
        "cerrar_mes",
        "exportar_excel_consolidado",
        "exportar_excel_slep",
        "mensajes"
      ],
      "gestion": []
    }
  },
  {
    "id": "perfil_validador",
    "nombre": "Validador",
    "permisos": {
      "vistas": [
        "dashboard",
        "formulario",
        "inspector",
        "exportar_informe",
        "historico"
      ],
      "acciones": [
        "importar_excel",
        "crear_mes",
        "cerrar_mes",
        "exportar_excel_consolidado",
        "exportar_excel_slep",
        "mensajes"
      ],
      "gestion": []
    }
  },
  {
    "id": "perfil_digitador",
    "nombre": "Digitador",
    "permisos": {
      "vistas": [
        "dashboard",
        "formulario",
        "inspector",
        "exportar_informe",
        "historico"
      ],
      "acciones": [
        "importar_excel",
        "exportar_excel_slep",
        "mensajes"
      ],
      "gestion": []
    }
  },
  {
    "id": "perfil_visita",
    "nombre": "Visita",
    "permisos": {
      "vistas": [
        "dashboard",
        "formulario",
        "inspector",
        "exportar_informe",
        "historico"
      ],
      "acciones": [
        "exportar_excel_consolidado",
        "exportar_excel_slep"
      ],
      "gestion": []
    }
  }
];

export class PermisosDetallados1790460000000 implements MigrationInterface {
  name = 'PermisosDetallados1790460000000';

  public async up(q: QueryRunner): Promise<void> {
    for (const p of PERFILES) {
      await q.query(
        'INSERT INTO `perfiles` (`id`, `nombre`, `permisos`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `permisos` = VALUES(`permisos`)',
        [p.id, p.nombre, JSON.stringify(p.permisos)],
      );
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query("DELETE FROM `perfiles` WHERE `id` = 'perfil_visita' AND NOT EXISTS (SELECT 1 FROM `usuarios` WHERE `perfil_id` = 'perfil_visita')");
  }
}
