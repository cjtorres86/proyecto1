import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { Subscription, switchMap, of } from 'rxjs';
import { CaseStateService } from '../../../core/services/case-state.service';
import { ReportsApiService } from '../services/reports-api.service';

interface ErrorFila { slep: string; campo: string; mensaje: string }

// Informe de errores (TDD, sección 9.5) — tabla con muchas filas
// potenciales, ordenable/filtrable: PrimeNG p-table, no Material
// (sección 13.9).
@Component({
  selector: 'app-error-report-table',
  standalone: true,
  imports: [CommonModule, TableModule],
  templateUrl: './error-report-table.component.html',
})
export class ErrorReportTableComponent implements OnInit, OnDestroy {
  errores: ErrorFila[] = [];
  private sub?: Subscription;

  constructor(
    private readonly caseState: CaseStateService,
    private readonly reportsApi: ReportsApiService,
  ) {}

  ngOnInit(): void {
    this.sub = this.caseState.mesActivo$
      .pipe(switchMap((mes) => (mes ? this.reportsApi.listarErrores(mes.mes, mes.anio) : of([]))))
      .subscribe((lista) => (this.errores = lista));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
