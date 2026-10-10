import { CanActivate, ForbiddenException, Injectable } from '@nestjs/common';
import { ingresoSoloPortal } from './identidad';

// Con el ingreso único encendido, las personas se administran SOLO en el
// portal (Configuración → Usuarios y accesos): crear, editar, activar o
// cambiar permisos aquí quedaría desalineado con el portal.
@Injectable()
export class SeAdministraEnPortalGuard implements CanActivate {
  canActivate(): boolean {
    if (ingresoSoloPortal()) {
      throw new ForbiddenException('Las personas se administran en el portal GDP-SLEP Studio: Configuración → Usuarios y accesos.');
    }
    return true;
  }
}
