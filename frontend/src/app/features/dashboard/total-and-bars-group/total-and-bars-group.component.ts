import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TooltipModule } from 'primeng/tooltip';
import { SerieItem } from '../../../core/models/dashboard.model';
import { SlepBreakdownDirective } from '../directives/slep-breakdown.directive';
import { DiferenciaBreakdownDirective } from '../directives/diferencia-breakdown.directive';

// Equivalente a renderGrupoTotalYBarras() del PMV — un total destacado
// más una lista de barras horizontales con su %. Un solo componente
// reutilizable para los 3 grupos (CIC, Procedimientos, Sanciones) —
// nunca 3 implementaciones separadas y casi iguales.
@Component({
  selector: 'app-total-and-bars-group',
  standalone: true,
  imports: [CommonModule, TooltipModule, SlepBreakdownDirective, DiferenciaBreakdownDirective],
  templateUrl: './total-and-bars-group.component.html',
})
export class TotalAndBarsGroupComponent implements OnChanges {
  @Input({ required: true }) titulo!: string;
  @Input({ required: true }) totalLabel!: string;
  @Input({ required: true }) totalFieldId!: string;
  @Input({ required: true }) total!: number;
  @Input() diferencia?: number;
  @Input() tipoDiferencia?: string;
  @Input({ required: true }) series!: SerieItem[];
  // Mismo mecanismo que InitialTotalsDonutComponent — ver ahí el porqué.
  // Solo para el TOTAL (no las barras individuales ni la diferencia): es
  // lo que se pidió para el Informe.
  @Input() suprimirTooltipPropio = false;
  @Output() sobreCampo = new EventEmitter<string | null>();

  // Arranca cada barra en 0 y, un instante después (un frame), la sube
  // a su porcentaje real — así la transición CSS de "width" tiene un
  // antes y un después que animar, igual que el efecto del donut. Se
  // repite cada vez que cambian los datos (ej. al cambiar de mes).
  anchosAnimados: number[] = [];

  ngOnChanges(): void {
    this.anchosAnimados = (this.series ?? []).map(() => 0);
    requestAnimationFrame(() => {
      this.anchosAnimados = (this.series ?? []).map((s) => s.pct ?? 0);
    });
  }
}
