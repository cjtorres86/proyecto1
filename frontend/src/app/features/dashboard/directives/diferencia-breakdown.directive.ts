import { Directive, Input } from '@angular/core';
import { combineLatest, switchMap, take, of } from 'rxjs';
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
//
// Con un SLEP puntual activo (mejora post-v2.23, hallazgo real): igual
// que SlepBreakdownDirective — no tiene sentido preguntar "qué SLEP
// aportan" si ya se está viendo un solo SLEP.
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
    combineLatest([this.caseState.mesActivo$, this.caseState.slepActivo$])
      .pipe(
        take(1),
        switchMap(([mes, slep]) => {
          if (!mes || slep) return of(null);
          return this.api.getDesgloseDiferencia(mes.mes, mes.anio, this.tipo);
        }),
      )
      .subscribe((filas) => {
        if (filas === null) {
          this.texto = '';
          return;
        }
        this.texto = filas.length
          ? filas.map((f) => `${f.slep}: ${f.diferencia > 0 ? '+' + f.diferencia : f.diferencia}`).join('<br>')
          : 'Sin diferencias en ningún SLEP';
      });
  }
}
