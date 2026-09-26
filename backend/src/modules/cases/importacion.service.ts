import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { Contenedor } from './entities/contenedor.entity';
import { Pregunta } from '../forms/entities/pregunta.entity';
import { FormularioPregunta } from '../forms/entities/formulario-pregunta.entity';

// Equivalente a mapearEncabezadosAlCatalogo()/cargarDatosParaContenedor()
// del PMV (TDD, sección 7.1/7.10) — mismo algoritmo de reconocimiento de
// encabezados por texto (nunca por posición de columna), resuelto contra
// la tabla Pregunta.
//
// Carga ESTRICTA (mejora post-v2.23): antes cargaba lo que reconocía y
// solo avisaba "N columnas no reconocidas". Ahora el archivo debe tener
// exactamente el formato del formulario del contenedor, o no se guarda
// NADA:
//   - todas las preguntas del formulario como encabezados (37 en la
//     plantilla estándar), sin columnas desconocidas, ajenas ni repetidas;
//   - exactamente UNA fila de datos bajo los encabezados;
//   - el SLEP de esa fila debe ser el del contenedor (un Digitador no
//     puede cargar por error los datos de otro SLEP).
// Si algo falla, el mensaje dice exactamente qué.
//
// Vista previa, sin guardar (mejora post-v2.23): este servicio SOLO lee y
// valida; devuelve los valores para que aparezcan en el formulario. Se
// registran recién cuando el Digitador revisa y presiona "Guardar" (misma
// ruta de guardado que el ingreso manual, con sus mismos controles).
@Injectable()
export class ImportacionService {
  constructor(
    @InjectRepository(Contenedor) private readonly contenedores: Repository<Contenedor>,
    @InjectRepository(Pregunta) private readonly preguntas: Repository<Pregunta>,
    @InjectRepository(FormularioPregunta) private readonly recetas: Repository<FormularioPregunta>,
  ) {}

