import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';

export interface JwtPayload {
  sub: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly authService: AuthService,
    config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const usuario = await this.authService.buscarPorId(payload.sub);
    // Cuenta desactivada = sesión rechazada en su siguiente petición, aunque
    // el token siga vigente (hallazgo de la etapa 2: antes solo se impedía
    // volver a entrar, pero una sesión abierta seguía funcionando).
    if (!usuario || !usuario.activo) return null;
    return usuario;
  }
}
