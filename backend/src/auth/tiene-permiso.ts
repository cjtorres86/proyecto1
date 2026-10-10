import { Usuario } from './entities/usuario.entity';

// ¿La persona tiene este permiso? El Superadmin los tiene todos. Para el resto,
// mira las pantallas y acciones de su perfil (que administra el portal).
export function tienePermiso(usuario: Usuario | null | undefined, clave: string): boolean {
  if (!usuario) return false;
  if (usuario.esSuperadmin) return true;
  const p = usuario.perfil?.permisos;
  return !!p && [...p.vistas, ...p.acciones, ...p.gestion].includes(clave);
}
