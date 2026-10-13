import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RankingDetalleFila } from '../services/reports-api.service';
import { TooltipHojaComponent, TooltipHojaFila } from '../tooltip-hoja/tooltip-hoja.component';

// Ranking con tooltip de detalle (mejora post-v2.23): un solo componente,
// usado en las 2 hojas que necesitan el ranking dentro del Informe — la
// hoja "Ranking Interactivo" (sola) y la hoja del Dashboard del Informe
// General (antes usaba <app-ranking>, sin tooltip). Al pasar el mouse
// sobre un SLEP aparece el detalle de sus campos, pegado al borde
// izquierdo de la hoja (ver TooltipHojaComponent). El PDF muestra la
// misma tabla sin la interacción — un PDF no reacciona al mouse.
@Component({
  selector: 'app-ranking-con-detalle',
  standalone: true,
  imports: [CommonModule, TooltipHojaComponent],
  template: `
    <div class="flex flex-col">
      @for (fila of ranking; track fila.slep; let i = $index) {
        <div
          class="flex items-center gap-3 py-1 border-b border-gray-100 text-[11px]"
          [class.bg-blue-50]="slepConMouseEncima === fila"
          [attr.data-fila]="i"
          (mouseenter)="slepConMouseEncima = fila"
          (mouseleave)="slepConMouseEncima = null"
        >
          <span class="w-6 text-gray-400">{{ i + 1 }}</span>
          <span class="w-40 truncate" [title]="fila.slep">{{ fila.slep }}</span>
          <div class="flex-1 bg-gray-100 rounded h-2.5 overflow-hidden">
            <!-- Color por nivel en CSS (styles.scss, .barra-avance): así hay
                 versión clara y versión oscura neón, también en el .html guardado. -->
            <div class="barra-avance h-full" [style.width.%]="fila.pct ?? 0" [attr.data-nivel]="nivelBarra(fila.pct)"></div>
          </div>
          <span class="w-10 text-right font-mono text-gray-500">{{ fila.pct === null ? '—' : fila.pct + '%' }}</span>
        </div>
      }
    </div>
    @if (slepConMouseEncima; as s) {
      <app-tooltip-hoja [titulo]="s.slep" [filas]="filasDe(s)" />
    }
  `,
})
export class RankingConDetalleComponent implements OnChanges {
  @Input({ required: true }) ranking: RankingDetalleFila[] = [];

  slepConMouseEncima: RankingDetalleFila | null = null;

  // Si el Informe pide datos nuevos (por ejemplo, al cambiar de SLEP
  // desde InformeComponent) mientras alguien tenía el mouse sobre una
  // fila, este objeto ya no pertenece a la lista nueva — sin esto, el
  // tooltip seguiría mostrando el SLEP anterior con sus datos viejos.
  ngOnChanges(): void {
    this.slepConMouseEncima = null;
  }

  filasDe(fila: RankingDetalleFila): TooltipHojaFila[] {
    return fila.campos.map((c) => ({ etiqueta: `${c.numero}. ${c.nombre}`, valor: c.valor }));
  }

  // Mismos cortes de siempre: ≥75 % alto, ≥50 % medio-alto, ≥25 % medio, menos, bajo.
  nivelBarra(pct: number | null): string {
    if (pct === null) return 'na';
    if (pct >= 75) return 'alto';
    if (pct >= 50) return 'medio-alto';
    if (pct >= 25) return 'medio';
    return 'bajo';
  }
}
