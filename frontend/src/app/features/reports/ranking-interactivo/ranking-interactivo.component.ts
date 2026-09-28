import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { ReportsApiService, RankingDetalleFila } from '../services/reports-api.service';

// Ranking Interactivo (mejora post-v2.23): solo el ranking, con un
// panorama completo de cada SLEP al pasar el mouse — sus 37 campos con
// su valor, sin tener que abrir el formulario de cada uno por separado.
// Ruta propia, no una hoja más del Informe: a diferencia de éste, no es
// para imprimir (los tooltips no existen en un PDF), así que no fuerza
// modo claro ni tiene la lógica de ajuste-a-hoja-carta — respeta el
// tema (claro/oscuro) que ya tenga la persona, como el resto del sistema.
@Component({
  selector: 'app-ranking-interactivo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ranking-interactivo.component.html',
})
export class RankingInteractivoComponent implements OnInit {
  mes = '';
  anio = '';
  slep: string | null = null;
  ranking: RankingDetalleFila[] = [];
  cargando = true;

  // El SLEP sobre el que está el mouse ahora mismo — su tooltip aparece
  // fijo en el margen izquierdo de la hoja (pedido explícito), no
  // pegado al cursor, para que nunca tape la fila que se está mirando.
  slepConMouseEncima: RankingDetalleFila | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly reportsApi: ReportsApiService,
    private readonly titleService: Title,
  ) {}

  ngOnInit(): void {
    this.mes = this.route.snapshot.paramMap.get('mes') ?? '';
    this.anio = this.route.snapshot.paramMap.get('anio') ?? '';
    this.slep = this.route.snapshot.queryParamMap.get('slep');
    this.titleService.setTitle(`Ranking Interactivo - ${this.mes} ${this.anio}`);
    this.reportsApi.getRankingDetalle(this.mes, this.anio, this.slep ?? undefined).subscribe((lista) => {
      this.ranking = lista;
      this.cargando = false;
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
