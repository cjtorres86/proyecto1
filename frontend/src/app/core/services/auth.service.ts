import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Usuario } from '../models/user.model';

const TOKEN_KEY = 'gdp_slep_token';

// AuthService (Core / FUNDACIÓN — TDD sección 5.1): reemplaza al
// AuthService.current del PMV, que vivía en memoria y confiaba
// ciegamente en lo que el navegador decía. Acá el token se manda en cada
// request (interceptor) y el backend lo vuelve a verificar siempre — la
// verificación real vive en el servidor (Guards), esto es solo la
// conveniencia de UI (TDD, sección 13.8, punto 3).
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly usuarioActualSignal = signal<Usuario | null>(null);
  readonly usuarioActual = this.usuarioActualSignal.asReadonly();
  readonly estaAutenticado = computed(() => this.usuarioActualSignal() !== null);

  constructor(private readonly http: HttpClient, private readonly router: Router) {}

  login(usuario: string, contrasena: string): Observable<{ accessToken: string; usuario: Usuario }> {
    return this.http
      .post<{ accessToken: string; usuario: Usuario }>(`${environment.apiUrl}/auth/login`, { usuario, contrasena })
      .pipe(
        tap((res) => {
          localStorage.setItem(TOKEN_KEY, res.accessToken);
          this.usuarioActualSignal.set(res.usuario);
        }),
      );
  }

  cargarSesion(): Observable<Usuario> {
    return this.http.post<Usuario>(`${environment.apiUrl}/auth/me`, {}).pipe(tap((u) => this.usuarioActualSignal.set(u)));
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.usuarioActualSignal.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  // Solo para la página /informe cuando la abre Puppeteer (generación
  // de PDF, ver PdfService en el backend) — un token de 2 minutos, no
  // la sesión normal. authGuard lo usa antes de que este componente
  // llegue a cargar.
  usarTokenTemporal(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  // Equivalente a AuthService.can() del PMV — ayuda de interfaz (oculta
  // botones); la verificación que de verdad importa la hace el backend.
  can(permiso: string): boolean {
    const u = this.usuarioActualSignal();
    if (!u) return false;
    if (u.esSuperadmin) return true;
    if (!u.perfil?.permisos) return false;
    return [...u.perfil.permisos.vistas, ...u.perfil.permisos.acciones, ...u.perfil.permisos.gestion].includes(permiso);
  }

  puedeVerSlep(slep: string): boolean {
    const u = this.usuarioActualSignal();
    if (!u) return false;
    return u.esSuperadmin || u.alcance === 'todos' || u.alcance === slep;
  }
}
