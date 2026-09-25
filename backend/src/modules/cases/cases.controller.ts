import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermisosGuard } from '../../auth/guards/permisos.guard';
import { Permisos } from '../../auth/decorators/permisos.decorator';
import { UsuarioActual } from '../../auth/decorators/usuario-actual.decorator';
import { Usuario } from '../../auth/entities/usuario.entity';
import { CasesService } from './cases.service';
import { ImportacionService } from './importacion.service';
import { CrearMesDto } from './dto/crear-mes.dto';
import { GuardarValoresDto } from './dto/guardar-valores.dto';

@UseGuards(JwtAuthGuard, PermisosGuard)
@Controller('cases')
export class CasesController {
  constructor(
    private readonly casesService: CasesService,
    private readonly importacionService: ImportacionService,
  ) {}

  @Permisos('crear_mes')
  @Post('crear-mes')
  crearMes(@Body() dto: CrearMesDto, @UsuarioActual() usuario: Usuario) {
    return this.casesService.crearMesVacio(dto.mes, dto.anio, dto.formularioId, dto.sleps, usuario.id);
  }

  @Get()
  async listar(@Query('mes') mes: string, @Query('anio') anio: string, @UsuarioActual() usuario: Usuario) {
    const alcance = usuario.esSuperadmin ? 'todos' : usuario.alcance;
    return this.casesService.listarPorMes(mes, anio, alcance);
  }

  // Antes de ':id' a propósito: si no, Nest interpretaría
  // "meses-disponibles" como un id de contenedor.
  @Get('meses-disponibles')
  listarMeses() {
    return this.casesService.listarMesesDisponibles();
  }

  @Get('errores')
  async listarErrores(@Query('mes') mes: string, @Query('anio') anio: string, @UsuarioActual() usuario: Usuario) {
    const alcance = usuario.esSuperadmin ? 'todos' : usuario.alcance;
    return this.casesService.listarErroresDelMes(mes, anio, alcance);
  }

  // Antes de ':id' por la misma razón que 'meses-disponibles' y 'errores'.
  @Get('historico')
  async getHistorico(
    @Query('slep') slep: string,
    @Query('mes') mes: string,
    @Query('anio') anio: string,
    @UsuarioActual() usuario: Usuario,
  ) {
    this.verificarAlcance(slep, usuario);
    return this.casesService.getHistoricoSlep(slep, mes, anio);
  }

  // "Formulario total general" (mejora post-v2.23) — la suma de los SLEP
  // dentro del alcance, campo por campo. Antes de ':id' por la misma
  // razón que el resto de las rutas estáticas de este controlador.
  //
  // Informe (interactivo/PDF, mejora post-v2.23): reutiliza esta MISMA
  // ruta para su hoja de formulario — pidiendo un SLEP puntual en vez
  // de 'todos' consigue el formulario real de ese SLEP, sin endpoint
  // aparte. Un usuario con alcance fijo nunca puede pedir un SLEP que
  // no sea el suyo, mismo límite que ya usa el Dashboard por SLEP.
  @Get('total-general')
  async getTotalGeneral(
    @Query('mes') mes: string,
    @Query('anio') anio: string,
    @Query('slep') slepPedido: string | undefined,
    @UsuarioActual() usuario: Usuario,
  ) {
    const alcance = this.resolverAlcance(usuario, slepPedido);
    return this.casesService.getTotalGeneralConValores(mes, anio, alcance);
  }

  // Gráfico de líneas del panel Histórico (mejora post-v2.23) — una
  // línea (general o de un SLEP puntual, según slep). Mismo límite de
  // alcance que el resto de las rutas de este controlador.
  @Get('historico-avance')
  async getHistoricoAvance(
    @Query('mes') mes: string,
    @Query('anio') anio: string,
    @Query('slep') slepPedido: string | undefined,
    @UsuarioActual() usuario: Usuario,
  ) {
    const alcance = this.resolverAlcance(usuario, slepPedido);
    return this.casesService.getHistoricoAvance(mes, anio, alcance);
  }

  // Planilla general del panel Histórico (mejora post-v2.23) — columnas
  // = SLEP, filas = mes. Un usuario con alcance fijo ve una sola
  // columna (la suya), nunca las de otro SLEP.
  @Get('historico-avance-todos')
  async getHistoricoAvanceTodos(@Query('mes') mes: string, @Query('anio') anio: string, @UsuarioActual() usuario: Usuario) {
    const alcance = usuario.alcance !== 'todos' ? usuario.alcance : 'todos';
    return this.casesService.getHistoricoAvanceTodosLosSlep(mes, anio, alcance);
  }

  // Mismo límite que DashboardController.resolverAlcance(): un usuario
  // con alcance 'todos' puede pedir cualquier SLEP puntual o 'todos'; un
  // usuario con alcance fijo (Digitador) nunca puede ver otro SLEP,
  // pase lo que pase en la query.
  private resolverAlcance(usuario: Usuario, slepPedido?: string): string {
    if (usuario.alcance !== 'todos') return usuario.alcance;
    return slepPedido && slepPedido !== 'todos' ? slepPedido : 'todos';
  }

  @Get(':id')
  async getUno(@Param('id') id: string, @UsuarioActual() usuario: Usuario) {
    const resultado = await this.casesService.getContenedorConValores(id);
    this.verificarAlcance(resultado.contenedor.slep, usuario);
    return resultado;
  }

  @Permisos('editar_formulario')
  @Patch(':id/valores')
  async guardarValores(
    @Param('id') id: string,
    @Body() dto: GuardarValoresDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    const actual = await this.casesService.getContenedorConValores(id);
    this.verificarAlcance(actual.contenedor.slep, usuario);
    return this.casesService.guardarValores(id, dto.valores);
  }

  // El alcance se verifica sobre el SLEP real del recurso ya cargado, no
  // por un parámetro de ruta (TDD, sección 11.2.1) — necesario porque
  // getUno()/guardarValores() reciben el id del contenedor, no su SLEP.
  private verificarAlcance(slepDelContenedor: string, usuario: Usuario) {
    if (usuario.esSuperadmin || usuario.alcance === 'todos') return;
    if (usuario.alcance !== slepDelContenedor) {
      throw new ForbiddenException(`No tienes acceso a los datos de ${slepDelContenedor}.`);
    }
  }

  // Equivalente a cargarDatosParaContenedor() del PMV (TDD, sección
  // 7.10) — solo carga los datos del SLEP del propio contenedor, nunca
  // crea contenedores nuevos (eso es exclusivo de crearMesVacio).
  @Permisos('editar_formulario')
  @Post(':id/importar')
  @UseInterceptors(FileInterceptor('archivo'))
  async importarArchivo(@Param('id') id: string, @UploadedFile() archivo: any, @UsuarioActual() usuario: Usuario) {
    const actual = await this.casesService.getContenedorConValores(id);
    this.verificarAlcance(actual.contenedor.slep, usuario);
    return this.importacionService.cargarDesdeExcel(id, archivo.buffer);
  }
}