  private normalizarEncabezado(t: string): string {
    let s = String(t ?? '');
    s = s.replace(/^\s*\d+(\.\d+)?\s*\.?\s*/, '');
    s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  // Para comparar nombres de SLEP sin que importen tildes, mayúsculas ni
  // espacios de más ("Los Álamos" = "los alamos").
  private normalizarNombre(t: string): string {
    return String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  // cell.text (ExcelJS) entrega el texto visible de la celda: resuelve
  // fórmulas (su resultado), texto enriquecido e hipervínculos — a
  // diferencia de cell.value, que en esos casos es un objeto.
  private textoCelda(cell: ExcelJS.Cell): string {
    return String(cell.text ?? '').trim();
  }

  private resumir(lista: string[], maximo = 5): string {
    const visibles = lista.slice(0, maximo).join(', ');
    return lista.length > maximo ? `${visibles} y ${lista.length - maximo} más` : visibles;
  }

  async leerDesdeExcel(contenedorId: string, buffer: Buffer): Promise<{ valores: Record<string, string> }> {
    const [contenedor] = await this.contenedores.find({ where: { id: contenedorId } }); // 1 consulta (ver CasesService.obtenerContenedor)
    if (!contenedor) throw new NotFoundException('Contenedor no encontrado.');

    const receta = await this.recetas.find({
      where: { formularioId: contenedor.formularioId },
      relations: ['pregunta'],
      order: { posicionCanonica: 'ASC' },
    });
    const idsDelFormulario = new Set(receta.map((r) => r.preguntaId));

    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buffer as any);
    } catch {
      throw new BadRequestException({ message: 'El archivo no es un Excel válido (.xlsx).', errores: [] });
    }
    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException({ message: 'El archivo Excel no tiene hojas.', errores: [] });

    // Índice alias -> Pregunta (equivalente a _catalogoIndice() del PMV).
    // Se indexa el catálogo completo, no solo este formulario, para poder
    // distinguir "no reconocida" de "pertenece a otro formulario".
    const todasLasPreguntas = await this.preguntas.find();
    const indice = new Map<string, Pregunta>();
    todasLasPreguntas.forEach((p) => (p.alias || []).forEach((a) => indice.set(a, p)));

    // Encabezados (fila 1).
    const columnaPorPregunta = new Map<string, number>();
    const noReconocidas: string[] = [];
    const deOtroFormulario: string[] = [];
    const repetidas: string[] = [];
    ws.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
      const texto = this.textoCelda(cell);
      if (!texto) return;
      const pregunta = indice.get(this.normalizarEncabezado(texto));
      const etiqueta = `"${texto.slice(0, 60)}"`;
      if (!pregunta) {
        noReconocidas.push(etiqueta);
      } else if (!idsDelFormulario.has(pregunta.id)) {
        deOtroFormulario.push(etiqueta);
      } else if (columnaPorPregunta.has(pregunta.id)) {
        repetidas.push(etiqueta);
      } else {
        columnaPorPregunta.set(pregunta.id, col);
      }
    });
    const faltantes = receta
      .filter((r) => !columnaPorPregunta.has(r.preguntaId))
      .map((r) => `${r.posicionCanonica}. ${r.pregunta.nombre}`);

    // Filas de datos: desde la 2, solo las que tienen al menos una celda
    // con texto (Excel suele "recordar" filas vacías con formato).
    const filasDatos: ExcelJS.Row[] = [];
    for (let n = 2; n <= ws.rowCount; n++) {
      const fila = ws.getRow(n);
      let tieneDatos = false;
      fila.eachCell({ includeEmpty: false }, (cell) => {
        if (this.textoCelda(cell)) tieneDatos = true;
      });
      if (tieneDatos) filasDatos.push(fila);
    }

    const errores: string[] = [];
    if (faltantes.length) errores.push(`Faltan ${faltantes.length} columnas del formulario: ${this.resumir(faltantes)}.`);
    if (noReconocidas.length) errores.push(`Columnas no reconocidas: ${this.resumir(noReconocidas)}.`);
    if (deOtroFormulario.length) errores.push(`Columnas que no pertenecen a este formulario: ${this.resumir(deOtroFormulario)}.`);
    if (repetidas.length) errores.push(`Columnas repetidas: ${this.resumir(repetidas)}.`);
    if (filasDatos.length === 0) errores.push('No hay una fila de datos bajo los encabezados.');
    if (filasDatos.length > 1) errores.push(`Debe haber una sola fila de datos y hay ${filasDatos.length}.`);

    // El SLEP solo se revisa si el formato ya está bien (si no, la columna
    // podría no existir o la fila no ser la correcta).
    if (!errores.length) {
      const slepArchivo = this.textoCelda(filasDatos[0].getCell(columnaPorPregunta.get('Q03')!));
      if (!slepArchivo) {
        errores.push('La fila de datos no indica el SLEP (columna "Servicio / SLEP").');
      } else if (this.normalizarNombre(slepArchivo) !== this.normalizarNombre(contenedor.slep)) {
        errores.push(`Los datos del archivo son de "${slepArchivo}", pero este formulario es de "${contenedor.slep}".`);
      }
    }

    if (errores.length) {
      throw new BadRequestException({
        message: `El archivo no tiene el formato del formulario, no se cargó ningún dato. ${errores.join(' ')}`,
        errores,
      });
    }

    const fila = filasDatos[0];
    const valores: Record<string, string> = {};
    columnaPorPregunta.forEach((col, preguntaId) => {
      const texto = this.textoCelda(fila.getCell(col));
      if (texto) valores[preguntaId] = texto;
    });
    // Ya se comprobó que es el mismo SLEP (sin importar tildes ni
    // mayúsculas); se guarda siempre con su nombre oficial.
    valores['Q03'] = contenedor.slep;

    return { valores };
  }
}
