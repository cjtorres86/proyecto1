import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Solo deja pasar con una sesión iniciada. (Antes también aceptaba un
// token en la dirección, ?token=..., que usaba el generador de PDF del
// servidor; se quitó junto con él — además era un riesgo: guardaba
// cualquier token que viniera en un enlace.)
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  if (authService.getToken()) return true;
  router.navigate(['/login']);
  return false;
};
