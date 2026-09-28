import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Guard de conveniencia de UI (oculta la ruta) — la verificación real
// vive en el backend (BitacoraController.listar, que revisa
// esSuperadmin directo). Distinto de permissionGuard: la Bitácora no es
// un permiso asignable por perfil, es exclusiva del Superadmin — mismo
// criterio directo que ya usan "Abrir mes" y "Eliminar mes".
export const superadminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  if (authService.usuarioActual()?.esSuperadmin) return true;
  router.navigate(['/']);
  return false;
};
