import { Injectable } from '@nestjs/common';

export interface ValidacionToken {
  type: 'field' | 'sym';
  num?: number;
  sym?: string;
}
export interface Validacion {
  formula: string;
  tokens: ValidacionToken[];
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
@Injectable()
export class ValidacionService {
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
    const opIdx = val.tokens.findIndex((t) => t.type === 'sym' && ['=', '<=', '>='].includes(t.sym as string));
    if (opIdx === -1) return { aplica: false };
    const izq = val.tokens.slice(0, opIdx);
    const op = val.tokens[opIdx].sym as string;
    const der = val.tokens.slice(opIdx + 1);
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
