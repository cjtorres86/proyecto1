import { Controller, Post, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UsuarioActual } from './decorators/usuario-actual.decorator';
import { Usuario } from './entities/usuario.entity';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // LocalStrategy ya validó usuario/contraseña antes de llegar acá
  // (AuthGuard('local') corre primero) — este endpoint solo emite el JWT.
  @UseGuards(AuthGuard('local'))
  @Post('login')
  login(@Request() req: { user: Usuario }) {
    return this.authService.login(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me')
  perfilActual(@UsuarioActual() usuario: Usuario) {
    return this.authService.aEtiquetaPublica(usuario);
  }
}
