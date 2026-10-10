import { ingresoSoloPortal } from '../../modules/integracion-portal/identidad';
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
    // Con el ingreso único encendido (INGRESO_SOLO_PORTAL=true), entrar con
    // usuario y clave aquí queda solo como acceso de emergencia del Superadmin.
    if (ingresoSoloPortal() && !usuarioValidado.esSuperadmin) {
      throw new UnauthorizedException('El ingreso a Avance de Sumarios es desde el portal GDP-SLEP Studio.');
    }
    return usuarioValidado;
  }
}
