import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

// Equivalente a renderIndicadorAvanceDestacado() del PMV, rediseñado
// como medidor horizontal tipo regla — misma escala de color que el
// ranking de SLEP (colorBarra en ranking.component.ts), para que el
// mismo número se lea con el mismo color en cualquier parte del
// dashboard. Izquierda: el total, alineado igual que los demás
// (donut, CIC, Procedimientos, Sanciones). Derecha: el medidor 0-100.
@Component({
  selector: 'app-advance-indicator',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './advance-indicator.component.html',
})
export class AdvanceIndicatorComponent implements OnChanges {
  @Input() pct: number | null = null;

  // Mismo truco de animación que el resto del dashboard: arranca en 0
  // y sube al frame siguiente para que la transición CSS tenga algo
  // que animar.
  anchoAnimado = 0;

  ngOnChanges(): void {
    this.anchoAnimado = 0;
    requestAnimationFrame(() => {
      this.anchoAnimado = this.pct ?? 0;
    });
  }

  get color(): string {
    if (this.pct === null) return '#D1D5DB';
    if (this.pct >= 75) return '#00E0FF';
    if (this.pct >= 50) return '#16A34A';
    if (this.pct >= 25) return '#D97706';
    return '#DC2626';
  }
}
