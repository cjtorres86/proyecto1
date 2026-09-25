import { Directive, Input } from '@angular/core';
import { combineLatest, switchMap, take, of } from 'rxjs';
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
//
// Con un SLEP puntual activo (mejora post-v2.23, hallazgo real): "qué
// SLEP aportan a este número" no tiene sentido si ya se está viendo un
// solo SLEP — siempre sería él mismo, nadie más. En ese caso ni
// siquiera se pide el dato al backend (texto queda vacío, pTooltip no
// muestra nada) — solo en el consolidado de los 36 vale la pena.
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
    combineLatest([this.caseState.mesActivo$, this.caseState.slepActivo$])
      .pipe(
        take(1),
        switchMap(([mes, slep]) => {
          // Sin mes, o con un SLEP puntual activo: no aplica (null =
          // "no corresponde", distinto de [] = "se consultó y no hay
          // datos" — ese caso sigue mostrando su mensaje normal).
          if (!mes || slep) return of(null);
          return this.api.getDesglose(mes.mes, mes.anio, this.preguntaId);
        }),
      )
      .subscribe((filas) => {
        if (filas === null) {
          this.texto = '';
          return;
        }
        this.texto = filas.length ? filas.map((f) => `${f.slep}: ${f.valor}`).join('<br>') : 'Sin datos por SLEP';
      });
  }
}
