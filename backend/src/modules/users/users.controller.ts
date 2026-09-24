import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermisosGuard } from '../../auth/guards/permisos.guard';
import { Permisos } from '../../auth/decorators/permisos.decorator';
import { UsuarioActual } from '../../auth/decorators/usuario-actual.decorator';
import { Usuario } from '../../auth/entities/usuario.entity';
import { UsersService } from './users.service';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { CrearPerfilDto } from './dto/crear-perfil.dto';

@UseGuards(JwtAuthGuard, PermisosGuard)
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Permisos('gestionar_usuarios')
  @Get('users')
  listarUsuarios() {
    return this.usersService.listarUsuarios();
  }

  @Permisos('gestionar_usuarios')
  @Post('users')
  crearUsuario(@Body() dto: CrearUsuarioDto) {
    return this.usersService.crearUsuario(dto);
  }

  @Permisos('gestionar_usuarios')
  @Patch('users/:id')
  actualizarUsuario(@Param('id') id: string, @Body() dto: ActualizarUsuarioDto) {
    return this.usersService.actualizarUsuario(id, dto);
  }

  // Perfiles: listar es seguro para cualquier autenticado (se necesita
  // para elegir perfil al crear un usuario); crear uno nuevo es
  // exclusivo del superadmin (TDD, sección 11.2.1) — "gestionar_perfiles"
  // nunca es una casilla asignable, se verifica por esSuperadmin directo.
  @Get('perfiles')
  listarPerfiles() {
    return this.usersService.listarPerfiles();
  }

  @Post('perfiles')
  crearPerfil(@Body() dto: CrearPerfilDto, @UsuarioActual() usuario: Usuario) {
    if (!usuario.esSuperadmin) {
      throw new ForbiddenException('Solo el superadmin puede crear perfiles nuevos.');
    }
    return this.usersService.crearPerfil(dto);
  }
}
