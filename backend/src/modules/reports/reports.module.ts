import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ExcelService } from './excel.service';
import { InformeService } from './informe.service';
import { PdfService } from './pdf.service';
import { Contenedor } from '../cases/entities/contenedor.entity';
import { ValorCampo } from '../cases/entities/valor-campo.entity';
import { Slep } from '../forms/entities/slep.entity';
import { FormsModule } from '../forms/forms.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Contenedor, ValorCampo, Slep]), FormsModule, DashboardModule, AuthModule],
  controllers: [ReportsController],
  providers: [ExcelService, InformeService, PdfService],
})
export class ReportsModule {}
