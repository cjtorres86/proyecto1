import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TooltipHojaFila {
  etiqueta: string;
  valor: string;
}

// Tooltip compartido de las hojas del Informe (mejora post-v2.23): la
// misma caja, en 2 lugares — el Ranking (al pasar sobre un SLEP: sus
// campos) y el Dashboard (al pasar sobre un total: qué SLEP aportan).
// Solo cambia el título y la lista de filas que recibe.
//
// "absolute", no "fixed": el padre que lo use DEBE tener
// position:relative (todas las hojas del Informe ya lo tienen) — así
// queda pegado al borde IZQUIERDO DE LA HOJA, no de la pantalla, sin
// importar cuán ancha sea la ventana del navegador (hallazgo real de la
// primera versión: con "fixed" quedaba pegado a la pantalla).
@Component({
  selector: 'app-tooltip-hoja',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tooltip-hoja w-[280px] max-h-[85%] overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg p-4 print:hidden">
      <h3 class="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2 mb-2">{{ titulo }}</h3>
      @if (!filas.length) {
        <p class="text-xs text-gray-400">Sin datos.</p>
      } @else {
        <dl class="flex flex-col gap-1">
          @for (f of filas; track f.etiqueta) {
            <div class="flex justify-between gap-2 text-[11px]">
              <dt class="text-gray-500 truncate">{{ f.etiqueta }}</dt>
              <dd class="font-mono text-gray-800 shrink-0">{{ f.valor || '—' }}</dd>
            </div>
          }
        </dl>
      }
    </div>
  `,
  styles: [`
    .tooltip-hoja {
      position: absolute;
      top: 90px;
      right: calc(100% + 20px);
    }
  `],
})
export class TooltipHojaComponent {
  @Input({ required: true }) titulo = '';
  @Input({ required: true }) filas: TooltipHojaFila[] = [];
}
