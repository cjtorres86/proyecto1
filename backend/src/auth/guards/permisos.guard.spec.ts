import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermisosGuard } from './permisos.guard';
import { Usuario } from '../entities/usuario.entity';

function contextoFalso(usuario: Partial<Usuario>): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user: usuario }) }),
  } as unknown as ExecutionContext;
}

describe('PermisosGuard', () => {
  function crearGuard(permisosRequeridos: string[] | undefined) {
    const reflector = { getAllAndOverride: () => permisosRequeridos } as unknown as Reflector;
    return new PermisosGuard(reflector);
  }

  it('deja pasar sin restricción si el endpoint no declaró @Permisos()', () => {
    const guard = crearGuard(undefined);
    const ctx = contextoFalso({ esSuperadmin: false, perfil: null });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('el superadmin siempre pasa, sin importar el permiso pedido', () => {
    const guard = crearGuard(['gestionar_usuarios']);
    const ctx = contextoFalso({ esSuperadmin: true, perfil: null });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('un Digitador con editar_formulario puede pasar ese permiso puntual', () => {
    const guard = crearGuard(['editar_formulario']);
    const ctx = contextoFalso({
      esSuperadmin: false,
      perfil: { id: 'perfil_digitador', nombre: 'Digitador', permisos: { vistas: [], acciones: ['editar_formulario'], gestion: [] } } as any,
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('un Validador SIN editar_formulario es rechazado con ForbiddenException (TDD v2.14: Validador no edita)', () => {
    const guard = crearGuard(['editar_formulario']);
    const ctx = contextoFalso({
      esSuperadmin: false,
      perfil: { id: 'perfil_validador', nombre: 'Validador', permisos: { vistas: [], acciones: ['crear_mes'], gestion: [] } } as any,
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('un usuario sin perfil (y no superadmin) nunca tiene ningún permiso', () => {
    const guard = crearGuard(['exportar_excel']);
    const ctx = contextoFalso({ esSuperadmin: false, perfil: null });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
