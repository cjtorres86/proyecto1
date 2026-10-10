import { Body, Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { AuthService } from '../../auth/auth.service';
import { Bitacora } from '../bitacora/decorators/bitacora.decorator';
import { IdentidadPortal, PerfilPortal } from './identidad';
import { IntegracionPortalService } from './integracion-portal.service';

class IngresoSsoDto {
  @IsString() @IsNotEmpty() @MaxLength(200)
  pase: string;
}

@Controller()
export class IntegracionPortalController {
  constructor(
    private readonly servicio: IntegracionPortalService,
    private readonly auth: AuthService,
  ) {}

  // El navegador llega desde el portal con un pase de un solo uso: Sumarios
  // lo canjea con el portal y abre la sesión, sin pedir clave.
  @Bitacora({ accion: 'sesion_iniciada', descripcion: () => 'Inició sesión desde el portal GDP-SLEP Studio.' })
  @Post('auth/sso')
  @HttpCode(200)
  async ingresarDesdePortal(@Body() dto: IngresoSsoDto, @Req() req: { user?: unknown }) {
    const usuario = await this.servicio.ingresarConPase(dto.pase);
    req.user = usuario; // para que la Bitácora registre quién entró
    return this.auth.login(usuario);
  }

  // Aviso del portal: una persona cambió o se desactivó. Llega de servidor a
  // servidor, con la clave secreta compartida.
  @Post('integracion/personas')
  @HttpCode(200)
  async recibirCambio(@Headers('x-clave-portal') clave: string | undefined, @Body() identidad: IdentidadPortal) {
    this.servicio.verificarClavePortal(clave);
    const u = await this.servicio.sincronizar(identidad);
    return { ok: true, activo: u?.activo ?? false };
  }

  // Aviso del portal: cambió la lista de perfiles (Configuración → Perfiles).
  @Post('integracion/perfiles')
  @HttpCode(200)
  async recibirPerfiles(@Headers('x-clave-portal') clave: string | undefined, @Body() cuerpo: { perfiles: PerfilPortal[] }) {
    this.servicio.verificarClavePortal(clave);
    return this.servicio.sincronizarPerfiles(cuerpo?.perfiles ?? []);
  }
}
