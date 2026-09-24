import { DashboardService } from './dashboard.service';

describe('DashboardService.calculateMetrics', () => {
  const service = new DashboardService(null as any, null as any, null as any);

  it('calcula pctAvance = procesosCerrados / sumariosInstruidos * 100', () => {
    const m = service.calculateMetrics({ Q37: 20, Q45: 10 });
    expect(m.sumariosInstruidos).toBe(20);
    expect(m.procesosCerrados).toBe(10);
    expect(m.pctAvance).toBe(50);
  });

  it('pctAvance es null si no hay sumarios instruidos (evita división por cero)', () => {
    const m = service.calculateMetrics({});
    expect(m.pctAvance).toBeNull();
  });

  it('trata valores vacíos o ausentes como 0, no como error', () => {
    const m = service.calculateMetrics({ Q04: '', Q05: undefined as any });
    expect(m.totalCasos).toBe(0);
    expect(m.totalLicencias).toBe(0);
  });

  it('arma la serie CIC con las 7 etiquetas esperadas', () => {
    const m = service.calculateMetrics({ CIC_9: 5, CIC_21: 3 });
    expect(m.cic).toHaveLength(7);
    expect(m.cic.find((c) => c.id === 'CIC_9')!.valor).toBe(5);
    expect(m.cic.find((c) => c.id === 'CIC_21')!.valor).toBe(3);
  });

  it('getCicSeriesPct calcula porcentaje sobre casosInvestigar, 0 si el denominador es 0', () => {
    const m = service.calculateMetrics({ Q23: 10, CIC_9: 5 });
    const pct = service.getCicSeriesPct(m);
    expect(pct.find((c) => c.id === 'CIC_9')!.pct).toBe(50);
    const mSinDenom = service.calculateMetrics({ CIC_9: 5 });
    expect(service.getCicSeriesPct(mSinDenom).find((c) => c.id === 'CIC_9')!.pct).toBe(0);
  });
});
