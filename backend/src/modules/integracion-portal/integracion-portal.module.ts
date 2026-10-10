import { EnvioBitacoraService } from './envio-bitacora.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { Usuario } from '../../auth/entities/usuario.entity';
import { Perfil } from '../../auth/entities/perfil.entity';
import { IntegracionPortalController } from './integracion-portal.controller';
import { IntegracionPortalService } from './integracion-portal.service';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario, Perfil]), AuthModule],
  controllers: [IntegracionPortalController],
  providers: [IntegracionPortalService, EnvioBitacoraService],
})
export class IntegracionPortalModule {}
