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

  // Exclusiva del Superadmin (decisión explícita, no un @Permisos más):
  // son datos sensibles de TODAS las personas del sistema, ni siquiera
  // Admin la ve.
  @Get()
  async listar(@Query() dto: ListarBitacoraDto, @UsuarioActual() usuario: Usuario) {
    if (!usuario.esSuperadmin) throw new ForbiddenException('Solo el Superadmin puede ver la bitácora.');
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
