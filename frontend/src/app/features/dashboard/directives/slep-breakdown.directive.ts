import { Directive, Input } from '@angular/core';
import { switchMap, take, of } from 'rxjs';
import { CaseStateService } from '../../../core/services/case-state.service';
import { DashboardApiService } from '../services/dashboard-api.service';

// Directiva reutilizable para las tooltips del dashboard. Junto con
// pTooltip (PrimeNG, ya instalado) arma "SLEP: valor" de cualquier
// número o barra — solo hace falta pasarle el pregunta_id del campo
// (s.id, ya disponible en cada SerieItem). No introduce ningún elemento
// nuevo en el DOM (a diferencia de un componente envolvente), así que
// nunca rompe un layout flex/grid existente.
//
// Para agregar esta tooltip a un número nuevo en el futuro, se copian
// estas 3 líneas en la plantilla, con su propio pregunta_id:
//
//   <div [appSlepBreakdown]="unId" #tip="appSlepBreakdown"
//        [pTooltip]="tip.texto" [escape]="false" tooltipStyleClass="text-xs">
//     ...contenido normal, sin cambios...
//   </div>
//
// La consulta al backend se dispara una sola vez por campo (al primer
// mouseenter) y el resultado queda en memoria mientras la directiva
// viva — pasar el mouse de nuevo no vuelve a pedir nada.
@Directive({
  selector: '[appSlepBreakdown]',
  standalone: true,
  exportAs: 'appSlepBreakdown',
  host: { '(mouseenter)': 'cargar()' },
})
export class SlepBreakdownDirective {
  @Input('appSlepBreakdown') preguntaId!: string;

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
        switchMap((mes) => (mes ? this.api.getDesglose(mes.mes, mes.anio, this.preguntaId) : of([]))),
      )
      .subscribe((filas) => {
        this.texto = filas.length ? filas.map((f) => `${f.slep}: ${f.valor}`).join('<br>') : 'Sin datos por SLEP';
      });
  }
}
