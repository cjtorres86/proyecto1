import { ForbiddenException } from '@nestjs/common';
import { Usuario } from '../../auth/entities/usuario.entity';

// Regla única de acceso a los datos de un SLEP (TDD, sección 11.2.1): el
// superadmin y los perfiles con alcance 'todos' (Admin, Validador) ven
// cualquier SLEP; un Digitador, solo el suyo. La usan los formularios
// (CasesController) y el chat por campo (MensajesService) — una sola
// definición, así nunca pueden quedar con reglas distintas.
export function verificarAccesoSlep(slep: string, usuario: Usuario): void {
  if (usuario.esSuperadmin || usuario.alcance === 'todos') return;
  if (usuario.alcance !== slep) {
    throw new ForbiddenException(`No tienes acceso a los datos de ${slep}.`);
  }
}
