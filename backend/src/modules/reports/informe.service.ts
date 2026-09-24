import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contenedor } from '../cases/entities/contenedor.entity';
import { ValorCampo } from '../cases/entities/valor-campo.entity';
import { FormsService } from '../forms/forms.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { ConsolidadoService } from '../dashboard/consolidado.service';

const STEP_ID_DEFECTO = 'seguimiento_disciplinario_37';

// Reports (parte de MAKEMAKE en el PMV — sección 5.1). Genera el informe
// HTML: mismo contenido de datos que el PMV (dashboard + respuestas del
// formulario), en una plantilla más simple — el diseño visual detallado
// del PMV (donut SVG, franjas de color) queda para una iteración de
// diseño posterior, no bloqueante para tener el dato correcto servido.
@Injectable()
export class InformeService {
  constructor(
    @InjectRepository(Contenedor) private readonly contenedores: Repository<Contenedor>,
    @InjectRepository(ValorCampo) private readonly valoresCampo: Repository<ValorCampo>,
    private readonly formsService: FormsService,
    private readonly dashboardService: DashboardService,
    private readonly consolidadoService: ConsolidadoService,
  ) {}

  async construirInformeHTML(mes: string, anio: string, alcance: string): Promise<string> {
    const esGeneral = alcance === 'todos';
    const dashboard = await this.dashboardService.getDashboardDeMes(mes, anio, alcance);
    const campos = await this.formsService.getCamposDePlantilla(STEP_ID_DEFECTO);

    const where: Record<string, string> = { mesConsolidado: mes, anioConsolidado: anio };
    if (!esGeneral) where.slep = alcance;
    const contenedores = await this.contenedores.find({ where, order: { slep: 'ASC' } });

    const filasRespuestas = await Promise.all(
      contenedores.map(async (c) => {
        const valores = await this.valoresCampo.find({ where: { contenedorId: c.id } });
        const porPregunta = new Map(valores.map((v) => [v.preguntaId, v.valor]));
        const celdas = campos.map((cp) => `<td>${this.escapar(porPregunta.get(cp.preguntaId) ?? '')}</td>`).join('');
        return `<tr><td><strong>${this.escapar(c.slep)}</strong></td><td>${c.status.toUpperCase()}</td>${celdas}</tr>`;
      }),
    );

    const m = dashboard.metricas;
    return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<title>Informe ${esGeneral ? 'ejecutivo' : alcance} — ${mes} ${anio}</title>
<style>
  body{font-family:Arial,sans-serif;margin:2rem;color:#1f2937;}
  h1{color:#1E3A8A;} h2{color:#1E3A8A;border-bottom:2px solid #e5e7eb;padding-bottom:.5rem;}
  .indicador{background:${m.pctAvance !== null && m.pctAvance >= 50 ? '#16A34A' : '#DC2626'};color:#fff;padding:1.5rem;border-radius:8px;text-align:center;font-size:2rem;font-weight:bold;margin:1rem 0;}
  table{border-collapse:collapse;width:100%;font-size:.8rem;margin-top:1rem;}
  th,td{border:1px solid #e5e7eb;padding:4px 8px;text-align:left;} th{background:#1E3A8A;color:#fff;}
</style></head><body>
  <h1>Informe ${esGeneral ? 'ejecutivo' : 'de ' + this.escapar(alcance)} — ${mes} ${anio}</h1>
  <h2>1. Dashboard</h2>
  <div class="indicador">${m.pctAvance ?? '—'}% — Avance de Sumarios (Procesos Cerrados ÷ Sumarios Instruidos)</div>
  <p>Total funcionarios involucrados: <strong>${m.totalFuncionarios}</strong> | Sumarios instruidos: <strong>${m.sumariosInstruidos}</strong> | Procesos cerrados: <strong>${m.procesosCerrados}</strong></p>
  <h2>2. Informe de respuestas del formulario</h2>
  <table>
    <thead><tr><th>SLEP</th><th>Estado</th>${campos.map((c) => `<th>${c.numero}. ${this.escapar(c.nombre)}</th>`).join('')}</tr></thead>
    <tbody>${filasRespuestas.join('')}</tbody>
  </table>
</body></html>`;
  }

  private escapar(s: string): string {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
