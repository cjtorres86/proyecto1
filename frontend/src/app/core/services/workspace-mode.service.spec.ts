import { WorkspaceModeService } from './workspace-mode.service';

describe('WorkspaceModeService', () => {
  let service: WorkspaceModeService;
  beforeEach(() => (service = new WorkspaceModeService()));

  it('arranca en modo formulario', (done) => {
    service.modo$.subscribe((m) => { expect(m).toBe('formulario'); done(); });
  });

  it('irA() cambia el modo directamente', () => {
    let ultimo: string | undefined;
    service.modo$.subscribe((m) => (ultimo = m));
    service.irA('dashboard-ampliado');
    expect(ultimo).toBe('dashboard-ampliado');
    service.irA('historico');
    expect(ultimo).toBe('historico');
    service.irA('formulario');
    expect(ultimo).toBe('formulario');
  });

  it('fijarModoPorDefecto: Admin y superadmin -> dashboard-ampliado', () => {
    let ultimo: string | undefined;
    service.modo$.subscribe((m) => (ultimo = m));
    service.fijarModoPorDefecto({ esSuperadmin: true } as any);
    expect(ultimo).toBe('dashboard-ampliado');
    service.fijarModoPorDefecto({ esSuperadmin: false, perfil: { id: 'perfil_admin' } } as any);
    expect(ultimo).toBe('dashboard-ampliado');
  });

  it('fijarModoPorDefecto: Validador y Digitador -> formulario', () => {
    let ultimo: string | undefined;
    service.modo$.subscribe((m) => (ultimo = m));
    service.fijarModoPorDefecto({ esSuperadmin: false, perfil: { id: 'perfil_digitador' } } as any);
    expect(ultimo).toBe('formulario');
  });
});
