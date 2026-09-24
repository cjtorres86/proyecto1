import { ValidacionService } from './validacion.service';

describe('ValidacionService', () => {
  const service = new ValidacionService();

  it('no aplica si falta algun valor referenciado (dato incompleto, no error)', () => {
    const val = { formula: 'C07 + C08 = C06', tokens: [
      { type: 'field' as const, num: 7 }, { type: 'sym' as const, sym: '+' },
      { type: 'field' as const, num: 8 }, { type: 'sym' as const, sym: '=' },
      { type: 'field' as const, num: 6 },
    ], msgFail: 'falla', msgOk: 'ok' };
    const mapa = new Map([[7, '5']]); // falta 8 y 6
    expect(service.evaluarValidacion(val, mapa)).toEqual({ aplica: false });
  });

  it('detecta cuando la suma no cumple (C07+C08=C06)', () => {
    const val = { formula: 'C07 + C08 = C06', tokens: [
      { type: 'field' as const, num: 7 }, { type: 'sym' as const, sym: '+' },
      { type: 'field' as const, num: 8 }, { type: 'sym' as const, sym: '=' },
      { type: 'field' as const, num: 6 },
    ], msgFail: 'La suma de campos 7 y 8 debe ser igual al campo 6', msgOk: 'Validación correcta' };
    const mapa = new Map([[7, '50'], [8, '10'], [6, '100']]); // 50+10=60 != 100
    const res = service.evaluarValidacion(val, mapa);
    expect(res.aplica).toBe(true);
    expect(res.cumple).toBe(false);
  });

  it('confirma cuando la suma sí cumple', () => {
    const val = { formula: 'C07 + C08 = C06', tokens: [
      { type: 'field' as const, num: 7 }, { type: 'sym' as const, sym: '+' },
      { type: 'field' as const, num: 8 }, { type: 'sym' as const, sym: '=' },
      { type: 'field' as const, num: 6 },
    ], msgFail: 'falla', msgOk: 'Validación correcta' };
    const mapa = new Map([[7, '40'], [8, '60'], [6, '100']]); // 40+60=100
    const res = service.evaluarValidacion(val, mapa);
    expect(res.aplica).toBe(true);
    expect(res.cumple).toBe(true);
  });

  it('respeta el operador <= (ej. C19 <= C06)', () => {
    const val = { formula: 'C19 <= C06', tokens: [
      { type: 'field' as const, num: 19 }, { type: 'sym' as const, sym: '<=' }, { type: 'field' as const, num: 6 },
    ], msgFail: 'falla', msgOk: 'ok' };
    expect(service.evaluarValidacion(val, new Map([[19, '10'], [6, '5']])).cumple).toBe(false); // 10 <= 5 -> false
    expect(service.evaluarValidacion(val, new Map([[19, '5'], [6, '10']])).cumple).toBe(true); // 5 <= 10 -> true
  });

  it('sin operador reconocido, no aplica', () => {
    const val = { formula: 'sin operador', tokens: [{ type: 'field' as const, num: 1 }], msgFail: '', msgOk: '' };
    expect(service.evaluarValidacion(val, new Map([[1, '5']]))).toEqual({ aplica: false });
  });
});
