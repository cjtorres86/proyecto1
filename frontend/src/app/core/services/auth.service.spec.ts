import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [provideRouter([])],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('guarda el token y el usuario tras un login exitoso', () => {
    service.login('cesar', 'cesarcesar').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
    req.flush({ accessToken: 'token-falso', usuario: { id: '1', usuario: 'cesar', nombreParaMostrar: 'César', esSuperadmin: true, alcance: 'todos', perfil: null } });

    expect(service.getToken()).toBe('token-falso');
    expect(service.usuarioActual()?.usuario).toBe('cesar');
    expect(service.estaAutenticado()).toBe(true);
  });

  it('can(): el superadmin siempre tiene cualquier permiso', () => {
    service.login('cesar', 'cesarcesar').subscribe();
    httpMock.expectOne(`${environment.apiUrl}/auth/login`).flush({
      accessToken: 't', usuario: { id: '1', usuario: 'cesar', nombreParaMostrar: 'César', esSuperadmin: true, alcance: 'todos', perfil: null },
    });
    expect(service.can('gestionar_usuarios')).toBe(true);
  });

  it('can(): sin sesión, ningún permiso', () => {
    expect(service.can('editar_formulario')).toBe(false);
  });

  it('puedeVerSlep(): alcance puntual solo ve su propio SLEP', () => {
    service.login('Barrancas', 'x').subscribe();
    httpMock.expectOne(`${environment.apiUrl}/auth/login`).flush({
      accessToken: 't', usuario: { id: '2', usuario: 'Barrancas', nombreParaMostrar: 'Barrancas', esSuperadmin: false, alcance: 'Barrancas', perfil: null },
    });
    expect(service.puedeVerSlep('Barrancas')).toBe(true);
    expect(service.puedeVerSlep('Valdivia')).toBe(false);
  });

  it('logout(): borra el token y el usuario actual', () => {
    localStorage.setItem('gdp_slep_token', 'algo');
    service.logout();
    expect(service.getToken()).toBeNull();
    expect(service.usuarioActual()).toBeNull();
  });
});
