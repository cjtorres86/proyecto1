import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contenedor } from '../cases/entities/contenedor.entity';
import { ValorCampo } from '../cases/entities/valor-campo.entity';
import { FormsService } from '../forms/forms.service';
import { Slep } from '../forms/entities/slep.entity';

const STEP_ID_DEFECTO = 'seguimiento_disciplinario_37';
// Igual que en el PMV (sección 9.4 del TDD): el Excel siempre trabaja
// sobre la plantilla de 37 preguntas — la de 44 no está calibrada para
// esto todavía (límite documentado, sección 6.6/13.8).

@Injectable()
export class ExcelService {
  constructor(
    @InjectRepository(Contenedor) private readonly contenedores: Repository<Contenedor>,
    @InjectRepository(ValorCampo) private readonly valoresCampo: Repository<ValorCampo>,
    @InjectRepository(Slep) private readonly sleps: Repository<Slep>,
    private readonly formsService: FormsService,
  ) {}

  private nombreHojaValido(nombre: string): string {
    return nombre.replace(/[*?:/\\[\]]/g, '').slice(0, 31);
  }

  private async valoresDeContenedor(contenedorId: string): Promise<Map<string, string>> {
    const filas = await this.valoresCampo.find({ where: { contenedorId } });
    return new Map(filas.map((f) => [f.preguntaId, f.valor]));
  }

  private async mesesPresentes(): Promise<{ mes: string; anio: string }[]> {
    const filas = await this.contenedores
      .createQueryBuilder('c')
      .select('DISTINCT c.mes_consolidado', 'mes')
      .addSelect('c.anio_consolidado', 'anio')
      .getRawMany();
    return filas.map((f) => ({ mes: f.mes, anio: f.anio }));
  }

  // Equivalente a construirLibroConsolidadoGeneral() del PMV — una hoja
  // por mes, cada hoja con los 36 SLEP.
  async construirLibroConsolidadoGeneral(): Promise<ExcelJS.Buffer> {
    const campos = await this.formsService.getCamposDePlantilla(STEP_ID_DEFECTO);
    const headerRow = ['SLEP', ...campos.map((c) => `${c.numero}. ${c.nombre}`), 'Estado'];
    const wb = new ExcelJS.Workbook();
    const meses = await this.mesesPresentes();

    for (const { mes, anio } of meses) {
      const contenedoresMes = await this.contenedores.find({
        where: { mesConsolidado: mes, anioConsolidado: anio },
        order: { slep: 'ASC' },
      });
      const ws = wb.addWorksheet(this.nombreHojaValido(`${mes} ${anio}`));
      ws.addRow(headerRow);
      for (const c of contenedoresMes) {
        const valores = await this.valoresDeContenedor(c.id);
        ws.addRow([c.slep, ...campos.map((cp) => valores.get(cp.preguntaId) ?? ''), c.status.toUpperCase()]);
      }
    }
    return wb.xlsx.writeBuffer();
  }

  // Equivalente a construirLibroConsolidadoPorSlep() del PMV — una hoja
  // por SLEP, cada hoja con sus meses.
  async construirLibroConsolidadoPorSlep(soloSlep?: string): Promise<ExcelJS.Buffer> {
    const campos = await this.formsService.getCamposDePlantilla(STEP_ID_DEFECTO);
    const headerRow = ['Mes', 'Año', ...campos.map((c) => `${c.numero}. ${c.nombre}`), 'Estado'];
    const meses = await this.mesesPresentes();
    const wb = new ExcelJS.Workbook();
    const listaSleps = soloSlep ? [{ nombre: soloSlep }] : await this.sleps.find({ order: { nombre: 'ASC' } });

    for (const slepRow of listaSleps) {
      const ws = wb.addWorksheet(this.nombreHojaValido(slepRow.nombre));
      ws.addRow(headerRow);
      for (const { mes, anio } of meses) {
        const cont = await this.contenedores.findOne({ where: { slep: slepRow.nombre, mesConsolidado: mes, anioConsolidado: anio } });
        if (!cont) { ws.addRow([mes, anio, ...campos.map(() => ''), '—']); continue; }
        const valores = await this.valoresDeContenedor(cont.id);
        ws.addRow([mes, anio, ...campos.map((cp) => valores.get(cp.preguntaId) ?? ''), cont.status.toUpperCase()]);
      }
    }
    return wb.xlsx.writeBuffer();
  }
}
