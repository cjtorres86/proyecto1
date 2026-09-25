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
    // darkModeSelector: false (hallazgo real): por defecto PrimeNG usa
    // "system" y, si el computador está en modo oscuro, declara
    // color-scheme: dark en :root — le gana al tema claro de Angular
    // Material y el navegador pinta el texto en blanco sobre los fondos
    // blancos del sistema (letras invisibles). El sistema solo tiene
    // diseño claro, así que el modo oscuro automático queda apagado.
    providePrimeNG({ theme: { preset: Aura, options: { darkModeSelector: false } } }),
    { provide: APP_INITIALIZER, useFactory: restaurarSesion, multi: true },
  ],
};
