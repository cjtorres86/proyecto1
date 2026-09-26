import { ApplicationConfig, provideZoneChangeDetection, APP_INITIALIZER, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { providePrimeNG } from 'primeng/config';
import { firstValueFrom, of, catchError, tap } from 'rxjs';
import Aura from '@primeng/themes/aura';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/services/auth.service';
import { WorkspaceModeService } from './core/services/workspace-mode.service';

// Restaura la sesión al recargar la página (F9 — Auth): el token ya
// vivía en localStorage, pero authService.usuarioActual() quedaba en
// null hasta el próximo login si no se volvía a pedir. Sin esto, F(10+)
// vería al usuario "sin sesión" cada vez que refresca, aunque el token
// siguiera siendo válido. También fija el modo de workspace por defecto
// según el perfil (TDD, sección 7.8) — igual que hace el login.
function restaurarSesion() {
  const authService = inject(AuthService);
  const workspaceMode = inject(WorkspaceModeService);
  return () => {
    if (!authService.getToken()) return Promise.resolve();
    return firstValueFrom(
      authService.cargarSesion().pipe(
        tap((usuario) => workspaceMode.fijarModoPorDefecto(usuario)),
        catchError(() => of(null)),
      ),
    );
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideHttpClient(withInterceptors([authInterceptor])),
    // darkModeSelector: '.dark' (mejora post-v2.23, fase 2) — el mismo
    // interruptor manual que controla Angular Material y Tailwind (ver
    // ThemeService). Antes estaba en false porque PrimeNG, por su cuenta
    // ("system"), activaba su propio oscuro según el sistema operativo,
    // chocando con el tema claro fijo que tenía Angular Material en ese
    // momento — pintaba letras blancas sobre fondos blancos. Ahora los 3
    // (Material, PrimeNG, Tailwind) reaccionan a la MISMA clase, nunca
    // cada uno por su cuenta, así que ese problema no puede repetirse.
    providePrimeNG({ theme: { preset: Aura, options: { darkModeSelector: '.dark' } } }),
    { provide: APP_INITIALIZER, useFactory: restaurarSesion, multi: true },
  ],
};
