import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConsolidadoService, Snapshot } from './consolidado.service';
import { Contenedor } from '../cases/entities/contenedor.entity';
import { ValorCampo } from '../cases/entities/valor-campo.entity';

const CIC_LABELS: Record<string, string> = {
  CIC_9: 'CIC N°9 – Salidas país (C20)', CIC_10: 'CIC N°10 – Partos (C21)', CIC_13: 'CIC N°13 – Médicos investigación penal (C22)',
  CIC_14: 'CIC N°14 – FFAA salidas país (C23)', CIC_15: 'CIC N°15 – Casinos juego (C24)', CIC_16: 'CIC N°16 – Salidas regional (C25)',
  CIC_21: 'CIC N°21 – Trabajo otros empleadores (C26)',
};
const SANCION_LABELS: Record<string, string> = {
  CENSURA: 'Censura (C33)', Q48: 'Multa (C34)', Q49: 'Suspensión (C35)', Q50: 'Destitución (C36)', Q51: 'Sin sanción (C37)',
};

export interface SerieItem { id: string; label: string; valor: number; pct?: number }
export interface Metricas {
  totalCasos: number; totalLicencias: number; totalFuncionarios: number;
  continuanServicio: number; yaNoEstan: number;
  casosInvestigar: number; cic: SerieItem[];
  sumariosInstruidos: number; procesosEnCurso: number; procesosResueltos: number;
  procesosImpugnados: number; enviadosCGR: number; procesosCerrados: number;
  sanciones: SerieItem[]; pctAvance: number | null;
  // Diferencias (mejora post-v2.23, hallazgo real): en teoría nunca
  // deberían existir, pero distintos SLEP interpretan distinto qué va
  // en cada campo (ver AuthService... no, ver dashboard.service.ts,
  // comentario en calculateMetrics) — se calculan siempre, con signo,
  // para que cualquier anomalía sea visible en vez de quedar escondida
  // dentro del consolidado.
  diferenciaInvestigar: number; diferenciaCIC: number; diferenciaSanciones: number;
}

// Dashboard (codename en el PMV: RONGORONGO — sección 5.1). Capa de
// datos, equivalente exacto a calculateMetrics()/getXSeriesPct() del PMV
// — nunca dibuja nada, solo calcula (contrato de desacople, sección 5.5).
// Los únicos campos de los que depende el % de avance (Sumarios
// instruidos y Procesos cerrados) — quien solo necesita el avance trae
// solo estos 2 campos, no los 37.
export const CAMPOS_AVANCE = ['Q37', 'Q45'];

@Injectable()
export class DashboardService {
  constructor(
    private readonly consolidadoService: ConsolidadoService,
    @InjectRepository(Contenedor) private readonly contenedores: Repository<Contenedor>,
    @InjectRepository(ValorCampo) private readonly valoresCampo: Repository<ValorCampo>,
  ) {}

  calculateMetrics(snapshot: Snapshot): Metricas {
    const num = (v: unknown) => (v === '' || v == null ? 0 : Number(v));
    const sumariosInstruidos = num(snapshot.Q37);
    const procesosCerrados = num(snapshot.Q45);
    const totalFuncionarios = num(snapshot.Q06);
    const casosInvestigar = num(snapshot.Q23);
    const pctAvance = sumariosInstruidos > 0 ? Math.round((procesosCerrados / sumariosInstruidos) * 1000) / 10 : null;

    // Hallazgo real (mejora post-v2.23): C06 (funcionarios involucrados)
    // y C19 (a investigar) deberían coincidir salvo que se excluya
    // explícitamente a quienes YA_NO_ESTAN, pero distintos SLEP
    // interpretan distinto qué va en C19 — algunos informan C19 = C06
    // completo, otros solo a quienes CONTINÚAN. Mismo espíritu para las
    // otras 2 diferencias: la suma de las partes (CIC, sanciones)
    // debería relacionarse con el total (C27, C32), y cualquier
    // desviación merece verse, no quedar escondida en el consolidado.
    const cic = Object.keys(CIC_LABELS).map((id) => ({ id, label: CIC_LABELS[id], valor: num(snapshot[id]) }));
    const sanciones = Object.keys(SANCION_LABELS).map((id) => ({ id, label: SANCION_LABELS[id], valor: num(snapshot[id]) }));
    const sumaCIC = cic.reduce((acc, x) => acc + x.valor, 0);
    const sumaSanciones = sanciones.reduce((acc, x) => acc + x.valor, 0);

    return {
      totalCasos: num(snapshot.Q04), totalLicencias: num(snapshot.Q05), totalFuncionarios,
      continuanServicio: num(snapshot.Q07), yaNoEstan: num(snapshot.YA_NO_ESTAN),
      casosInvestigar, cic,
      sumariosInstruidos, procesosEnCurso: num(snapshot.Q38), procesosResueltos: num(snapshot.Q42),
      procesosImpugnados: num(snapshot.Q43), enviadosCGR: num(snapshot.Q44), procesosCerrados,
      sanciones, pctAvance,
      diferenciaInvestigar: totalFuncionarios - casosInvestigar,
      diferenciaCIC: sumaCIC - sumariosInstruidos,
      diferenciaSanciones: sumaSanciones - procesosCerrados,
    };
  }

