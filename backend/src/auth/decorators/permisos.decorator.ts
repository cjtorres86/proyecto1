import { SetMetadata } from '@nestjs/common';

export const PERMISOS_KEY = 'permisos';

// @Permisos('editar_formulario') sobre un endpoint — lo revisa
// PermisosGuard. Equivalente a AuthService.can(permiso) en el PMV
// (sección 11.2.1), pero acá sí es imposible saltárselo desde la consola
// del navegador: corre en el servidor.
export const Permisos = (...permisos: string[]) => SetMetadata(PERMISOS_KEY, permisos);
