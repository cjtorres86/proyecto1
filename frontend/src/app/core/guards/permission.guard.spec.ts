import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { permissionGuard } from './permission.guard';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

describe('permissionGuard', () => {
  let router: Router;
  let authService: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [provideRouter([])] });
    router = TestBed.inject(Router);
    authService = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('deja pasar si el usuario tiene el permiso', () => {
    authService.login('cesar', 'x').subscribe();
    httpMock.expectOne(`${environment.apiUrl}/auth/login`).flush({
      accessToken: 't', usuario: { id: '1', usuario: 'cesar', nombreParaMostrar: 'César', esSuperadmin: true, alcance: 'todos', perfil: null },
    });
    const guard = permissionGuard('gestionar_usuarios');
    expect(TestBed.runInInjectionContext(() => guard({} as any, {} as any))).toBe(true);
  });

  it('sin el permiso, redirige a home y no deja pasar', () => {
    const navigateSpy = spyOn(router, 'navigate');
    const guard = permissionGuard('gestionar_usuarios');
    expect(TestBed.runInInjectionContext(() => guard({} as any, {} as any))).toBe(false);
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });
});
