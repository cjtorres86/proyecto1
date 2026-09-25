import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermisosGuard } from '../../auth/guards/permisos.guard';
import { Permisos } from '../../auth/decorators/permisos.decorator';
import { UsuarioActual } from '../../auth/decorators/usuario-actual.decorator';
import { Usuario } from '../../auth/entities/usuario.entity';
import { ExcelService } from './excel.service';
import { InformeService } from './informe.service';
import { PdfService } from './pdf.service';

@UseGuards(JwtAuthGuard, PermisosGuard)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly excelService: ExcelService,
    private readonly informeService: InformeService,
    private readonly pdfService: PdfService,
  ) {}

  @Permisos('exportar_excel')
  @Get('excel/general')
  async excelGeneral(@Res() res: Response, @UsuarioActual() usuario: Usuario) {
    // Igual que en el PMV (TDD, sección 9.6): "Consolidado General" solo
    // tiene sentido con alcance "todos" — se verifica acá, no solo se
    // oculta en la interfaz.
    if (!usuario.esSuperadmin && usuario.alcance !== 'todos') {
      return res.status(403).json({ message: 'El Consolidado General requiere alcance sobre todos los SLEP.' });
    }
    const buffer = await this.excelService.construirLibroConsolidadoGeneral();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="GDP-SLEP_Consolidado_General.xlsx"',
    });
    res.send(buffer);
  }

  @Permisos('exportar_excel')
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

  @Permisos('exportar_informe')
  @Get('informe')
  async informe(@Query('mes') mes: string, @Query('anio') anio: string, @Res() res: Response, @UsuarioActual() usuario: Usuario) {
    const alcance = usuario.esSuperadmin ? 'todos' : usuario.alcance;
    const html = await this.informeService.construirInformeHTML(mes, anio, alcance);
    res.set({
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="GDP-SLEP_Informe_${mes}_${anio}.html"`,
    });
    res.send(html);
  }

  // PDF real (mejora post-v2.23) — Puppeteer renderiza la misma página
  // Angular de /informe y la captura. Ver PdfService para el detalle
  // del token de corta duración que usa Puppeteer para entrar.
  @Permisos('exportar_informe')
  @Get('informe-pdf')
  async informePdf(
    @Query('mes') mes: string,
    @Query('anio') anio: string,
    @Query('slep') slep: string | undefined,
    @Res() res: Response,
    @UsuarioActual() usuario: Usuario,
  ) {
    const pdf = await this.pdfService.generarPdfInforme(usuario, mes, anio, slep);
    // Fecha y hora de generación en el nombre — útil si el informe se
    // vuelve a generar más de una vez para el mismo mes. Se arma con
    // los componentes de hora LOCAL del servidor (no toISOString, que
    // siempre da UTC y quedaría desfasado varias horas respecto a la
    // hora real de Chile).
    const ahora = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestamp = `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())}_${pad(ahora.getHours())}-${pad(ahora.getMinutes())}`;
    const sufijoSlep = slep ? `_${slep.replace(/\s+/g, '_')}` : '';
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Informe_Avance_de_Sumarios_${mes}_${anio}${sufijoSlep}_${timestamp}.pdf"`,
    });
    res.send(pdf);
  }
}
