import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

// Equivalente a renderRankingBars() del PMV — barra por SLEP, coloreada
// por umbral (misma escala que el resto del Dashboard). Un solo
// componente con 2 modos (mejora post-v2.23) — antes eran 2 archivos
// separados (uno para el panel del Dashboard, otro hecho a mano en el
// Informe Interactivo), y cualquier cambio había que hacerlo 2 veces.
// Ahora es uno solo: cualquier mejora futura se hereda sola en el
// Dashboard, el Informe y el PDF, sin excepción.
//
// [modoCompacto]="false" (default): 2 líneas por SLEP, para el panel
// angosto del Dashboard.
// [modoCompacto]="true": 1 línea por SLEP, mucho más compacta — la usa
// el Informe/PDF para que las 36 entren en una sola hoja carta.
@Component({
  selector: 'app-ranking',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ranking.component.html',
})
export class RankingComponent implements OnChanges {
  @Input({ required: true }) ranking!: { slep: string; pct: number | null }[];
  @Input() modoCompacto = false;

  // Mismo truco de animación que en total-and-bars-group.component.ts:
  // arranca en 0 y sube al frame siguiente para que la transición CSS
  // tenga algo que animar.
  anchosAnimados: number[] = [];

  ngOnChanges(): void {
    this.anchosAnimados = (this.ranking ?? []).map(() => 0);
    requestAnimationFrame(() => {
      this.anchosAnimados = (this.ranking ?? []).map((r) => r.pct ?? 0);
    });
  }

  colorBarra(pct: number | null): string {
    if (pct === null) return '#D1D5DB';
    if (pct >= 75) return '#00E0FF';
    if (pct >= 50) return '#16A34A';
    if (pct >= 25) return '#D97706';
    return '#DC2626';
  }
}
