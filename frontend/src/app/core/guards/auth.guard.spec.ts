import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('authGuard', () => {
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [provideRouter([])] });
    router = TestBed.inject(Router);
  });

  it('deja pasar si hay un token guardado', () => {
    localStorage.setItem('gdp_slep_token', 'algo');
    const resultado = TestBed.runInInjectionContext(() => authGuard({} as any, {} as any));
    expect(resultado).toBe(true);
  });

  it('sin token, redirige a /login y no deja pasar', () => {
    const navigateSpy = spyOn(router, 'navigate');
    const resultado = TestBed.runInInjectionContext(() => authGuard({} as any, {} as any));
    expect(resultado).toBe(false);
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });
});
