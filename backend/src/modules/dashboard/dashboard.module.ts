import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ConsolidadoService } from './consolidado.service';
import { Contenedor } from '../cases/entities/contenedor.entity';
import { ValorCampo } from '../cases/entities/valor-campo.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Contenedor, ValorCampo])],
  controllers: [DashboardController],
  providers: [DashboardService, ConsolidadoService],
  exports: [DashboardService, ConsolidadoService],
})
export class DashboardModule {}
