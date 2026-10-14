import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { Contenedor } from './entities/contenedor.entity';
import { Pregunta } from '../forms/entities/pregunta.entity';
import { FormularioPregunta } from '../forms/entities/formulario-pregunta.entity';

// Un problema del archivo, explicado para quien lo carga.
export interface ProblemaArchivo { titulo: string; detalle: string; solucion: string }

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

  // cell.text (ExcelJS) entrega el texto visible de la celda: resuelve
  // fórmulas (su resultado), texto enriquecido e hipervínculos — a
  // diferencia de cell.value, que en esos casos es un objeto.
  // Seguro ante celdas raras: la parte "tapada" de una celda combinada (ExcelJS
  // falla al leer su texto) y las fórmulas con error (se devuelve el error,
  // ej. "#DIV/0!", en vez de "[object Object]").
  private textoCelda(cell: ExcelJS.Cell): string {
    try {
      const v = cell.value as unknown;
      const res = v && typeof v === 'object' && 'result' in (v as object) ? (v as { result: unknown }).result : null;
      if (res && typeof res === 'object' && 'error' in (res as object)) return String((res as { error: string }).error);
      return String(cell.text ?? '').trim();
    } catch {
      return '';
    }
  }

  private resumir(lista: string[], maximo = 5): string {
    const visibles = lista.slice(0, maximo).join(', ');
    return lista.length > maximo ? `${visibles} y ${lista.length - maximo} más` : visibles;
  }

  async leerDesdeExcel(
    contenedorId: string,
    buffer: Buffer,
    nombreArchivo = '',
  ): Promise<{ valores: Record<string, string>; slep: string; slepEnArchivo: string; nombreArchivo: string }> {
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
      throw new BadRequestException({
        statusCode: 400, error: 'Bad Request', message: 'El archivo no es un Excel válido (.xlsx).',
        problemas: [{ titulo: 'No pudimos abrir el archivo', detalle: 'No es un Excel .xlsx válido (puede ser un .xls antiguo, un .csv o un archivo dañado).', solucion: 'Ábrelo en Excel y usa «Guardar como» → «Libro de Excel (.xlsx)».' }],
      });
    }
    const ws = wb.worksheets[0];
    if (!ws) {
      throw new BadRequestException({
        statusCode: 400, error: 'Bad Request', message: 'El archivo Excel no tiene hojas.',
        problemas: [{ titulo: 'El archivo no tiene hojas', detalle: 'No encontramos ninguna hoja con datos.', solucion: 'Abre el archivo en Excel, revisa que tenga los datos en la primera hoja y vuelve a guardarlo como .xlsx.' }],
      });
    }

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

    // Cada problema con qué pasó y cómo corregirlo: el navegador los muestra
    // en una ventana, uno por uno.
    const problemas: ProblemaArchivo[] = [];
    if (faltantes.length) problemas.push({ titulo: `Faltan ${faltantes.length} columnas del formulario`, detalle: this.resumir(faltantes), solucion: 'Agrega esas columnas en la fila 1, con el nombre de la pregunta tal como aparece en el formulario.' });
    if (noReconocidas.length) problemas.push({ titulo: 'Hay columnas que no reconocemos', detalle: this.resumir(noReconocidas), solucion: 'Bórralas o corrige su nombre para que sea igual al de la pregunta del formulario.' });
    if (deOtroFormulario.length) problemas.push({ titulo: 'Hay columnas de otro formulario', detalle: this.resumir(deOtroFormulario), solucion: 'Quítalas: este mes usa otro formulario. Descarga la plantilla del mes para partir con las columnas correctas.' });
    if (repetidas.length) problemas.push({ titulo: 'Hay columnas repetidas', detalle: this.resumir(repetidas), solucion: 'Deja una sola columna por pregunta.' });
    if (filasDatos.length === 0) problemas.push({ titulo: 'No encontramos los datos', detalle: 'Bajo los encabezados (fila 1) no hay ninguna fila con datos.', solucion: 'Escribe los datos de tu SLEP en la fila 2.' });
    if (filasDatos.length > 1) problemas.push({ titulo: `Hay ${filasDatos.length} filas con datos`, detalle: `Filas ${this.resumir(filasDatos.map((f) => String(f.number)))}.`, solucion: 'Deja solo la fila 2 con los datos de tu SLEP y borra las demás (también las que tengan espacios o notas).' });

    // Lo que "ensucia" una planilla y lleva a cargar datos equivocados.
    const ultimaColumna = Math.max(ws.actualColumnCount, ...[...columnaPorPregunta.values()]);
    const filasOcultas: string[] = [];
    for (let n = 1; n <= ws.rowCount; n++) if (ws.getRow(n).hidden) filasOcultas.push(String(n));
    const columnasOcultas: string[] = [];
    for (let c = 1; c <= ultimaColumna; c++) if (ws.getColumn(c).hidden) columnasOcultas.push(ws.getColumn(c).letter);
    if (filasOcultas.length || columnasOcultas.length) {
      problemas.push({
        titulo: 'Hay filas o columnas ocultas',
        detalle: [filasOcultas.length ? `Filas ${this.resumir(filasOcultas)}` : '', columnasOcultas.length ? `Columnas ${this.resumir(columnasOcultas)}` : ''].filter(Boolean).join(' · ') + '.',
        solucion: 'Muéstralas (selecciona todo, clic derecho → Mostrar) y borra lo que no corresponda: lo oculto también se lee.',
      });
    }
    const combinadas: string[] = ((ws as unknown as { model?: { merges?: string[] } }).model?.merges ?? []).filter(Boolean);
    if (combinadas.length) problemas.push({ titulo: 'Hay celdas combinadas', detalle: `Rangos ${this.resumir(combinadas)}.`, solucion: 'Sepáralas (Inicio → Combinar y centrar → Separar celdas): cada pregunta debe tener su propia celda.' });
    const conError: string[] = [];
    const noNumericos: string[] = [];
    const fila2 = filasDatos[0];
    if (fila2) {
      const tipoPorPregunta = new Map(receta.map((r) => [r.preguntaId, r.pregunta]));
      columnaPorPregunta.forEach((col, preguntaId) => {
        const celda = fila2.getCell(col);
        const v = celda.value as unknown;
        const resultado = v && typeof v === 'object' && 'result' in (v as object) ? (v as { result: unknown }).result : v;
        const pregunta = tipoPorPregunta.get(preguntaId);
        const nombre = `"${pregunta ? `${pregunta.nombre}`.slice(0, 50) : preguntaId}" (${celda.address})`;
        if (resultado && typeof resultado === 'object' && 'error' in (resultado as object)) {
          conError.push(`${nombre}: ${(resultado as { error: string }).error}`);
          return;
        }
        const texto = this.textoCelda(celda);
        if (texto && pregunta && (pregunta.tipo === 'number' || pregunta.tipo === 'money') && !/^-?\d+([.,]\d+)?$/.test(texto.replace(/\s/g, ''))) {
          noNumericos.push(`${nombre}: «${texto.slice(0, 20)}»`);
        }
      });
    }
    if (conError.length) problemas.push({ titulo: 'Hay fórmulas con error', detalle: this.resumir(conError, 4), solucion: 'Corrige la fórmula o reemplázala por su valor (copiar → pegar solo valores).' });
    if (noNumericos.length) problemas.push({ titulo: 'Hay valores que no son números', detalle: this.resumir(noNumericos, 4), solucion: 'Escribe solo el número, sin puntos de miles, signos ($) ni palabras. Por ejemplo, 1500 en vez de «1.500 casos».' });
    const errores = problemas.map((p) => `${p.titulo}: ${p.detalle}`);

    // El SLEP del archivo (campo 3) YA NO se exige que coincida (mejora
    // post-v2.23): se devuelve tal cual, y el navegador le muestra a quien
    // carga una ventana con el nombre del archivo y lo que dice su campo 3,
    // para que lo compruebe y acepte antes de cargar.

    // Mensaje como TEXTO PLANO, no un objeto {message, errores} (hallazgo
    // real, corrección): NestJS, cuando el mensaje que le pasas a una
    // excepción es un objeto, lo envuelve DE NUEVO dentro de su propio
    // "message" — el frontend terminaba recibiendo un objeto donde
    // esperaba texto, y como nunca usaba el arreglo "errores" (ya venía
    // todo junto y legible en el mensaje), no hacía falta mandarlo aparte.
    // "message" sigue siendo texto (lo leen las versiones anteriores del
    // navegador); "problemas" trae el detalle para la ventana explicativa.
    if (errores.length) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: `El archivo no tiene el formato del formulario, no se cargó ningún dato. ${errores.join('. ')}.`,
        problemas,
      });
    }

    const fila = filasDatos[0];
    const valores: Record<string, string> = {};
    columnaPorPregunta.forEach((col, preguntaId) => {
      const texto = this.textoCelda(fila.getCell(col));
      if (texto) valores[preguntaId] = texto;
    });
    // Lo que dice el campo 3 del archivo se informa, pero el formulario
    // guarda SIEMPRE el nombre oficial del SLEP al que se está cargando.
    const slepEnArchivo = valores['Q03'] ?? '';
    valores['Q03'] = contenedor.slep;

    return { valores, slep: contenedor.slep, slepEnArchivo, nombreArchivo };
  }
}
