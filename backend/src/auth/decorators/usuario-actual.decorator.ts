import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Usuario } from '../entities/usuario.entity';

// @UsuarioActual() en un controller extrae el usuario ya autenticado
// (puesto en request.user por JwtStrategy) — equivalente a
// AuthService.current en el PMV, pero verificado en cada request en vez
// de confiado desde el navegador.
export const UsuarioActual = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Usuario => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
