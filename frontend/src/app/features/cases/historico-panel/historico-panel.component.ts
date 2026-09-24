import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, combineLatest, switchMap, of } from 'rxjs';
import { CaseStateService } from '../../../core/services/case-state.service';
import { CasesApiService } from '../services/cases-api.service';
import { HistoricoSlep } from '../../../core/models/case.model';
import { ModeSwitcherComponent } from '../../../shared/mode-switcher/mode-switcher.component';

// Panel "Ver Histórico" — todos los campos del SLEP activo, mes a mes,
// como una planilla (fila = mes, más reciente arriba; columna = campo).
// Solo hasta el mes activo del panel Meses inclusive, nunca meses
// posteriores. Solo lectura: para editar un valor puntual se sigue
// usando el panel Formulario de ese mes específico.
@Component({
  selector: 'app-historico-panel',
  standalone: true,
  imports: [CommonModule, ModeSwitcherComponent],
  templateUrl: './historico-panel.component.html',
})
export class HistoricoPanelComponent implements OnInit, OnDestroy {
  slep: string | null = null;
  datos: HistoricoSlep | null = null;
  private sub?: Subscription;

  constructor(
    private readonly caseState: CaseStateService,
    private readonly api: CasesApiService,
  ) {}

  ngOnInit(): void {
    this.sub = combineLatest([this.caseState.mesActivo$, this.caseState.contenedorActivo$])
      .pipe(
        switchMap(([mes, contenedor]) => {
          this.slep = contenedor?.slep ?? null;
          this.datos = null;
          return mes && this.slep ? this.api.getHistorico(this.slep, mes.mes, mes.anio) : of(null);
        }),
      )
      .subscribe((datos) => (this.datos = datos));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
