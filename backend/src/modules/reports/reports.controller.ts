import { Controller, ForbiddenException, Get, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermisosGuard } from '../../auth/guards/permisos.guard';
import { Permisos } from '../../auth/decorators/permisos.decorator';
import { UsuarioActual } from '../../auth/decorators/usuario-actual.decorator';
import { Usuario } from '../../auth/entities/usuario.entity';
import { ExcelService } from './excel.service';
import { Bitacora } from '../bitacora/decorators/bitacora.decorator';

@UseGuards(JwtAuthGuard, PermisosGuard)
@Controller('reports')
export class ReportsController {
  // Solo los 2 Excel. El Informe y su PDF los arma el navegador de cada
  // persona (Informe interactivo + "Guardar como PDF"); el generador de PDF
  // del servidor (Chrome invisible) y el Informe HTML antiguo se quitaron:
  // ya nadie los usaba y cargaban el servidor gratuito.
  constructor(private readonly excelService: ExcelService) {}

  @Permisos('exportar_excel')
  @Bitacora({ accion: 'excel_descargado', descripcion: () => 'Descargó el Excel "Consolidado por Mes".' })
  @Get('excel/general')
  async excelGeneral(@Res() res: Response, @UsuarioActual() usuario: Usuario) {
    // Igual que en el PMV (TDD, sección 9.6): "Consolidado por Mes" solo
    // tiene sentido con alcance "todos" — se verifica acá, no solo se
    // oculta en la interfaz. Como excepción (mejora post-v2.23) y no como
    // una respuesta 403 armada a mano: así el interceptor de la Bitácora
    // (que solo registra cuando el método termina bien) no lo confunde
    // con una descarga real.
    if (!usuario.esSuperadmin && usuario.alcance !== 'todos') {
      throw new ForbiddenException('El Consolidado por Mes requiere alcance sobre todos los SLEP.');
    }
    const buffer = await this.excelService.construirLibroConsolidadoGeneral();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="GDP-SLEP_Consolidado_por_Mes.xlsx"',
    });
    res.send(buffer);
  }

  @Permisos('exportar_excel')
  @Bitacora({ accion: 'excel_descargado', descripcion: () => 'Descargó el Excel "Consolidado por SLEP".' })
  @Get('excel/por-slep')
  async excelPorSlep(@Res() res: Response, @UsuarioActual() usuario: Usuario) {
    const alcance = usuario.esSuperadmin ? 'todos' : usuario.alcance;
    const buffer = await this.excelService.construirLibroConsolidadoPorSlep(alcance === 'todos' ? undefined : alcance);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="GDP-SLEP_Consolidado_por_SLEP.xlsx"',
    });
    res.send(buffer);
  }
}
