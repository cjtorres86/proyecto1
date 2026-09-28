import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ExcelService } from './excel.service';
import { Contenedor } from '../cases/entities/contenedor.entity';
import { ValorCampo } from '../cases/entities/valor-campo.entity';
import { Slep } from '../forms/entities/slep.entity';
import { FormsModule } from '../forms/forms.module';

@Module({
  imports: [TypeOrmModule.forFeature([Contenedor, ValorCampo, Slep]), FormsModule],
  controllers: [ReportsController],
  providers: [ExcelService],
})
export class ReportsModule {}
