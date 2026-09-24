import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Usuario } from '../entities/usuario.entity';

// Verifica que el SLEP pedido en la ruta (:slep) esté dentro del alcance
// de datos del usuario — 'todos', o exactamente su propio SLEP (TDD,
// sección 11.2.1: Perfil ≠ Alcance, dos verificaciones independientes).
// Se usa solo en endpoints que reciben un :slep en la URL.
@Injectable()
export class AlcanceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const usuario: Usuario = request.user;
    const slepPedido: string | undefined = request.params?.slep;

    if (usuario.esSuperadmin || usuario.alcance === 'todos') return true;
    if (!slepPedido) return true; // el endpoint no pide un SLEP puntual

    if (usuario.alcance !== slepPedido) {
      throw new ForbiddenException(`No tienes acceso a los datos de ${slepPedido}.`);
    }
    return true;
  }
}
