import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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

  // Todos los formularios vigentes (opcionalmente de un solo SLEP) y todos
  // sus valores, en 2 consultas — la base de los 2 libros Excel, que
  // después se arman en memoria.
  //
  // Optimización de rendimiento: antes se consultaba una vez por cada
  // formulario (y por cada SLEP x mes en el libro por SLEP): cientos de
  // consultas por descarga, más de mil en el libro por SLEP.
  private async datosDeExportacion(soloSlep?: string) {
    const contenedores = await this.contenedores.find({ where: soloSlep ? { slep: soloSlep } : {}, order: { slep: 'ASC' } });
    const valores = contenedores.length
      ? await this.valoresCampo.find({ where: { contenedorId: In(contenedores.map((c) => c.id)) } })
      : [];
    const valoresPorContenedor = new Map<string, Map<string, string>>();
    valores.forEach((v) => {
      if (!valoresPorContenedor.has(v.contenedorId)) valoresPorContenedor.set(v.contenedorId, new Map());
      valoresPorContenedor.get(v.contenedorId)!.set(v.preguntaId, v.valor);
    });
    return { contenedores, valoresPorContenedor };
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
    const [meses, { contenedores, valoresPorContenedor }] = await Promise.all([this.mesesPresentes(), this.datosDeExportacion()]);

    for (const { mes, anio } of meses) {
      const ws = wb.addWorksheet(this.nombreHojaValido(`${mes} ${anio}`));
      ws.addRow(headerRow);
      for (const c of contenedores.filter((x) => x.mesConsolidado === mes && x.anioConsolidado === anio)) {
        const valores = valoresPorContenedor.get(c.id) ?? new Map<string, string>();
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
    const wb = new ExcelJS.Workbook();
    const [meses, listaSleps, { contenedores, valoresPorContenedor }] = await Promise.all([
      this.mesesPresentes(),
      soloSlep ? Promise.resolve([{ nombre: soloSlep }]) : this.sleps.find({ order: { nombre: 'ASC' } }),
      this.datosDeExportacion(soloSlep),
    ]);
    const clave = (slep: string, mes: string, anio: string) => `${slep}|${mes}|${anio}`;
    // Si hubiera 2 formularios del mismo SLEP y mes (no debería: Crear mes
    // lo impide), se usa el primero, igual que antes.
    const contenedorPor = new Map<string, (typeof contenedores)[number]>();
    contenedores.forEach((c) => {
      const k = clave(c.slep, c.mesConsolidado, c.anioConsolidado);
      if (!contenedorPor.has(k)) contenedorPor.set(k, c);
    });

    for (const slepRow of listaSleps) {
      const ws = wb.addWorksheet(this.nombreHojaValido(slepRow.nombre));
      ws.addRow(headerRow);
      for (const { mes, anio } of meses) {
        const cont = contenedorPor.get(clave(slepRow.nombre, mes, anio));
        if (!cont) { ws.addRow([mes, anio, ...campos.map(() => ''), '—']); continue; }
        const valores = valoresPorContenedor.get(cont.id) ?? new Map<string, string>();
        ws.addRow([mes, anio, ...campos.map((cp) => valores.get(cp.preguntaId) ?? ''), cont.status.toUpperCase()]);
      }
    }
    return wb.xlsx.writeBuffer();
  }
}
