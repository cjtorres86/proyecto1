import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TooltipModule } from 'primeng/tooltip';
import { Metricas } from '../../../core/models/dashboard.model';
import { SlepBreakdownDirective } from '../directives/slep-breakdown.directive';

// Equivalente a renderTotalesInicialesConDonut() del PMV — mismos 3
// números destacados (Casos CGR, Licencias incumplidas, Funcionarios) y
// el donut Continúan/Ya no están. El donut se dibuja en SVG a mano (dos
// <circle> con stroke-dasharray), NO con Chart.js/canvas (mejora
// post-v2.23, hallazgo real): un canvas puede capturarse "a medio
// dibujar" al generar el PDF con Puppeteer, y además pelea con el CSS
// del contenedor en cada pasada de layout — problema conocido y bien
// documentado de mezclar canvas con captura headless. Un SVG se pinta
// de inmediato, siempre nítido a cualquier resolución, y anima igual de
// bien con una simple transición CSS — mismo mecanismo que ya usan las
// barras horizontales del resto del dashboard.
@Component({
  selector: 'app-initial-totals-donut',
  standalone: true,
  imports: [CommonModule, TooltipModule, SlepBreakdownDirective],
  templateUrl: './initial-totals-donut.component.html',
})
export class InitialTotalsDonutComponent implements OnChanges {
  @Input() metricas: Metricas | null = null;

  readonly radio = 80;
  readonly grosor = 24;
  readonly circunferencia = 2 * Math.PI * this.radio;

  dasharrayAnimado = `0 ${this.circunferencia}`;

  ngOnChanges(): void {
    if (!this.metricas) return;
    const total = this.metricas.continuanServicio + this.metricas.yaNoEstan;
    const pctContinuan = total > 0 ? (this.metricas.continuanServicio / total) * 100 : 0;

    // Mismo truco de animación que las barras: arranca en 0 y sube al
    // frame siguiente, para que la transición CSS tenga un antes y un
    // después que animar (el "se va llenando solo" de siempre).
    this.dasharrayAnimado = `0 ${this.circunferencia}`;
    requestAnimationFrame(() => {
      const largoArco = (pctContinuan / 100) * this.circunferencia;
      this.dasharrayAnimado = `${largoArco} ${this.circunferencia}`;
    });
  }
}
