import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ValorCampo } from '../cases/entities/valor-campo.entity';
import { Contenedor } from '../cases/entities/contenedor.entity';

// Reglas de consolidación por preguntaId (TDD, sección 6.5) — idénticas a
// CAMPOS_TEXTO/CAMPOS_MIN/CAMPOS_MAX/CAMPOS_PROMEDIO_PONDERADO del PMV,
// pero referenciadas por id estable en vez de por posición ('c01'..'c37').
// Esto no es solo una traducción: resuelve de raíz el riesgo ya
// documentado en la sección 6.6/13.8 — consolidar por posición mezclaría
// mal datos de dos plantillas distintas; por id estable, nunca.
const CAMPOS_TEXTO = ['Q01', 'Q02', 'Q03'];
const CAMPOS_MIN = ['Q20'];
const CAMPOS_MAX = ['Q21'];
const CAMPOS_PROMEDIO_PONDERADO: Record<string, string> = { Q19: 'Q05', Q22: 'Q06' };

export type Snapshot = Record<string, string | number>;

@Injectable()
export class ConsolidadoService {
  constructor(
    @InjectRepository(ValorCampo) private readonly valoresCampo: Repository<ValorCampo>,
    @InjectRepository(Contenedor) private readonly contenedores: Repository<Contenedor>,
  ) {}

  // Equivalente a calcularConsolidado() del PMV — agrega los valores de
  // varios contenedores en un solo snapshot, aplicando la misma regla
  // por campo (texto único, mínimo, máximo, promedio ponderado, o suma).
  async calcularConsolidado(contenedorIds: string[]): Promise<{ snapshot: Snapshot; totalContenedores: number }> {
    if (!contenedorIds.length) return { snapshot: {}, totalContenedores: 0 };
    const valores = await this.valoresCampo
      .createQueryBuilder('v')
      .where('v.contenedor_id IN (:...ids)', { ids: contenedorIds })
      .getMany();
    return { snapshot: this.consolidar(valores), totalContenedores: contenedorIds.length };
  }

  // La regla de consolidación, PURA (optimización de rendimiento): no
  // consulta la base, solo agrega los valores que recibe. Así quien
  // necesita varios meses (Histórico) trae todos los valores en UNA
  // consulta y consolida cada mes en memoria — antes eran 2 consultas por
  // mes, una detrás de otra. Mismo cálculo exacto en todos los casos.
  consolidar(valores: { contenedorId: string; preguntaId: string; valor: string }[]): Snapshot {
    const porPregunta = new Map<string, { contenedorId: string; valor: string }[]>();
    valores.forEach((v) => {
      if (!porPregunta.has(v.preguntaId)) porPregunta.set(v.preguntaId, []);
      porPregunta.get(v.preguntaId)!.push({ contenedorId: v.contenedorId, valor: v.valor });
    });

    const snapshot: Snapshot = {};
    porPregunta.forEach((filas, preguntaId) => {
      const valoresNoVacios = filas.map((f) => f.valor).filter((v) => v !== '' && v != null);

      if (CAMPOS_TEXTO.includes(preguntaId)) {
        snapshot[preguntaId] = Array.from(new Set(valoresNoVacios)).join(' / ');
        return;
      }
      if (!valoresNoVacios.length) { snapshot[preguntaId] = ''; return; }

      if (CAMPOS_MIN.includes(preguntaId)) { snapshot[preguntaId] = Math.min(...valoresNoVacios.map(Number)); return; }
      if (CAMPOS_MAX.includes(preguntaId)) { snapshot[preguntaId] = Math.max(...valoresNoVacios.map(Number)); return; }

      const pesoId = CAMPOS_PROMEDIO_PONDERADO[preguntaId];
      if (pesoId) {
        const filasPeso = porPregunta.get(pesoId) || [];
        const pesoPorContenedor = new Map(filasPeso.map((f) => [f.contenedorId, f.valor]));
        let sumaPonderada = 0, sumaPesos = 0;
        filas.forEach((f) => {
          const peso = pesoPorContenedor.get(f.contenedorId);
          if (f.valor === '' || f.valor == null || peso === '' || peso == null) return;
          sumaPonderada += Number(f.valor) * Number(peso);
          sumaPesos += Number(peso);
        });
        snapshot[preguntaId] = sumaPesos > 0 ? Math.round((sumaPonderada / sumaPesos) * 10) / 10 : '';
        return;
      }

      snapshot[preguntaId] = valoresNoVacios.reduce((a, v) => a + Number(v), 0);
    });

    return snapshot;
  }

  async idsDelMes(mes: string, anio: string, alcance: string): Promise<string[]> {
    const where: Record<string, string> = { mesConsolidado: mes, anioConsolidado: anio };
    if (alcance !== 'todos') where.slep = alcance;
    const contenedores = await this.contenedores.find({ where });
    return contenedores.map((c) => c.id);
  }

  // Desglose por SLEP de UN campo — genérico, sirve para cualquier
  // pregunta_id presente o futuro (tooltips del dashboard). Mismo
  // patrón de dos consultas + Map en JS que ya usa getRankingSeries()
  // en dashboard.service.ts, por consistencia con el resto del código.
  async desglosePorSlep(contenedorIds: string[], preguntaId: string): Promise<{ slep: string; valor: number }[]> {
    if (!contenedorIds.length) return [];
    const contenedores = await this.contenedores.find({ where: { id: In(contenedorIds) } });
    const valores = await this.valoresCampo.find({ where: { contenedorId: In(contenedorIds), preguntaId } });
    const porContenedor = new Map(valores.map((v) => [v.contenedorId, v.valor]));
    return contenedores
      .map((c) => ({ slep: c.slep, valor: Number(porContenedor.get(c.id)) || 0 }))
      .filter((f) => f.valor > 0)
      .sort((a, b) => b.valor - a.valor);
  }

  // Igual que desglosePorSlep(), pero para una DIFERENCIA entre 2 grupos
  // de campos (ej. C06 - C19) — genérico también: sirve para cualquier
  // combinación de campos a sumar de cada lado, presente o futura.
  // Solo devuelve los SLEP donde la diferencia es distinta de 0 (los
  // que sí están "produciendo" la diferencia, no los 36).
  async desgloseDiferenciaPorSlep(
    contenedorIds: string[],
    camposMinuendo: string[],
    camposSustraendo: string[],
  ): Promise<{ slep: string; diferencia: number }[]> {
    if (!contenedorIds.length) return [];
    const todosLosCampos = [...camposMinuendo, ...camposSustraendo];
    const contenedores = await this.contenedores.find({ where: { id: In(contenedorIds) } });
    const valores = await this.valoresCampo.find({ where: { contenedorId: In(contenedorIds), preguntaId: In(todosLosCampos) } });
    const porContenedor = new Map<string, Map<string, number>>();
    valores.forEach((v) => {
      if (!porContenedor.has(v.contenedorId)) porContenedor.set(v.contenedorId, new Map());
      porContenedor.get(v.contenedorId)!.set(v.preguntaId, Number(v.valor) || 0);
    });
    return contenedores
      .map((c) => {
        const mapa = porContenedor.get(c.id) || new Map<string, number>();
        const suma = (ids: string[]) => ids.reduce((acc, id) => acc + (mapa.get(id) || 0), 0);
        return { slep: c.slep, diferencia: suma(camposMinuendo) - suma(camposSustraendo) };
      })
      .filter((f) => f.diferencia !== 0)
      .sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia));
  }
}
