import { ValidacionService } from './validacion.service';
import { FORMULARIO_PREGUNTAS_SEED } from '../forms/seeds/formularios.seed';

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

  // Regresión (bug real, muy grave, reportado en producción): el campo 9
  // (Barrancas) con valor 24 y el campo 8 con valor 62 aparecía en rojo
  // con el mensaje "Campo 9 debe ser menor o igual al campo 8" — aunque
  // 24 <= 62 es verdadero. La causa: unos "tokens" guardados a mano no
  // coincidían con su propia "formula". Esta prueba usa exactamente esos
  // datos rotos (tal como quedaron en la base antes de la corrección) —
  // si algún día el motor volviera a confiar en "tokens" en lugar de
  // "formula", esta prueba fallaría de inmediato.
  it('REGRESIÓN: ignora "tokens" mal escritos y confía solo en "formula" (bug real de producción)', () => {
    const val = {
      formula: 'C09 <= C08',
      tokens: [
        { type: 'field' as const, num: 9 }, { type: 'sym' as const, sym: '<' },
        { type: 'field' as const, num: 8 }, { type: 'sym' as const, sym: 'ó' },
        { type: 'field' as const, num: 9 }, { type: 'sym' as const, sym: '=' },
        { type: 'field' as const, num: 8 },
      ],
      msgFail: 'Campo 9 debe ser menor o igual al campo 8',
      msgOk: 'Validación correcta',
    };
    const resultado = service.evaluarValidacion(val, new Map([[9, '24'], [8, '62']]));
    expect(resultado.aplica).toBe(true);
    expect(resultado.cumple).toBe(true);
    expect(resultado.msg).toBe('Validación correcta');
  });

  // Resguardo permanente (mejora post-v2.23): revisa TODAS las fórmulas
  // reales de los 2 formularios cada vez que se corren las pruebas del
  // proyecto — si alguien agrega una fórmula mal escrita (sin operador,
  // con dos operadores, con un símbolo que no existe), esta prueba falla
  // de inmediato, en vez de que el error llegue a producción como pasó
  // esta vez.
  it('íntegridad: todas las fórmulas del catálogo tienen exactamente un operador de comparación', () => {
    const operadores = ['=', '<=', '>='];
    let total = 0;
    for (const item of FORMULARIO_PREGUNTAS_SEED) {
      for (const val of (item.validaciones as { formula: string }[]) ?? []) {
        total++;
        const tokens = service.parsearFormula(val.formula);
        const cantidadOperadores = tokens.filter((t) => t.type === 'sym' && operadores.includes(t.sym as string)).length;
        expect({ pregunta: item.preguntaId, formula: val.formula, cantidadOperadores }).toEqual({
          pregunta: item.preguntaId,
          formula: val.formula,
          cantidadOperadores: 1,
        });
      }
    }
    expect(total).toBeGreaterThan(0); // que la prueba no esté "pasando" vacía por accidente
  });
});
