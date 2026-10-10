import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

// Agrega el JWT a cada request salvo /auth/login — equivalente a que el
// PMV mandara AuthService.current en cada llamada, pero ahora es el
// backend el que decide si el token sigue siendo válido, no el cliente.
// Un 401 del backend (token vencido o inválido) cierra la sesión acá
// mismo — nunca se sigue mostrando una UI como si la sesión existiera.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  // El ingreso con pase del portal (/auth/sso) tampoco lleva token, y un
  // rechazo ahí no es "sesión vencida": la página muestra su propio mensaje.
  if (req.url.endsWith('/auth/login') || req.url.endsWith('/auth/sso')) return next(req);
  const token = authService.getToken();
  const conToken = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(conToken).pipe(
    catchError((error) => {
      if (error.status === 401) authService.logout();
      return throwError(() => error);
    }),
  );
};
