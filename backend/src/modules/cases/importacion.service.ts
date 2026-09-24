import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { Contenedor } from './entities/contenedor.entity';
import { Pregunta } from '../forms/entities/pregunta.entity';
import { FormularioPregunta } from '../forms/entities/formulario-pregunta.entity';
import { CasesService } from './cases.service';

// Equivalente a mapearEncabezadosAlCatalogo()/cargarDatosParaContenedor()
// del PMV (TDD, sección 7.1/7.10) — mismo algoritmo de reconocimiento de
// encabezados por texto (nunca por posición de columna), ahora resuelto
// contra la tabla Pregunta en vez de un índice en memoria.
@Injectable()
export class ImportacionService {
  constructor(
    @InjectRepository(Contenedor) private readonly contenedores: Repository<Contenedor>,
    @InjectRepository(Pregunta) private readonly preguntas: Repository<Pregunta>,
    @InjectRepository(FormularioPregunta) private readonly recetas: Repository<FormularioPregunta>,
    private readonly casesService: CasesService,
  ) {}

  private normalizarEncabezado(t: string): string {
    let s = String(t ?? '');
    s = s.replace(/^\s*\d+(\.\d+)?\s*\.?\s*/, '');
    s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  async cargarDesdeExcel(contenedorId: string, buffer: Buffer): Promise<{ desconocidas: string[] }> {
    const contenedor = await this.contenedores.findOne({ where: { id: contenedorId } });
    if (!contenedor) throw new NotFoundException('Contenedor no encontrado.');

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];
    const filas = ws.getRows(1, ws.rowCount) ?? [];
    const encabezados = (filas[0]?.values as unknown[]) ?? [];

    // Índice alias -> Pregunta (equivalente a _catalogoIndice() del PMV).
    const todasLasPreguntas = await this.preguntas.find();
    const indice = new Map<string, Pregunta>();
    todasLasPreguntas.forEach((p) => (p.alias || []).forEach((a) => indice.set(a, p)));

    const columnaPorPreguntaId = new Map<number, string>(); // col -> preguntaId
    const desconocidas: string[] = [];
    encabezados.forEach((h, i) => {
      const texto = String(h ?? '').trim();
      if (!texto) return;
      const pregunta = indice.get(this.normalizarEncabezado(texto));
      if (!pregunta) { desconocidas.push(texto.slice(0, 80)); return; }
      columnaPorPreguntaId.set(i, pregunta.id);
    });

    // Elige la fila del SLEP del contenedor; si no aparece, la primera con datos.
    const filasDatos = filas.slice(1);
    const colServicio = [...columnaPorPreguntaId.entries()].find(([, pid]) => pid === 'Q03')?.[0];
    let filaElegida = colServicio
      ? filasDatos.find((f) => String(f.getCell(colServicio).value ?? '').trim() === contenedor.slep)
      : undefined;
    if (!filaElegida) {
      filaElegida = filasDatos.find((f) => (f.values as unknown[]).some((v) => v !== null && v !== undefined && v !== ''));
    }
    if (!filaElegida) return { desconocidas };

    const valores: Record<string, string> = {};
    columnaPorPreguntaId.forEach((preguntaId, col) => {
      const val = filaElegida!.getCell(col).value;
      if (val !== null && val !== undefined && val !== '') valores[preguntaId] = String(val);
    });

    await this.casesService.guardarValores(contenedorId, valores);
    return { desconocidas };
  }
}
