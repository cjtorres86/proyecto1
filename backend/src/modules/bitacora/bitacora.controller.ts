import { Permisos } from '../../auth/decorators/permisos.decorator';
import { Body, Controller, ForbiddenException, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermisosGuard } from '../../auth/guards/permisos.guard';
import { UsuarioActual } from '../../auth/decorators/usuario-actual.decorator';
import { Usuario } from '../../auth/entities/usuario.entity';
import { BitacoraService } from './bitacora.service';
import { ListarBitacoraDto, RegistrarEventoDto } from './dto/bitacora.dto';

@UseGuards(JwtAuthGuard, PermisosGuard)
@Controller('bitacora')
export class BitacoraController {
  constructor(private readonly bitacoraService: BitacoraService) {}

  // Permiso "ver_bitacora": el Superadmin la ve siempre; a cualquier otro
  // perfil se le puede activar desde el portal (Configuración → Perfiles).
  // Son datos sensibles: por eso el permiso viene marcado como "Sensible".
  @Permisos('ver_bitacora')
  @Get()
  async listar(@Query() dto: ListarBitacoraDto, @UsuarioActual() usuario: Usuario) {
    return this.bitacoraService.listar({
      usuarioId: dto.usuarioId,
      accion: dto.accion,
      desde: dto.desde ? new Date(dto.desde) : undefined,
      hasta: dto.hasta ? new Date(dto.hasta) : undefined,
      texto: dto.texto,
      pagina: dto.pagina,
      porPagina: dto.porPagina,
    });
  }

  // Registro de acciones que ocurren enteras en el navegador (ver
  // RegistrarEventoDto) — cualquier persona autenticada, restringido a
  // una lista fija de acciones válidas.
  @Post('evento')
  async registrarEvento(@Body() dto: RegistrarEventoDto, @UsuarioActual() usuario: Usuario, @Req() req: ExpressRequest) {
    await this.bitacoraService.registrar(usuario, req.ip ?? '', dto.accion, dto.descripcion);
    return { ok: true };
  }
}
