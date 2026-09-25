import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Contenedor } from './entities/contenedor.entity';
import { ValorCampo } from './entities/valor-campo.entity';
import { ValidacionService, Validacion } from './validacion.service';
import { FormularioPregunta } from '../forms/entities/formulario-pregunta.entity';
import { Pregunta } from '../forms/entities/pregunta.entity';
import { Slep } from '../forms/entities/slep.entity';
import { ConsolidadoService } from '../dashboard/consolidado.service';

export interface CampoConValor {
  id: string; // 'c01'..'c44'
  numero: number;
  preguntaId: string;
  nombre: string;
  tipo: string;
  valor: string;
  ayuda: unknown;
  valorFijo: string | null;
  opciones: string[] | null;
  invalido: boolean;
}

@Injectable()
export class CasesService {
  constructor(
    @InjectRepository(Contenedor) private readonly contenedores: Repository<Contenedor>,
    @InjectRepository(ValorCampo) private readonly valoresCampo: Repository<ValorCampo>,
    @InjectRepository(FormularioPregunta) private readonly recetas: Repository<FormularioPregunta>,
    @InjectRepository(Slep) private readonly sleps: Repository<Slep>,
    private readonly validacionService: ValidacionService,
    private readonly consolidadoService: ConsolidadoService,
  ) {}

  // Equivalente a crearMesVacio() del PMV (TDD, sección 7.9): crea los 36
  // contenedores vacíos de un mes nuevo, con sus campos de identificación
  // (Ministerio, Subsecretaría, Servicio/SLEP) ya resueltos desde el
  // banco de preguntas — nunca importa ningún archivo.
  async crearMesVacio(mes: string, anio: string, formularioId: string, usuarioId: string | null) {
    const yaExiste = await this.contenedores.findOne({ where: { mesConsolidado: mes, anioConsolidado: anio } });
    if (yaExiste) {
      throw new BadRequestException(`Ya existe un mes ${mes} ${anio} cargado en el sistema.`);
    }

    const receta = await this.recetas.find({ where: { formularioId }, relations: ['pregunta'] });
    if (!receta.length) throw new NotFoundException(`No existe el formulario "${formularioId}".`);
    const sleps = await this.sleps.find();

    const nuevos: Contenedor[] = [];
    for (const slepRow of sleps) {
      const contenedor = this.contenedores.create({
        slep: slepRow.nombre,
        mesConsolidado: mes,
        anioConsolidado: anio,
        formularioId,
        status: 'pending',
        filled: 0,
        total: receta.length,
        creadoPorId: usuarioId,
      });
      const guardado = await this.contenedores.save(contenedor);

      const valoresIniciales: ValorCampo[] = [];
      let filled = 0;
      for (const item of receta) {
        let valor = '';
        if (item.pregunta.nombre === 'Servicio / SLEP') valor = slepRow.nombre;
        else if (item.pregunta.valorFijo) valor = item.pregunta.valorFijo;
        if (valor !== '') {
          valoresIniciales.push(this.valoresCampo.create({ contenedorId: guardado.id, preguntaId: item.preguntaId, valor }));
          filled++;
        }
      }
      if (valoresIniciales.length) await this.valoresCampo.save(valoresIniciales);
      guardado.filled = filled;
      await this.contenedores.save(guardado);
      nuevos.push(guardado);
    }
    return nuevos;
  }

  // Equivalente a guardarValoresManualmente() del PMV (TDD, sección
  // 13.7): única puerta para escribir valores — recalcula "filled" y
  // vuelve a correr las validaciones, igual que el motor de importación.
  async guardarValores(contenedorId: string, valores: Record<string, string>) {
    const contenedor = await this.contenedores.findOne({ where: { id: contenedorId } });
    if (!contenedor) throw new NotFoundException('Contenedor no encontrado.');

    const filas: ValorCampo[] = Object.entries(valores).map(([preguntaId, valor]) =>
      this.valoresCampo.create({ contenedorId, preguntaId, valor: String(valor) }),
    );
    if (filas.length) await this.valoresCampo.save(filas);

    return this.revalidarYGuardar(contenedor);
  }

