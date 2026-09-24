import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Igual que antes, más un caso nuevo: si la URL trae ?token=... (solo
// pasa cuando Puppeteer abre /informe para generar el PDF — ver
// PdfService en el backend), ese token corto se usa directo, sin pedir
// login. Un usuario real nunca navega con ese parámetro a mano.
export const authGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const tokenDeUrl = route.queryParamMap.get('token');
  if (tokenDeUrl) {
    authService.usarTokenTemporal(tokenDeUrl);
    return true;
  }
  if (authService.getToken()) return true;
  router.navigate(['/login']);
  return false;
};
