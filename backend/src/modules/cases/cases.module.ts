import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';
import { ValidacionService } from './validacion.service';
import { ImportacionService } from './importacion.service';
import { Contenedor } from './entities/contenedor.entity';
import { ValorCampo } from './entities/valor-campo.entity';
import { FormularioPregunta } from '../forms/entities/formulario-pregunta.entity';
import { Pregunta } from '../forms/entities/pregunta.entity';
import { Slep } from '../forms/entities/slep.entity';
import { DashboardModule } from '../dashboard/dashboard.module';

@Module({
  imports: [TypeOrmModule.forFeature([Contenedor, ValorCampo, FormularioPregunta, Pregunta, Slep]), DashboardModule],
  controllers: [CasesController],
  providers: [CasesService, ValidacionService, ImportacionService],
  exports: [CasesService, ValidacionService],
})
export class CasesModule {}