  // Recalcula "filled" y corre validateAllFieldsAndUpdateUI() (PMV) sobre
  // este contenedor, y persiste status/filled.
  private async revalidarYGuardar(contenedor: Contenedor) {
    const receta = await this.recetas.find({ where: { formularioId: contenedor.formularioId } });
    const valores = await this.valoresCampo.find({ where: { contenedorId: contenedor.id } });
    const valorPorPregunta = new Map(valores.map((v) => [v.preguntaId, v.valor]));

    const valoresPorPosicion = new Map<number, string>();
    receta.forEach((r) => {
      const v = valorPorPregunta.get(r.preguntaId);
      if (v !== undefined && v !== '') valoresPorPosicion.set(r.posicionCanonica, v);
    });

    let filled = 0;
    const invalidFieldIds: string[] = [];
    receta.forEach((r) => {
      if (valorPorPregunta.get(r.preguntaId)) filled++;
      const validaciones = (r.validaciones || []) as Validacion[];
      if (!validaciones.length) return;
      const algunaFalla = validaciones
        .map((v) => this.validacionService.evaluarValidacion(v, valoresPorPosicion))
        .some((res) => res.aplica && !res.cumple);
      if (algunaFalla) invalidFieldIds.push('c' + String(r.posicionCanonica).padStart(2, '0'));
    });

    contenedor.filled = filled;
    contenedor.status = invalidFieldIds.length ? 'no' : 'ok';
    await this.contenedores.save(contenedor);
    return { contenedor, invalidFieldIds };
  }

  // Ensambla un contenedor con sus valores y el resultado de validación
  // — equivalente a lo que el panel Formulario del PMV mostraba.
  async getContenedorConValores(contenedorId: string): Promise<{ contenedor: Contenedor; campos: CampoConValor[] }> {
    const contenedor = await this.contenedores.findOne({ where: { id: contenedorId } });
    if (!contenedor) throw new NotFoundException('Contenedor no encontrado.');

    const { invalidFieldIds } = await this.revalidarYGuardar(contenedor);

    const receta = await this.recetas.find({
      where: { formularioId: contenedor.formularioId },
      relations: ['pregunta'],
      order: { posicionCanonica: 'ASC' },
    });
    const valores = await this.valoresCampo.find({ where: { contenedorId } });
    const valorPorPregunta = new Map(valores.map((v) => [v.preguntaId, v.valor]));

    const campos: CampoConValor[] = receta.map((item) => {
      const id = 'c' + String(item.posicionCanonica).padStart(2, '0');
      return {
        id,
        numero: item.posicionCanonica,
        preguntaId: item.preguntaId,
        nombre: item.pregunta.nombre,
        tipo: item.pregunta.tipo,
        valor: valorPorPregunta.get(item.preguntaId) ?? '',
        ayuda: item.pregunta.ayuda,
        valorFijo: item.pregunta.valorFijo,
        opciones: item.pregunta.opciones,
        invalido: invalidFieldIds.includes(id),
      };
    });
    return { contenedor, campos };
  }

