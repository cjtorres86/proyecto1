import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISOS_KEY } from '../decorators/permisos.decorator';
import { Usuario } from '../entities/usuario.entity';

// El superadmin bypasea cualquier verificación (TDD, sección 11.2.2);
// cualquier otro usuario necesita que el permiso pedido esté en alguna
// de las 3 categorías de su perfil (vistas/acciones/gestion — sección
// 11.2.1). Se ejecuta siempre DESPUÉS de JwtAuthGuard en la cadena de
// Guards, así que request.user ya viene resuelto.
@Injectable()
export class PermisosGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permisosRequeridos = this.reflector.getAllAndOverride<string[]>(PERMISOS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permisosRequeridos || permisosRequeridos.length === 0) return true;

    const usuario: Usuario = context.switchToHttp().getRequest().user;
    if (usuario.esSuperadmin) return true;

    const permisosDelPerfil = usuario.perfil
      ? [...usuario.perfil.permisos.vistas, ...usuario.perfil.permisos.acciones, ...usuario.perfil.permisos.gestion]
      : [];

    const tienePermiso = permisosRequeridos.every((p) => permisosDelPerfil.includes(p));
    if (!tienePermiso) {
      throw new ForbiddenException('Tu perfil no tiene el permiso necesario para esta acción.');
    }
    return true;
  }
}
