import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull, Not } from 'typeorm';
import { Contenedor } from './entities/contenedor.entity';
import { ValorCampo } from './entities/valor-campo.entity';
import { ValidacionService, Validacion } from './validacion.service';
import { FormularioPregunta } from '../forms/entities/formulario-pregunta.entity';
import { Pregunta } from '../forms/entities/pregunta.entity';
import { Slep } from '../forms/entities/slep.entity';
import { ConsolidadoService } from '../dashboard/consolidado.service';
import { CAMPOS_AVANCE, DashboardService } from '../dashboard/dashboard.service';

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
  // Detalle completo de cada validación que se pudo evaluar para este
  // campo (mejora post-v2.23, hallazgo real): antes solo llegaba
  // "invalido" (sí/no) — el motor ya calculaba la fórmula y el mensaje
  // correcto (msgFail/msgOk) pero se descartaban antes de salir del
  // backend. Puede tener más de una validación por campo.
  validaciones: { formula: string; mensaje: string; cumple: boolean }[];
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
    private readonly dashboardService: DashboardService,
  ) {}

  // Equivalente a crearMesVacio() del PMV (TDD, sección 7.9): crea los 36
  // contenedores vacíos de un mes nuevo, con sus campos de identificación
  // (Ministerio, Subsecretaría, Servicio/SLEP) ya resueltos desde el
  // banco de preguntas — nunca importa ningún archivo.
  // Crea el mes solo para los SLEP elegidos en el asistente (mejora
  // post-v2.23 — antes siempre eran los 36). Cada nombre se valida contra
  // el catálogo de SLEP: un nombre mal escrito se rechaza entero, en vez
  // de crear un contenedor huérfano. Se crean en el orden del catálogo.
  async crearMesVacio(mes: string, anio: string, formularioId: string, slepsElegidos: string[], usuarioId: string | null) {
    const yaExiste = await this.contenedores.count({ where: { mesConsolidado: mes, anioConsolidado: anio } });
    if (yaExiste) {
      throw new BadRequestException(`Ya existe un mes ${mes} ${anio} cargado en el sistema.`);
    }

    const receta = await this.recetas.find({ where: { formularioId }, relations: ['pregunta'] });
    if (!receta.length) throw new NotFoundException(`No existe el formulario "${formularioId}".`);

    const catalogo = await this.sleps.find({ order: { nombre: 'ASC' } });
    const elegidos = new Set(slepsElegidos);
    const desconocidos = [...elegidos].filter((nombre) => !catalogo.some((s) => s.nombre === nombre));
    if (desconocidos.length) {
      throw new BadRequestException(`SLEP no reconocidos: ${desconocidos.join(', ')}.`);
    }
    const sleps = catalogo.filter((s) => elegidos.has(s.nombre));

    // 2 escrituras en total, dentro de una transacción (optimización de
    // rendimiento): antes eran 3 escrituras por SLEP, una tras otra (108
    // para un mes completo), y si algo fallaba a mitad de camino el mes
    // quedaba creado a medias. Los id se generan acá para poder armar los
    // valores iniciales antes de insertar.
    const nuevos = sleps.map((slepRow) => {
      const id = randomUUID();
      const valores = receta.flatMap((item) => {
        const valor = item.pregunta.nombre === 'Servicio / SLEP' ? slepRow.nombre : (item.pregunta.valorFijo ?? '');
        return valor ? [{ contenedorId: id, preguntaId: item.preguntaId, valor }] : [];
      });
      const contenedor = {
        id,
        slep: slepRow.nombre,
        mesConsolidado: mes,
        anioConsolidado: anio,
        formularioId,
        status: 'pending' as const,
        filled: valores.length,
        total: receta.length,
        creadoPorId: usuarioId,
      };
      return { contenedor, valores };
    });
    await this.contenedores.manager.transaction(async (em) => {
      await em.getRepository(Contenedor).insert(nuevos.map((n) => n.contenedor));
      const valores = nuevos.flatMap((n) => n.valores);
      if (valores.length) await em.getRepository(ValorCampo).insert(valores);
    });
    return this.contenedores.find({ where: { id: In(nuevos.map((n) => n.contenedor.id)) }, order: { slep: 'ASC' } });
  }

  // Equivalente a guardarValoresManualmente() del PMV (TDD, sección
  // 13.7): única puerta para escribir valores — recalcula "filled" y
  // vuelve a correr las validaciones, igual que el motor de importación.
  //
  // Optimización de rendimiento: UNA sola escritura para todos los campos
  // (upsert = "insertar o actualizar", ON DUPLICATE KEY UPDATE de MySQL).
  // Antes, save() revisaba y actualizaba campo por campo — hasta 37
  // escrituras sueltas. Devuelve el formulario ya actualizado, así el
  // frontend no tiene que pedirlo de nuevo después de guardar.
  async guardarValores(contenedor: Contenedor, valores: Record<string, string>): Promise<{ contenedor: Contenedor; campos: CampoConValor[] }> {
    const filas = Object.entries(valores).map(([preguntaId, valor]) => ({ contenedorId: contenedor.id, preguntaId, valor: String(valor) }));
    if (filas.length) await this.valoresCampo.upsert(filas, ['contenedorId', 'preguntaId']);
    return this.detalleDe(contenedor);
  }

  // Un formulario (contenedor) por id, o error si no existe (o fue
  // eliminado). Consulta liviana para verificar acceso antes de hacer algo.
  async obtenerContenedor(contenedorId: string): Promise<Contenedor> {
    // find() y no findOne(): el contenedor carga su formulario de forma
    // automática (eager), y findOne con esa relación hace 2 consultas (una
    // de "ids distintos" y otra de datos). Por id, find() trae lo mismo
    // en 1 sola.
    const [contenedor] = await this.contenedores.find({ where: { id: contenedorId } });
    if (!contenedor) throw new NotFoundException('Contenedor no encontrado.');
    return contenedor;
  }

  // Corre las validaciones de una receta contra un mapa posición->valor
  // ya resuelto — reutilizado tanto para un SLEP puntual
  // (revalidarYGuardar) como para el total general
  // (getTotalGeneralConValores), mismo motor, un solo lugar. Devuelve,
  // por cada campo con al menos una regla que se pudo evaluar, el
  // detalle completo (fórmula + mensaje real + si se cumplió) — no solo
  // un sí/no, para que el Inspector de Campo pueda explicar el motivo,
  // no solo señalarlo.
  private evaluarTodasLasValidaciones(
    receta: FormularioPregunta[],
    valoresPorPosicion: Map<number, string>,
  ): Map<string, { formula: string; mensaje: string; cumple: boolean }[]> {
    const resultadosPorCampo = new Map<string, { formula: string; mensaje: string; cumple: boolean }[]>();
    receta.forEach((r) => {
      const validaciones = (r.validaciones || []) as Validacion[];
      if (!validaciones.length) return;
      const resultados = validaciones
        .map((v) => ({ v, res: this.validacionService.evaluarValidacion(v, valoresPorPosicion) }))
        .filter(({ res }) => res.aplica)
        .map(({ v, res }) => ({ formula: v.formula, mensaje: res.msg ?? '', cumple: !!res.cumple }));
      if (resultados.length) resultadosPorCampo.set('c' + String(r.posicionCanonica).padStart(2, '0'), resultados);
    });
    return resultadosPorCampo;
  }

  // Un formulario con sus valores y el resultado de sus validaciones —
  // equivalente a validateAllFieldsAndUpdateUI() + el panel Formulario del
  // PMV. Recalcula "filled" y el estado ('ok' / 'no').
  //
  // Optimización de rendimiento: 2 consultas, en paralelo (antes 6, en
  // fila, porque receta y valores se pedían 2 veces), y el estado se
  // escribe SOLO si cambió — antes se escribía cada vez que alguien
  // abría el formulario, aunque nada hubiera cambiado.
  async detalleDe(contenedor: Contenedor): Promise<{ contenedor: Contenedor; campos: CampoConValor[] }> {
    const [receta, valores] = await Promise.all([
      this.recetas.find({ where: { formularioId: contenedor.formularioId }, relations: ['pregunta'], order: { posicionCanonica: 'ASC' } }),
      this.valoresCampo.find({ where: { contenedorId: contenedor.id } }),
    ]);
    const valorPorPregunta = new Map(valores.map((v) => [v.preguntaId, v.valor]));

    const valoresPorPosicion = new Map<number, string>();
    receta.forEach((r) => {
      const v = valorPorPregunta.get(r.preguntaId);
      if (v !== undefined && v !== '') valoresPorPosicion.set(r.posicionCanonica, v);
    });
    const filled = receta.filter((r) => valorPorPregunta.get(r.preguntaId)).length;
    const validacionesPorCampo = this.evaluarTodasLasValidaciones(receta, valoresPorPosicion);
    const invalidFieldIds = [...validacionesPorCampo.entries()]
      .filter(([, resultados]) => resultados.some((r) => !r.cumple))
      .map(([id]) => id);

    const status = invalidFieldIds.length ? 'no' : 'ok';
    if (contenedor.filled !== filled || contenedor.status !== status) {
      contenedor.filled = filled;
      contenedor.status = status;
      await this.contenedores.update(contenedor.id, { filled, status });
    }

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
        validaciones: validacionesPorCampo.get(id) ?? [],
      };
    });
    return { contenedor, campos };
  }

  async getContenedorConValores(contenedorId: string): Promise<{ contenedor: Contenedor; campos: CampoConValor[] }> {
    return this.detalleDe(await this.obtenerContenedor(contenedorId));
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
    // La MISMA condición exacta que listarPorMes() (panel SLEP) — no se
    // llama a listarPorMes() directo para evitar su cálculo de
    // tieneDatosReales (trae los valores de los 36, innecesario solo
    // para contar). Hallazgo real: se vio un caso donde el panel SLEP
    // mostraba 36 y acá aparecían 20, sin una diferencia de lógica que lo
    // explicara entre las dos consultas (estaban en servicios distintos).
    // Repetir la MISMA condición, literal, en el mismo servicio que
    // listarPorMes(), hace que los dos números sean imposibles de
    // desalinear, sea cual sea la causa original.
    const where: Record<string, string> = { mesConsolidado: mes, anioConsolidado: anio };
    if (alcance !== 'todos') where.slep = alcance;
    const ids = (await this.contenedores.find({ where })).map((c) => c.id);
    const { snapshot } = await this.consolidadoService.calcularConsolidado(ids);
    const totalContenedores = ids.length;

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

    const validacionesPorCampo = this.evaluarTodasLasValidaciones(receta, valoresPorPosicion);
    const invalidFieldIds = [...validacionesPorCampo.entries()]
      .filter(([, resultados]) => resultados.some((r) => !r.cumple))
      .map(([id]) => id);

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
        validaciones: validacionesPorCampo.get(id) ?? [],
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
  //
  // Optimización de rendimiento: 3 consultas en total, sin importar
  // cuántos SLEP haya (antes 2 por SLEP, una tras otra: hasta 72+).
  async listarErroresDelMes(mes: string, anio: string, alcance: string) {
    const where: Record<string, string> = { mesConsolidado: mes, anioConsolidado: anio };
    if (alcance !== 'todos') where.slep = alcance;
    const contenedores = await this.contenedores.find({ where, order: { slep: 'ASC' } });
    if (!contenedores.length) return [];

    const [recetas, valores] = await Promise.all([
      this.recetas.find({
        where: { formularioId: In([...new Set(contenedores.map((c) => c.formularioId))]) },
        relations: ['pregunta'],
        order: { posicionCanonica: 'ASC' },
      }),
      this.valoresDe(contenedores.map((c) => c.id)),
    ]);
    const recetaPorFormulario = this.agrupar(recetas, (r) => r.formularioId);
    const valoresPorContenedor = this.agrupar(valores, (v) => v.contenedorId);

    const errores: { slep: string; campo: string; mensaje: string }[] = [];
    for (const c of contenedores) {
      const receta = recetaPorFormulario.get(c.formularioId) ?? [];
      const valorPorPregunta = new Map((valoresPorContenedor.get(c.id) ?? []).map((v) => [v.preguntaId, v.valor]));
      const valoresPorPosicion = new Map<number, string>();
      receta.forEach((r) => {
        const v = valorPorPregunta.get(r.preguntaId);
        if (v !== undefined && v !== '') valoresPorPosicion.set(r.posicionCanonica, v);
      });
      receta.forEach((r) => {
        ((r.validaciones || []) as Validacion[]).forEach((val) => {
          const res = this.validacionService.evaluarValidacion(val, valoresPorPosicion);
          if (res.aplica && !res.cumple) {
            errores.push({ slep: c.slep, campo: `${r.posicionCanonica}. ${r.pregunta.nombre}`, mensaje: res.msg ?? val.msgFail });
          }
        });
      });
    }
    return errores;
  }

  // --- Ayudantes para traer varios meses de una sola vez ---

  // Formularios vigentes de todos los meses hasta el corte (inclusive), en
  // UNA consulta — el filtro por mes se hace en memoria (son pocas filas:
  // 36 por mes). alcance: 'todos' o el nombre de un SLEP.
  private async contenedoresHastaCorte(hastaMes: string, hastaAnio: string, alcance: string): Promise<Contenedor[]> {
    const corte = this.claveOrden(hastaMes, hastaAnio);
    const where = alcance !== 'todos' ? { slep: alcance } : {};
    const todos = await this.contenedores.find({ where, order: { slep: 'ASC' } });
    return todos.filter((c) => this.claveOrden(c.mesConsolidado, c.anioConsolidado) <= corte);
  }

  // Valores de muchos formularios en UNA consulta (opcionalmente, solo
  // algunos campos).
  private async valoresDe(contenedorIds: string[], preguntaIds?: string[]): Promise<ValorCampo[]> {
    if (!contenedorIds.length) return [];
    return this.valoresCampo.find({
      where: { contenedorId: In(contenedorIds), ...(preguntaIds ? { preguntaId: In(preguntaIds) } : {}) },
    });
  }

  private agrupar<T>(filas: T[], clave: (fila: T) => string): Map<string, T[]> {
    const grupos = new Map<string, T[]>();
    filas.forEach((fila) => {
      const k = clave(fila);
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k)!.push(fila);
    });
    return grupos;
  }

  private claveMes(mes: string, anio: string): string {
    return `${mes}|${anio}`;
  }

  // Orden canónico de meses (Enero..Diciembre) — usado por
  // listarMesesDisponibles(), getHistoricoSlep() y
  // getHistoricoAvance()/getHistoricoAvanceTodosLosSlep() para el mismo
  // corte "hasta el mes activo, nunca después". Un solo lugar, en vez de
  // 3 copias de la misma lista y la misma fórmula.
  private static readonly ORDEN_MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  private claveOrden(mes: string, anio: string): number {
    return Number(anio) * 100 + CasesService.ORDEN_MESES.indexOf(mes);
  }
  // Todos los meses disponibles, hasta hastaMes/hastaAnio inclusive
  // (nunca después) — más reciente primero.
  private async mesesHastaCorte(hastaMes: string, hastaAnio: string): Promise<{ mes: string; anio: string }[]> {
    const corte = this.claveOrden(hastaMes, hastaAnio);
    const todos = await this.listarMesesDisponibles();
    return todos.filter((m) => this.claveOrden(m.mes, m.anio) <= corte);
  }

  // Equivalente a la deduplicación de _renderPanelMeses() del PMV (TDD,
  // sección 7.9) — los meses no son datos acotados por alcance (crearMesVacio
  // siempre crea los 36 SLEP a la vez), así que la lista es la misma para
  // cualquier usuario autenticado.
  //
  // Incluye si el mes está cerrado (mejora post-v2.23): cerrado = todos sus
  // contenedores tienen cerrado_en (se cierran juntos). Los contenedores
  // eliminados (borrado lógico) no aparecen: el QueryBuilder de TypeORM
  // agrega solo la condición "eliminado_en IS NULL".
  async listarMesesDisponibles(): Promise<{ mes: string; anio: string; cerrado: boolean }[]> {
    const filas = await this.contenedores
      .createQueryBuilder('c')
      .select('c.mes_consolidado', 'mes')
      .addSelect('c.anio_consolidado', 'anio')
      .addSelect('SUM(CASE WHEN c.cerrado_en IS NULL THEN 1 ELSE 0 END)', 'abiertos')
      .groupBy('c.mes_consolidado')
      .addGroupBy('c.anio_consolidado')
      .getRawMany();
    return filas
      .map((f) => ({ mes: f.mes as string, anio: f.anio as string, cerrado: Number(f.abiertos) === 0 }))
      .sort((a, b) => this.claveOrden(b.mes, b.anio) - this.claveOrden(a.mes, a.anio));
  }

  // Cierra el mes para todos (mejora post-v2.23): desde ahora nadie puede
  // modificar sus datos, salvo el superadmin. Solo toca contenedores
  // vigentes (no eliminados) que sigan abiertos.
  async cerrarMes(mes: string, anio: string, usuarioId: string): Promise<{ cerrados: number }> {
    const vigentes = await this.contenedores.count({ where: { mesConsolidado: mes, anioConsolidado: anio } });
    if (!vigentes) throw new NotFoundException(`No existe el mes ${mes} ${anio}.`);
    const resultado = await this.contenedores.update(
      { mesConsolidado: mes, anioConsolidado: anio, cerradoEn: IsNull(), eliminadoEn: IsNull() },
      { cerradoEn: new Date(), cerradoPorId: usuarioId },
    );
    if (!resultado.affected) throw new BadRequestException(`El mes ${mes} ${anio} ya estaba cerrado.`);
    return { cerrados: resultado.affected };
  }

  // Reabre el mes (mejora post-v2.23) — exclusivo del superadmin, se
  // verifica en el controlador. Limpia cerrado_en/cerrado_por_id de los
  // contenedores vigentes de ese mes.
  async abrirMes(mes: string, anio: string): Promise<{ abiertos: number }> {
    const vigentes = await this.contenedores.count({ where: { mesConsolidado: mes, anioConsolidado: anio } });
    if (!vigentes) throw new NotFoundException(`No existe el mes ${mes} ${anio}.`);
    const resultado = await this.contenedores.update(
      { mesConsolidado: mes, anioConsolidado: anio, cerradoEn: Not(IsNull()), eliminadoEn: IsNull() },
      { cerradoEn: null, cerradoPorId: null },
    );
    if (!resultado.affected) throw new BadRequestException(`El mes ${mes} ${anio} ya estaba abierto.`);
    return { abiertos: resultado.affected };
  }

  // Elimina el mes de la interfaz SIN borrar datos (mejora post-v2.23):
  // borrado lógico nativo de TypeORM (softDelete) — marca eliminado_en y
  // quién lo hizo; contenedores y valores quedan en la base. Solo afecta a
  // los contenedores vigentes de ese mes (una eliminación anterior del
  // mismo mes conserva su fecha original). En una transacción: se marcan
  // todos o ninguno.
  async eliminarMes(mes: string, anio: string, usuarioId: string): Promise<{ eliminados: number }> {
    return this.contenedores.manager.transaction(async (em) => {
      const repo = em.getRepository(Contenedor);
      const criterio = { mesConsolidado: mes, anioConsolidado: anio, eliminadoEn: IsNull() };
      const vigentes = await repo.count({ where: criterio });
      if (!vigentes) throw new NotFoundException(`No existe el mes ${mes} ${anio}.`);
      await repo.update(criterio, { eliminadoPorId: usuarioId });
      const resultado = await repo.softDelete(criterio);
      return { eliminados: resultado.affected ?? vigentes };
    });
  }

  // Planilla detallada de UN SLEP (meses x 37 campos), hasta el mes activo
  // inclusive — más reciente arriba. Siempre con la plantilla estándar de
  // 37 campos.
  //
  // Optimización de rendimiento: 2 etapas de consultas en paralelo, sin
  // importar cuántos meses haya (antes 2 consultas POR MES, en fila).
  async getHistoricoSlep(slep: string, hastaMes: string, hastaAnio: string) {
    const [meses, receta, contenedores] = await Promise.all([
      this.mesesHastaCorte(hastaMes, hastaAnio),
      this.recetas.find({ where: { formularioId: 'seguimiento_disciplinario_37' }, relations: ['pregunta'], order: { posicionCanonica: 'ASC' } }),
      this.contenedoresHastaCorte(hastaMes, hastaAnio, slep),
    ]);
    const campos = receta.map((r) => ({
      id: 'c' + String(r.posicionCanonica).padStart(2, '0'),
      preguntaId: r.preguntaId,
      nombre: r.pregunta.nombre,
    }));
    const valores = await this.valoresDe(contenedores.map((c) => c.id));
    const valoresPorContenedor = this.agrupar(valores, (v) => v.contenedorId);
    const contenedorPorMes = new Map<string, string>();
    contenedores.forEach((c) => {
      const k = this.claveMes(c.mesConsolidado, c.anioConsolidado);
      if (!contenedorPorMes.has(k)) contenedorPorMes.set(k, c.id); // si hubiera duplicados, el primero (igual que antes)
    });

    const filas = meses.map((m) => {
      const id = contenedorPorMes.get(this.claveMes(m.mes, m.anio));
      const valorPorPregunta = new Map((id ? (valoresPorContenedor.get(id) ?? []) : []).map((v) => [v.preguntaId, v.valor]));
      return { mes: m.mes, anio: m.anio, valores: campos.map((c) => valorPorPregunta.get(c.preguntaId) ?? '') };
    });
    return { slep, campos, filas };
  }

  // Gráfico de líneas del panel Histórico: el mismo % de avance del
  // indicador del Dashboard (DashboardService.calculateMetrics), mes a
  // mes. Sirve para la línea general (alcance='todos') Y para la de un SLEP
  // puntual. La consolidación de cada mes es la MISMA regla del Dashboard
  // (ConsolidadoService.consolidar), aplicada en memoria.
  //
  // Optimización de rendimiento: 2 etapas de consultas en paralelo (antes
  // 2 por mes, en fila), y solo se traen los 2 campos de los que depende
  // el avance (Q37 y Q45), no los 37.
  async getHistoricoAvance(hastaMes: string, hastaAnio: string, alcance: string): Promise<{ mes: string; anio: string; pct: number | null }[]> {
    const [meses, contenedores] = await Promise.all([
      this.mesesHastaCorte(hastaMes, hastaAnio),
      this.contenedoresHastaCorte(hastaMes, hastaAnio, alcance),
    ]);
    const valores = await this.valoresDe(contenedores.map((c) => c.id), CAMPOS_AVANCE);
    const mesDeContenedor = new Map(contenedores.map((c) => [c.id, this.claveMes(c.mesConsolidado, c.anioConsolidado)]));
    const valoresPorMes = this.agrupar(valores, (v) => mesDeContenedor.get(v.contenedorId)!);
    return meses.map((m) => {
      const snapshot = this.consolidadoService.consolidar(valoresPorMes.get(this.claveMes(m.mes, m.anio)) ?? []);
      return { mes: m.mes, anio: m.anio, pct: this.dashboardService.calculateMetrics(snapshot).pctAvance };
    });
  }

  // Planilla general del panel Histórico: columnas = los SLEP del mes de
  // corte, filas = mes, valor = % de avance de ESE SLEP en ESE mes (0 si no
  // hay datos o no tiene sumarios instruidos). Misma fórmula que el Ranking
  // (DashboardService.pctAvanceDe).
  //
  // Optimización de rendimiento: 2 etapas de consultas en paralelo (antes
  // 2 por mes, en fila), solo con los campos Q37 y Q45.
  async getHistoricoAvanceTodosLosSlep(hastaMes: string, hastaAnio: string, alcance: string): Promise<{ sleps: string[]; filas: { mes: string; anio: string; valores: number[] }[] }> {
    const [meses, contenedores] = await Promise.all([
      this.mesesHastaCorte(hastaMes, hastaAnio),
      this.contenedoresHastaCorte(hastaMes, hastaAnio, alcance),
    ]);
    const corte = this.claveMes(hastaMes, hastaAnio);
    const sleps = contenedores.filter((c) => this.claveMes(c.mesConsolidado, c.anioConsolidado) === corte).map((c) => c.slep);

    const valores = await this.valoresDe(contenedores.map((c) => c.id), CAMPOS_AVANCE);
    const valoresPorContenedor = this.agrupar(valores, (v) => v.contenedorId);
    const pctPorMesYSlep = new Map<string, number | null>();
    contenedores.forEach((c) => {
      const vals = Object.fromEntries((valoresPorContenedor.get(c.id) ?? []).map((v) => [v.preguntaId, v.valor]));
      pctPorMesYSlep.set(`${this.claveMes(c.mesConsolidado, c.anioConsolidado)}|${c.slep}`, this.dashboardService.pctAvanceDe(vals));
    });
    const filas = meses.map((m) => ({
      mes: m.mes,
      anio: m.anio,
      valores: sleps.map((s) => pctPorMesYSlep.get(`${this.claveMes(m.mes, m.anio)}|${s}`) ?? 0),
    }));
    return { sleps, filas };
  }
}
