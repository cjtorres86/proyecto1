import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'usuario', passwordField: 'contrasena' });
  }

  async validate(usuario: string, contrasena: string) {
    const usuarioValidado = await this.authService.validarCredenciales(usuario, contrasena);
    if (!usuarioValidado) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos.');
    }
    return usuarioValidado;
  }
}
