import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';

export interface SerieHistoricoAvance {
  etiqueta: string;
  datos: (number | null)[];
  color: string;
  // Orden de dibujo (mejora post-v2.23): 0 = gris de fondo, 1 = general
  // (siempre coloreada), 2 = el SLEP marcado más reciente (coloreado Y
  // encima de todo, incluido el general). Se dibuja de menor a mayor —
  // ver comentario de clase.
  prioridad: 0 | 1 | 2;
}

// Gráfico de líneas del panel Histórico (mejora post-v2.23). El orden
// de dibujo NO se controla con la opción "order" de Chart.js (su
// semántica exacta no se pudo confirmar sin poder renderizar de
// verdad) — se controla con el ORDEN DEL ARREGLO de series, que es
// inequívoco: Chart.js pinta cada dataset en el orden en que aparece,
// el último pintado queda encima. Por eso "prioridad" (0/1/2) ordena el
// arreglo antes de armar los datasets.
@Component({
  selector: 'app-historico-chart',
  standalone: true,
  imports: [CommonModule, ChartModule],
  template: `<p-chart type="line" [data]="chartData" [options]="chartOptions" [style]="{ height: '780px' }" />`,
})
export class HistoricoChartComponent implements OnChanges {
  @Input() etiquetasMeses: string[] = [];
  @Input() series: SerieHistoricoAvance[] = [];

  chartData: unknown;
  chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'nearest', intersect: false },
    scales: {
      y: { min: 0, max: 100, ticks: { callback: (v: number) => v + '%' } },
    },
    plugins: {
      // Con muchas líneas grises de fondo, una leyenda con 37 nombres
      // sería más ruido que ayuda — el tooltip al pasar el mouse (con
      // el nombre de cada serie) ya identifica cuál es cuál.
      legend: { display: false },
      tooltip: { mode: 'nearest', intersect: false },
    },
  };

  ngOnChanges(): void {
    // Menor prioridad primero (queda al fondo), mayor prioridad al
    // final (queda encima) — orden estable, no reordena entre iguales.
    const enOrdenDeDibujo = [...this.series].sort((a, b) => a.prioridad - b.prioridad);

    this.chartData = {
      labels: this.etiquetasMeses,
      datasets: enOrdenDeDibujo.map((s) => ({
        label: s.etiqueta,
        data: s.datos,
        borderColor: s.color,
        backgroundColor: s.color,
        borderWidth: s.prioridad === 2 ? 3 : s.prioridad === 1 ? 2.5 : 1.5,
        pointRadius: s.prioridad > 0 ? 3 : 0,
        pointHoverRadius: 4,
        tension: 0.3,
        spanGaps: true,
      })),
    };
  }
}
