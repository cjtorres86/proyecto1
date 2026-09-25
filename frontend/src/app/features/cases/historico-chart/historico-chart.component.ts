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
  template: `<p-chart type="line" [data]="chartData" [options]="chartOptions" height="780px" />`,
})
export class HistoricoChartComponent implements OnChanges {
  @Input() etiquetasMeses: string[] = [];
  @Input() series: SerieHistoricoAvance[] = [];

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
