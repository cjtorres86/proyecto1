import { Controller, Get, Post, UseGuards, Request } from '@nestjs/common';
import { ingresoSoloPortal } from '../modules/integracion-portal/identidad';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UsuarioActual } from './decorators/usuario-actual.decorator';
import { Usuario } from './entities/usuario.entity';
import { Bitacora } from '../modules/bitacora/decorators/bitacora.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // LocalStrategy ya validó usuario/contraseña antes de llegar acá
  // (AuthGuard('local') corre primero) — este endpoint solo emite el JWT.
  @UseGuards(AuthGuard('local'))
  @Bitacora({ accion: 'sesion_iniciada', descripcion: () => 'Inició sesión.' })
  @Post('login')
  login(@Request() req: { user: Usuario }) {
    return this.authService.login(req.user);
  }

  // ¿Sumarios está integrado al portal (INGRESO_SOLO_PORTAL=true) o funciona
  // independiente? La pantalla lo usa para sus avisos y para saber si las
  // personas se pueden editar aquí. No es un dato sensible: no exige sesión.
  @Get('modo')
  modo() {
    return { integrado: ingresoSoloPortal() };
  }

  @UseGuards(JwtAuthGuard)
  @Post('me')
  perfilActual(@UsuarioActual() usuario: Usuario) {
    return this.authService.aEtiquetaPublica(usuario);
  }

  // Cerrar sesión (mejora post-v2.23, Bitácora): con JWT no existe un
  // "cierre" real del lado del servidor (el navegador simplemente deja
  // de usar el token) — este endpoint no hace nada más que dejar
  // constancia de la acción antes de que el frontend borre el token.
  @UseGuards(JwtAuthGuard)
  @Bitacora({ accion: 'sesion_cerrada', descripcion: () => 'Cerró sesión.' })
  @Post('logout')
  logout() {
    return { ok: true };
  }
}
