import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, combineLatest, switchMap, of } from 'rxjs';
import { CaseStateService } from '../../../core/services/case-state.service';
import { DashboardApiService } from '../services/dashboard-api.service';
import { DashboardDeMes } from '../../../core/models/dashboard.model';
import { AdvanceIndicatorComponent } from '../advance-indicator/advance-indicator.component';
import { InitialTotalsDonutComponent } from '../initial-totals-donut/initial-totals-donut.component';
import { TotalAndBarsGroupComponent } from '../total-and-bars-group/total-and-bars-group.component';
import { RankingComponent } from '../ranking/ranking.component';
import { ModeSwitcherComponent } from '../../../shared/mode-switcher/mode-switcher.component';

// Equivalente a _renderDashboard() del PMV — se suscribe al mismo mes
// activo y al mismo SLEP activo que usan los paneles de Cases
// (CaseStateService), sin que ningún módulo "avise" al otro
// directamente. Si hay un SLEP seleccionado, el dashboard se filtra a
// ese SLEP solo (mismo motor de cálculo, otro alcance); si no, muestra
// el consolidado de los 36.
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, AdvanceIndicatorComponent, InitialTotalsDonutComponent, TotalAndBarsGroupComponent, RankingComponent,
    ModeSwitcherComponent,
  ],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit, OnDestroy {
  datos: DashboardDeMes | null = null;
  slepActivo: string | null = null;
  private sub?: Subscription;

  constructor(
    private readonly caseState: CaseStateService,
    private readonly dashboardApi: DashboardApiService,
  ) {}

  ngOnInit(): void {
    this.sub = combineLatest([this.caseState.mesActivo$, this.caseState.contenedorActivo$])
      .pipe(
        switchMap(([mes, contenedor]) => {
          this.slepActivo = contenedor?.slep ?? null;
          return mes ? this.dashboardApi.getDashboard(mes.mes, mes.anio, this.slepActivo ?? undefined) : of(null);
        }),
      )
      .subscribe((datos) => (this.datos = datos));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
