import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UsuarioActual } from '../../auth/decorators/usuario-actual.decorator';
import { Usuario } from '../../auth/entities/usuario.entity';
import { DashboardService } from './dashboard.service';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getDashboard(
    @Query('mes') mes: string,
    @Query('anio') anio: string,
    @Query('slep') slep: string | undefined,
    @UsuarioActual() usuario: Usuario,
  ) {
    return this.dashboardService.getDashboardDeMes(mes, anio, this.resolverAlcance(usuario, slep));
  }

  @Get('ranking')
  async getRanking(@Query('mes') mes: string, @Query('anio') anio: string, @UsuarioActual() usuario: Usuario) {
    const alcance = usuario.esSuperadmin ? 'todos' : usuario.alcance;
    return this.dashboardService.getRankingSeries(mes, anio, alcance);
  }

  @Get('desglose')
  async getDesglose(
    @Query('mes') mes: string,
    @Query('anio') anio: string,
    @Query('campo') campo: string,
    @UsuarioActual() usuario: Usuario,
  ) {
    const alcance = usuario.esSuperadmin ? 'todos' : usuario.alcance;
    return this.dashboardService.getDesgloseCampo(mes, anio, alcance, campo);
  }

  @Get('desglose-diferencia')
  async getDesgloseDiferencia(
    @Query('mes') mes: string,
    @Query('anio') anio: string,
    @Query('tipo') tipo: string,
    @UsuarioActual() usuario: Usuario,
  ) {
    const alcance = usuario.esSuperadmin ? 'todos' : usuario.alcance;
    return this.dashboardService.getDesgloseDiferencia(mes, anio, alcance, tipo);
  }

  // Dashboard por SLEP puntual: un usuario con alcance 'todos'
  // (superadmin, Admin, Validador) puede pedir cualquier SLEP para
  // navegar su vista, o 'todos'. Un usuario con alcance fijo a un solo
  // SLEP (Digitador) nunca puede ver otro — esto no depende de lo que
  // llegue en la query, es un límite fijo del lado del servidor.
  private resolverAlcance(usuario: Usuario, slepPedido?: string): string {
    if (usuario.alcance !== 'todos') return usuario.alcance;
    return slepPedido && slepPedido !== 'todos' ? slepPedido : 'todos';
  }
}
