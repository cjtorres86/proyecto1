import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermisosGuard } from '../../auth/guards/permisos.guard';
import { UsuarioActual } from '../../auth/decorators/usuario-actual.decorator';
import { Usuario } from '../../auth/entities/usuario.entity';
import { MensajesService } from './mensajes.service';
import { CrearMensajeDto, EditarMensajeDto, ReaccionDto } from './dto/mensajes.dto';

// Chat por campo, anidado bajo el formulario (contenedor) al que
// pertenece. Sin @Permisos: el acceso lo decide MensajesService con la
// misma regla por SLEP que los formularios.
@UseGuards(JwtAuthGuard, PermisosGuard)
@Controller('cases/:contenedorId/mensajes')
export class MensajesController {
  constructor(private readonly mensajes: MensajesService) {}

  @Get('no-leidos')
  noLeidos(@Param('contenedorId') contenedorId: string, @UsuarioActual() usuario: Usuario) {
    return this.mensajes.noLeidos(contenedorId, usuario);
  }

  @Get()
  listar(@Param('contenedorId') contenedorId: string, @Query('pregunta') preguntaId: string, @UsuarioActual() usuario: Usuario) {
    if (!preguntaId) throw new BadRequestException('Falta indicar el campo (pregunta).');
    return this.mensajes.listarHilo(contenedorId, preguntaId, usuario);
  }

  @Post()
  crear(@Param('contenedorId') contenedorId: string, @Body() dto: CrearMensajeDto, @UsuarioActual() usuario: Usuario) {
    return this.mensajes.crear(contenedorId, dto, usuario);
  }

  @Patch(':mensajeId')
  editar(
    @Param('contenedorId') contenedorId: string,
    @Param('mensajeId') mensajeId: string,
    @Body() dto: EditarMensajeDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.mensajes.editar(contenedorId, mensajeId, dto.texto, usuario);
  }

  @Delete(':mensajeId')
  borrar(@Param('contenedorId') contenedorId: string, @Param('mensajeId') mensajeId: string, @UsuarioActual() usuario: Usuario) {
    return this.mensajes.borrar(contenedorId, mensajeId, usuario);
  }

  @Post(':mensajeId/reacciones')
  reaccionar(
    @Param('contenedorId') contenedorId: string,
    @Param('mensajeId') mensajeId: string,
    @Body() dto: ReaccionDto,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.mensajes.reaccionar(contenedorId, mensajeId, dto.tipo, usuario);
  }
}
