import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Guard de conveniencia de UI (oculta rutas) — la verificación real
// sigue viviendo en el backend (PermisosGuard), nunca solo acá.
export function permissionGuard(permiso: string): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);
    if (authService.can(permiso)) return true;
    router.navigate(['/']);
    return false;
  };
}
