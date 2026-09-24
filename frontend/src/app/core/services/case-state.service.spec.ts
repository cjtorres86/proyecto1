import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CaseStateService } from './case-state.service';
import { CasesApiService } from '../../features/cases/services/cases-api.service';

describe('CaseStateService', () => {
  let service: CaseStateService;
  let apiMock: jasmine.SpyObj<CasesApiService>;

  beforeEach(() => {
    apiMock = jasmine.createSpyObj('CasesApiService', ['listarPorMes', 'crearMes', 'guardarValores', 'getContenedorConValores', 'importarArchivo']);
    TestBed.configureTestingModule({ providers: [{ provide: CasesApiService, useValue: apiMock }] });
    service = TestBed.inject(CaseStateService);
  });

  it('al fijar el mes activo, limpia el SLEP y el campo activo, y recarga contenedores', () => {
    apiMock.listarPorMes.and.returnValue(of([{ id: '1' } as any]));
    let ultimoValorSlep: string | null = 'valor-viejo';
    service.slepActivo$.subscribe((v) => (ultimoValorSlep = v));
    service.setSlepActivo('algo');

    service.setMesActivo({ mes: 'Enero', anio: '2027' });

    expect(apiMock.listarPorMes).toHaveBeenCalledWith('Enero', '2027');
    expect(ultimoValorSlep).toBeNull();
  });

  it('contenedorActivo$ deriva el contenedor correcto según el slepActivo', (done) => {
    apiMock.listarPorMes.and.returnValue(of([{ id: 'a', slep: 'Valdivia' } as any, { id: 'b', slep: 'Barrancas' } as any]));
    service.setMesActivo({ mes: 'Enero', anio: '2027' });
    service.setSlepActivo('b');
    service.contenedorActivo$.subscribe((c) => {
      expect(c?.slep).toBe('Barrancas');
      done();
    });
  });

  it('guardarValores() vuelve a cargar los contenedores del mes activo tras guardar', () => {
    apiMock.listarPorMes.and.returnValue(of([]));
    apiMock.guardarValores.and.returnValue(of({}));
    service.setMesActivo({ mes: 'Enero', anio: '2027' });
    apiMock.listarPorMes.calls.reset();

    service.guardarValores('id-1', { Q06: '10' }).subscribe();

    expect(apiMock.guardarValores).toHaveBeenCalledWith('id-1', { Q06: '10' });
    expect(apiMock.listarPorMes).toHaveBeenCalledWith('Enero', '2027');
  });
});