  // Q37 y Q45 quedan fuera de esta lista a propósito (mejora post-v2.23):
  // son exactamente el mismo número que ya se muestra como el total
  // grande de esta tarjeta (Sumarios instruidos) y de la de Sanciones
  // (Procesos cerrados) — mostrarlos también como barra era 100%
  // redundante.
  private getProcedimientosSeries(m: Metricas): SerieItem[] {
    return [
      { id: 'Q38', label: 'En curso (C28)', valor: m.procesosEnCurso },
      { id: 'Q42', label: 'Resueltos (C29)', valor: m.procesosResueltos },
      { id: 'Q43', label: 'Impugnados (C30)', valor: m.procesosImpugnados },
      { id: 'Q44', label: 'Enviados a CGR (C31)', valor: m.enviadosCGR },
    ];
  }

  private comoPorcentaje(series: SerieItem[], denominador: number): SerieItem[] {
    return series.map((x) => ({ ...x, pct: denominador > 0 ? Math.round((x.valor / denominador) * 1000) / 10 : 0 }));
  }

  getCicSeriesPct(m: Metricas) { return this.comoPorcentaje(m.cic, m.casosInvestigar); }
  getProcedimientosSeriesPct(m: Metricas) { return this.comoPorcentaje(this.getProcedimientosSeries(m), m.sumariosInstruidos); }
  getSancionesSeriesPct(m: Metricas) { return this.comoPorcentaje(m.sanciones, m.procesosCerrados); }

  // Equivalente a getRankingSeries() del PMV — % de avance por SLEP,
  // ordenado de mayor a menor.
  // % de avance de UN formulario (Procesos cerrados ÷ Sumarios
  // instruidos), a partir de sus valores Q37/Q45. Una sola definición: la
  // usan el Ranking y la planilla general del Histórico.
  pctAvanceDe(valores: Record<string, string>): number | null {
    const instr = Number(valores.Q37) || 0;
    const cerr = Number(valores.Q45) || 0;
    return instr > 0 ? Math.round((cerr / instr) * 1000) / 10 : null;
  }

  async getRankingSeries(mes: string, anio: string, alcance: string): Promise<{ slep: string; pct: number | null }[]> {
    const where: Record<string, string> = { mesConsolidado: mes, anioConsolidado: anio };
    if (alcance !== 'todos') where.slep = alcance;
    const contenedores = await this.contenedores.find({ where });
    const valores = await this.valoresCampo
      .createQueryBuilder('v')
      .where('v.contenedor_id IN (:...ids)', { ids: contenedores.map((c) => c.id) })
      .andWhere('v.pregunta_id IN (:...preg)', { preg: CAMPOS_AVANCE })
      .getMany();
    const porContenedor = new Map<string, Record<string, string>>();
    valores.forEach((v) => {
      if (!porContenedor.has(v.contenedorId)) porContenedor.set(v.contenedorId, {});
      porContenedor.get(v.contenedorId)![v.preguntaId] = v.valor;
    });
    return contenedores
      .map((c) => {
        const pct = this.pctAvanceDe(porContenedor.get(c.id) || {});
        return { slep: c.slep, pct };
      })
      .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));
  }

  async getDashboardDeMes(mes: string, anio: string, alcance: string) {
    const ids = await this.consolidadoService.idsDelMes(mes, anio, alcance);
    const { snapshot, totalContenedores } = await this.consolidadoService.calcularConsolidado(ids);
    const metricas = this.calculateMetrics(snapshot);
    return {
      totalContenedores,
      metricas,
      cicPct: this.getCicSeriesPct(metricas),
      procedimientosPct: this.getProcedimientosSeriesPct(metricas),
      sancionesPct: this.getSancionesSeriesPct(metricas),
      // El ranking compara los 36 SLEP entre sí — no tiene sentido (y no
      // se calcula, para no gastar la consulta) cuando ya se está viendo
      // un SLEP puntual.
      ranking: alcance === 'todos' ? await this.getRankingSeries(mes, anio, alcance) : [],
    };
  }

  // Tooltips del dashboard: desglose por SLEP de un campo puntual. Se
  // pide bajo demanda (al primer hover, desde el frontend) — nunca al
  // cargar el dashboard completo, para no calcular 20+ desgloses que
  // capaz nadie mire.
  async getDesgloseCampo(mes: string, anio: string, alcance: string, preguntaId: string) {
    const ids = await this.consolidadoService.idsDelMes(mes, anio, alcance);
    return this.consolidadoService.desglosePorSlep(ids, preguntaId);
  }

  // Igual que getDesgloseCampo(), pero para las 3 diferencias del
  // dashboard (mejora post-v2.23) — qué SLEP están produciendo cada
  // diferencia, y cuánto aporta cada uno.
  private static readonly FORMULAS_DIFERENCIA: Record<string, { minuendo: string[]; sustraendo: string[] }> = {
    investigar: { minuendo: ['Q06'], sustraendo: ['Q23'] },
    cic: { minuendo: ['CIC_9', 'CIC_10', 'CIC_13', 'CIC_14', 'CIC_15', 'CIC_16', 'CIC_21'], sustraendo: ['Q37'] },
    sanciones: { minuendo: ['CENSURA', 'Q48', 'Q49', 'Q50', 'Q51'], sustraendo: ['Q45'] },
  };

  async getDesgloseDiferencia(mes: string, anio: string, alcance: string, tipo: string) {
    const formula = DashboardService.FORMULAS_DIFERENCIA[tipo];
    if (!formula) return [];
    const ids = await this.consolidadoService.idsDelMes(mes, anio, alcance);
    return this.consolidadoService.desgloseDiferenciaPorSlep(ids, formula.minuendo, formula.sustraendo);
  }
}
