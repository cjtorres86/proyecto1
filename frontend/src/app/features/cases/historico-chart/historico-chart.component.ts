import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';

export interface SerieHistoricoAvance {
  etiqueta: string;
  datos: (number | null)[];
  color: string;
  // Qué tan adelante se dibuja: 0 = SLEP gris (al fondo), 1 = General,
  // 2 = el SLEP marcado más reciente (adelante de todo, incluida la
  // General). Se traduce a la opción "order" de Chart.js — ver
  // comentario de clase.
  prioridad: 0 | 1 | 2;
}

// Gráfico de líneas del panel Histórico (mejora post-v2.23).
//
// Orden de dibujo (hallazgo real, verificado en el código fuente de
// Chart.js): antes de dibujar, Chart.js ordena las líneas de MENOR a
// MAYOR "order" (a igual order, por posición en el arreglo) y después
// las dibuja AL REVÉS — _drawDatasets() recorre desde la última hacia la
// primera. Por lo tanto la línea con el "order" MÁS BAJO es la última en
// pintarse y queda ENCIMA de todas. (La versión anterior asumía lo
// contrario y ponía la destacada al final del arreglo: quedaba al fondo,
// tapada por las grises.) Se usa "order" explícito en vez de depender de
// la posición en el arreglo.
@Component({
  selector: 'app-historico-chart',
  standalone: true,
  imports: [CommonModule, ChartModule],
  // El alto llega desde HistoricoPanelComponent, que lo calcula según el
  // espacio realmente visible del panel (ver recalcularAltoGrafico). p-chart
  // lo aplica al contenedor del canvas y Chart.js (responsive) se redibuja
  // solo cuando ese contenedor cambia de tamaño — verificado en el código
  // fuente de PrimeNG (UIChart enlaza [style.height] al div del canvas).
  template: `<p-chart type="line" [data]="chartData" [options]="chartOptions" [height]="alto + 'px'" />`,
})
export class HistoricoChartComponent implements OnChanges {
  @Input() etiquetasMeses: string[] = [];
  @Input() series: SerieHistoricoAvance[] = [];
  @Input() alto = 780;

  chartData: unknown;
  chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'nearest', intersect: false },
    // Espacio abajo (mejora post-v2.23): sin esto, una línea en 0%
    // quedaba pegada al borde inferior del área del gráfico —a veces
    // literalmente tapada por el eje— y las etiquetas de los meses se
    // veían apretadas contra las líneas. min en -4 (en vez de 0) le da
    // a un valor real de 0% un pelo de aire debajo antes de tocar el
    // borde; el padding agrega separación extra hacia las etiquetas.
    layout: { padding: { bottom: 8 } },
    scales: {
      y: {
        min: -4,
        max: 100,
        ticks: { callback: (v: number) => (v < 0 ? '' : v + '%') },
        // grid.borderDash: verificado contra el código fuente real de
        // Chart.js (drawGrid() lee style.borderDash al trazar cada
        // línea) — aunque no aparece en la interfaz de TypeScript que
        // se revisó, el motor de dibujo sí lo usa.
        grid: { borderDash: [4, 4] },
      },
      x: {
        grid: { borderDash: [4, 4] },
      },
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
    this.chartData = {
      labels: this.etiquetasMeses,
      datasets: this.series.map((s) => ({
        label: s.etiqueta,
        // order más bajo = dibujado al final = encima (ver comentario de
        // clase): destacado 0, General 1, SLEP grises 2.
        order: 2 - s.prioridad,
        data: s.datos,
        borderColor: s.color,
        backgroundColor: s.color,
        borderWidth: s.prioridad === 2 ? 3 : s.prioridad === 1 ? 2.5 : 1.5,
        // Punto en cada mes, en todas las líneas por igual — antes solo
        // las coloreadas tenían punto, las grises no; se ven más
        // parejas así. tension muy baja (casi 0): tramos rectos entre
        // un mes y el siguiente, sin la curva suavizada de Chart.js —
        // así se nota mejor cada subida/bajada real, sin que la curva
        // "redondee" el cambio.
        pointRadius: 3,
        pointHoverRadius: 4,
        tension: 0.05,
        spanGaps: true,
      })),
    };
  }
}
