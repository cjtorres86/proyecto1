import { Injectable } from '@nestjs/common';

export interface ValidacionToken {
  type: 'field' | 'sym';
  num?: number;
  sym?: string;
}
export interface Validacion {
  formula: string;
  // Opcional (mejora post-v2.23): ya no se escribe a mano en ningún
  // lado — el motor calcula los tokens desde "formula" siempre (ver
  // parsearFormula). Queda opcional en el tipo solo por si algún dato
  // viejo todavía lo trae guardado; el motor lo ignora igual.
  tokens?: ValidacionToken[];
  msgFail: string;
  msgOk: string;
}
export interface ResultadoValidacion {
  aplica: boolean;
  cumple?: boolean;
  msg?: string;
}

// Motor de validación (TDD, sección 6.6) — reimplementación fiel de
// evaluateValidation()/_sumaTokens() del PMV, no una versión "parecida":
// mismo algoritmo, para que el resultado sea idéntico campo por campo.
// Las validaciones referencian posiciones (num) dentro de LA MISMA
// plantilla del contenedor — por eso reciben un mapa posición->valor ya
// resuelto, no el contenedor completo.
//
// Hallazgo real, muy grave (post-v2.23): 20 de los 37 campos tenían sus
// "tokens" mal escritos a mano — codificaban "menor o igual" como una
// cadena rara "(A < B) ó (A = B)" en vez de un solo símbolo "<=", que es
// lo único que este motor reconoce. El resultado: el motor terminaba
// comparando una SUMA de varios campos contra otro campo, un cálculo sin
// sentido — por eso un campo con datos correctos aparecía en rojo. La
// fórmula en texto ("C09 <= C08") siempre estuvo bien escrita; el
// problema era solo en esa segunda copia, hecha a mano, que se
// desincronizó de la fórmula real.
//
// La solución de fondo, no un parche: "tokens" YA NO se guarda a mano en
// ningún lado — el motor SIEMPRE los calcula desde "formula" (ver
// parsearFormula), la única fuente de verdad. Así, una fórmula mal
// escrita se nota de inmediato con solo leerla ("C09 <= C08" se entiende
// a simple vista), y es imposible que exista una segunda copia que se
// desincronice — no hay una segunda copia.
@Injectable()
export class ValidacionService {
  // Lee una fórmula como "C09 <= C08" o "C31 + C33 + C34 = C29" y arma
  // los tokens que el motor necesita — mecánicamente, nunca a mano.
  // Acepta espacios de más o de menos ("C09<=C08" también funciona).
  parsearFormula(formula: string): ValidacionToken[] {
    const piezas = formula.match(/C(\d+)|<=|>=|=|\+/g);
    if (!piezas) throw new Error(`No se pudo leer la fórmula: "${formula}"`);
    return piezas.map((pieza) => {
      const campo = pieza.match(/^C(\d+)$/);
      return campo ? { type: 'field', num: Number(campo[1]) } : { type: 'sym', sym: pieza };
    });
  }

  private sumaTokens(
    tokens: ValidacionToken[],
    valoresPorPosicion: Map<number, string>,
  ): { suma: number; algunVacio: boolean } {
    let suma = 0;
    let algunVacio = false;
    tokens.forEach((t) => {
      if (t.type !== 'field') return;
      const val = valoresPorPosicion.get(t.num as number);
      if (val === '' || val === undefined || val === null) {
        algunVacio = true;
        return;
      }
      suma += Number(val) || 0;
    });
    return { suma, algunVacio };
  }

  evaluarValidacion(val: Validacion, valoresPorPosicion: Map<number, string>): ResultadoValidacion {
    // parsearFormula lanza error a propósito ante una fórmula mal escrita
    // (así la prueba de integridad la detecta fuerte, en el momento). Acá,
    // en cambio, viendo el formulario real de una persona, una fórmula
    // rara nunca debe tumbar el resto del formulario — se ignora esa
    // validación puntual (como si no aplicara) y las demás siguen
    // funcionando con normalidad.
    let tokens: ValidacionToken[];
    try {
      tokens = this.parsearFormula(val.formula);
    } catch {
      return { aplica: false };
    }
    const opIdx = tokens.findIndex((t) => t.type === 'sym' && ['=', '<=', '>='].includes(t.sym as string));
    if (opIdx === -1) return { aplica: false };
    const izq = tokens.slice(0, opIdx);
    const op = tokens[opIdx].sym as string;
    const der = tokens.slice(opIdx + 1);
    const { suma: sumaIzq, algunVacio: vacioIzq } = this.sumaTokens(izq, valoresPorPosicion);
    const { suma: sumaDer, algunVacio: vacioDer } = this.sumaTokens(der, valoresPorPosicion);
    if (vacioIzq || vacioDer) return { aplica: false };
    let cumple: boolean;
    if (op === '=') cumple = sumaIzq === sumaDer;
    else if (op === '<=') cumple = sumaIzq <= sumaDer;
    else cumple = sumaIzq >= sumaDer; // '>='
    return { aplica: true, cumple, msg: cumple ? val.msgOk : val.msgFail };
  }
}
