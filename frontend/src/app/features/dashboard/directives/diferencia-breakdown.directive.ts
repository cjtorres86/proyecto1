import { Directive, Input } from '@angular/core';
import { switchMap, take, of } from 'rxjs';
import { CaseStateService } from '../../../core/services/case-state.service';
import { DashboardApiService } from '../services/dashboard-api.service';

// Hermana de SlepBreakdownDirective, pero para las 3 "Diferencia: ±N"
// del dashboard (mejora post-v2.23) en vez de un campo puntual — recibe
// un tipo ('investigar' | 'cic' | 'sanciones', ver
// DashboardService.FORMULAS_DIFERENCIA en el backend) y muestra qué
// SLEP están produciendo esa diferencia y cuánto aporta cada uno. Mismo
// principio de carga: una sola vez por tipo, al primer hover.
//
// Uso en una plantilla:
//   <div [appDiferenciaBreakdown]="'investigar'" #tip="appDiferenciaBreakdown"
//        [pTooltip]="tip.texto" [escape]="false" tooltipStyleClass="text-xs">
//     ...contenido normal...
//   </div>
@Directive({
  selector: '[appDiferenciaBreakdown]',
  standalone: true,
  exportAs: 'appDiferenciaBreakdown',
  host: { '(mouseenter)': 'cargar()' },
})
export class DiferenciaBreakdownDirective {
  @Input('appDiferenciaBreakdown') tipo!: string;

  texto = 'Cargando…';
  private cargado = false;

  constructor(
    private readonly caseState: CaseStateService,
    private readonly api: DashboardApiService,
  ) {}

  cargar(): void {
    if (this.cargado) return;
    this.cargado = true;
    this.caseState.mesActivo$
      .pipe(
        take(1),
        switchMap((mes) => (mes ? this.api.getDesgloseDiferencia(mes.mes, mes.anio, this.tipo) : of([]))),
      )
      .subscribe((filas) => {
        this.texto = filas.length
          ? filas.map((f) => `${f.slep}: ${f.diferencia > 0 ? '+' + f.diferencia : f.diferencia}`).join('<br>')
          : 'Sin diferencias en ningún SLEP';
      });
  }
}