  // "Formulario total general" (mejora post-v2.23): la misma lista de 37
  // campos, pero con la SUMA de los SLEP dentro del alcance en vez del
  // valor de un solo contenedor — usa el mismo motor de suma que ya
  // alimenta al Dashboard (ConsolidadoService.calcularConsolidado),
  // nunca un cálculo aparte. De solo lectura por diseño: una suma no se
  // puede "guardar de vuelta" en 36 SLEP distintos.
  //
  // Las validaciones SÍ se corren, con el mismo motor que un SLEP
  // puntual — si cada SLEP cumple una regla (ej. "casos a investigar ≤
  // funcionarios involucrados"), la suma también debería cumplirla; que
  // el total la incumpla es una señal real de que algo anda mal en
  // algún SLEP, vale la pena mostrarlo.
  async getTotalGeneralConValores(mes: string, anio: string, alcance: string): Promise<{ totalContenedores: number; campos: CampoConValor[] }> {
    const ids = await this.consolidadoService.idsDelMes(mes, anio, alcance);
    const { snapshot, totalContenedores } = await this.consolidadoService.calcularConsolidado(ids);

    const receta = await this.recetas.find({
      where: { formularioId: 'seguimiento_disciplinario_37' },
      relations: ['pregunta'],
      order: { posicionCanonica: 'ASC' },
    });

    const valoresPorPosicion = new Map<number, string>();
    receta.forEach((r) => {
      const v = snapshot[r.preguntaId];
      if (v !== undefined && v !== '') valoresPorPosicion.set(r.posicionCanonica, String(v));
    });

    const invalidFieldIds: string[] = [];
    receta.forEach((r) => {
      const validaciones = (r.validaciones || []) as Validacion[];
      if (!validaciones.length) return;
      const algunaFalla = validaciones
        .map((v) => this.validacionService.evaluarValidacion(v, valoresPorPosicion))
        .some((res) => res.aplica && !res.cumple);
      if (algunaFalla) invalidFieldIds.push('c' + String(r.posicionCanonica).padStart(2, '0'));
    });

    const campos: CampoConValor[] = receta.map((item) => {
      const id = 'c' + String(item.posicionCanonica).padStart(2, '0');
      const valor = snapshot[item.preguntaId];
      // Q03 ("Servicio / SLEP") es el único campo de texto que es
      // DISTINTO en cada uno de los 36 — calcularConsolidado() junta
      // los nombres únicos con " / " (correcto para el motor genérico,
      // pero ilegible acá: 36 nombres pegados). Se muestra el conteo en
      // su lugar — solo cuando de verdad son varios SLEP; si es uno
      // solo (informe por SLEP puntual), snapshot ya trae su nombre
      // real tal cual, sin nada que arreglar.
      const valorMostrado =
        item.preguntaId === 'Q03' && totalContenedores > 1
          ? `${totalContenedores} SLEP`
          : valor !== undefined
            ? String(valor)
            : '';
      return {
        id,
        numero: item.posicionCanonica,
        preguntaId: item.preguntaId,
        nombre: item.pregunta.nombre,
        tipo: item.pregunta.tipo,
        valor: valorMostrado,
        ayuda: item.pregunta.ayuda,
        valorFijo: item.pregunta.valorFijo,
        opciones: item.pregunta.opciones,
        invalido: invalidFieldIds.includes(id),
      };
    });

    return { totalContenedores, campos };
  }

  // Lista contenedores de un mes, acotados por alcance (TDD, sección
  // 11.2.1) — 'todos' ve los 36, un SLEP puntual solo ve el suyo.
  //
  // "tieneDatosReales" (mejora post-v2.23, hallazgo real): distinto de
  // "filled". "filled" cuenta cualquier campo con texto, y en JavaScript
  // el string "0" cuenta como presente — un SLEP migrado con sus 37
  // campos en "0" (nunca reportó de verdad) salía "lleno" igual. Acá se
  // pregunta algo más simple y correcto: ¿hay al menos un campo, aparte
  // de los 3 fijos (Ministerio/Subsecretaría/nombre del SLEP, siempre
  // iguales para todos), con un valor numérico mayor que cero? Solo se
  // usa para la negrita del panel SLEP — no toca "filled", que sigue
  // sirviendo para saber si el formulario está completo (ahí "0" sí es
  // una respuesta válida).
  async listarPorMes(mes: string, anio: string, alcance: string): Promise<Contenedor[]> {
    const where: Record<string, string> = { mesConsolidado: mes, anioConsolidado: anio };
    if (alcance !== 'todos') where.slep = alcance;
    const contenedores = await this.contenedores.find({ where, order: { slep: 'ASC' } });
    if (!contenedores.length) return contenedores;

    const CAMPOS_FIJOS = new Set(['Q01', 'Q02', 'Q03']);
    const valores = await this.valoresCampo.find({ where: { contenedorId: In(contenedores.map((c) => c.id)) } });
    const porContenedor = new Map<string, ValorCampo[]>();
    valores.forEach((v) => {
      if (!porContenedor.has(v.contenedorId)) porContenedor.set(v.contenedorId, []);
      porContenedor.get(v.contenedorId)!.push(v);
    });

    return contenedores.map((c) => {
      const propios = porContenedor.get(c.id) ?? [];
      const tieneDatosReales = propios.some((v) => !CAMPOS_FIJOS.has(v.preguntaId) && Number(v.valor) > 0);
      return Object.assign(c, { tieneDatosReales });
    });
  }

  // Informe de errores (TDD, sección 9.5) — una fila por cada validación
  // que no se cumple, con su mensaje exacto. Reutiliza el mismo
  // ValidacionService que ya usa el guardado — nunca una segunda
  // implementación de las reglas.
  async listarErroresDelMes(mes: string, anio: string, alcance: string) {
    const contenedores = await this.listarPorMes(mes, anio, alcance);
    const errores: { slep: string; campo: string; mensaje: string }[] = [];

    for (const c of contenedores) {
      const receta = await this.recetas.find({ where: { formularioId: c.formularioId }, relations: ['pregunta'] });
      const valores = await this.valoresCampo.find({ where: { contenedorId: c.id } });
      const valorPorPregunta = new Map(valores.map((v) => [v.preguntaId, v.valor]));
      const valoresPorPosicion = new Map<number, string>();
      receta.forEach((r) => {
        const v = valorPorPregunta.get(r.preguntaId);
        if (v !== undefined && v !== '') valoresPorPosicion.set(r.posicionCanonica, v);
      });

      receta.forEach((r) => {
        const validaciones = (r.validaciones || []) as Validacion[];
        validaciones.forEach((val) => {
          const res = this.validacionService.evaluarValidacion(val, valoresPorPosicion);
          if (res.aplica && !res.cumple) {
            errores.push({ slep: c.slep, campo: `${r.posicionCanonica}. ${r.pregunta.nombre}`, mensaje: res.msg ?? val.msgFail });
          }
        });
      });
    }
    return errores;
  }

  // Equivalente a la deduplicación de _renderPanelMeses() del PMV (TDD,
  // sección 7.9) — los meses no son datos acotados por alcance (crearMesVacio
  // siempre crea los 36 SLEP a la vez), así que la lista es la misma para
  // cualquier usuario autenticado.
  async listarMesesDisponibles(): Promise<{ mes: string; anio: string }[]> {
    const filas = await this.contenedores
      .createQueryBuilder('c')
      .select('DISTINCT c.mes_consolidado', 'mes')
      .addSelect('c.anio_consolidado', 'anio')
      .getRawMany();
    const ORDEN_MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return filas
      .map((f) => ({ mes: f.mes as string, anio: f.anio as string }))
      .sort((a, b) => (Number(b.anio) * 100 + ORDEN_MESES.indexOf(b.mes)) - (Number(a.anio) * 100 + ORDEN_MESES.indexOf(a.mes)));
  }

  // Histórico de un SLEP puntual (panel "Ver Histórico"): una fila por
  // mes (el más reciente arriba), una columna por cada uno de los 37
  // campos del formulario estándar — siempre el mismo set de columnas,
  // sin importar qué formulario tenía asignado el contenedor de ese mes
  // en particular, para que la tabla nunca cambie de forma al recorrer
  // los meses. Solo incluye meses hasta el mes de corte (inclusive) —
  // nunca meses posteriores a donde está posicionado el usuario.
  async getHistoricoSlep(slep: string, hastaMes: string, hastaAnio: string) {
    const ORDEN_MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const claveOrden = (mes: string, anio: string) => Number(anio) * 100 + ORDEN_MESES.indexOf(mes);
    const corte = claveOrden(hastaMes, hastaAnio);

    const todosLosMeses = await this.listarMesesDisponibles(); // ya viene desc (más reciente primero)
    const meses = todosLosMeses.filter((m) => claveOrden(m.mes, m.anio) <= corte);

    const receta = await this.recetas.find({
      where: { formularioId: 'seguimiento_disciplinario_37' },
      relations: ['pregunta'],
      order: { posicionCanonica: 'ASC' },
    });
    const campos = receta.map((r) => ({
      id: 'c' + String(r.posicionCanonica).padStart(2, '0'),
      preguntaId: r.preguntaId,
      nombre: r.pregunta.nombre,
    }));

    const filas = [];
    for (const m of meses) {
      const contenedor = await this.contenedores.findOne({ where: { slep, mesConsolidado: m.mes, anioConsolidado: m.anio } });
      let valorPorPregunta = new Map<string, string>();
      if (contenedor) {
        const valores = await this.valoresCampo.find({ where: { contenedorId: contenedor.id } });
        valorPorPregunta = new Map(valores.map((v) => [v.preguntaId, v.valor]));
      }
      filas.push({
        mes: m.mes,
        anio: m.anio,
        valores: campos.map((c) => valorPorPregunta.get(c.preguntaId) ?? ''),
      });
    }

    return { slep, campos, filas };
  }
}
