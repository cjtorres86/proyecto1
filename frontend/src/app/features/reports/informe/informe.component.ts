import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { DashboardApiService } from '../../dashboard/services/dashboard-api.service';
import { DashboardDeMes } from '../../../core/models/dashboard.model';
import { AdvanceIndicatorComponent } from '../../dashboard/advance-indicator/advance-indicator.component';
import { InitialTotalsDonutComponent } from '../../dashboard/initial-totals-donut/initial-totals-donut.component';
import { TotalAndBarsGroupComponent } from '../../dashboard/total-and-bars-group/total-and-bars-group.component';
import { RankingComponent } from '../../dashboard/ranking/ranking.component';

// Informe Interactivo: página real de Angular que reutiliza los mismos
// componentes del Dashboard. El PDF es esta misma página capturada por
// Puppeteer en el servidor.
//
// Hojas y ajuste a carta (Letter): cada hoja impresa tiene un alto fijo
// MENOR que el área imprimible de la página, con corte de página, así que
// desbordar a otra hoja es imposible por construcción. El contenido tiene
// un ancho fijo en px (idéntico en pantalla e impresión), por lo que se
// acomoda igual en ambos casos y su altura medida es la real. Al imprimir
// se aplica un zoom UNIFORME (mismo factor a lo ancho y a lo alto, nunca
// deforma) y el espacio vertical sobrante se reparte entre las secciones.
// Para agregar una hoja nueva basta copiar el patrón de div con
// #contenidoHoja; el cálculo la incluye sola.
@Component({
  selector: 'app-informe',
  standalone: true,
  imports: [CommonModule, AdvanceIndicatorComponent, InitialTotalsDonutComponent, TotalAndBarsGroupComponent, RankingComponent],
  templateUrl: './informe.component.html',
  styles: [`
    @media print {
      .contenido-hoja {
        width: var(--ancho-impresion, 736px);
        zoom: var(--zoom-impresion, 1);
        height: var(--alto-impresion, auto);
        justify-content: space-between;
      }
    }
  `],
})
export class InformeComponent implements OnInit, AfterViewInit, OnDestroy {
  mes = '';
  anio = '';
  // Informe por SLEP (mejora post-v2.23): si viene ?slep=... en la URL,
  // se filtra igual que el Dashboard por SLEP (mismo endpoint,
  // getDashboard ya acepta este parámetro) — el ranking llega vacío
  // solo, sin nada especial que hacer para esconderlo (ver plantilla).
  slep: string | null = null;
  datos: DashboardDeMes | null = null;

  // Geometría (96 px por pulgada). Carta = 816 x 1056 px. Márgenes del PDF
  // (pdf.service.ts y @page en styles.scss): 1cm arriba/lados, 1,5cm abajo
  // para el pie -> área imprimible ~740 x 961 px. La hoja impresa mide
  // 940 px de alto (holgura de seguridad bajo 961) con 24 px de padding.
  private readonly anchoContenidoPx = 736;          // ancho fijo del contenido (pantalla e impresión)
  private readonly anchoUtilImpresionPx = 740 - 48; // ancho útil dentro de la hoja impresa
  private readonly altoUtilImpresionPx = 940 - 48;  // alto útil dentro de la hoja impresa
  private readonly holgura = 0.98;                  // margen contra redondeos de subpíxel

  @ViewChildren('contenidoHoja') contenidosHojas!: QueryList<ElementRef<HTMLElement>>;
  private subHojas?: Subscription;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly dashboardApi: DashboardApiService,
    private readonly titleService: Title,
  ) {}

  ngOnInit(): void {
    this.mes = this.route.snapshot.paramMap.get('mes') ?? '';
    this.anio = this.route.snapshot.paramMap.get('anio') ?? '';
    this.slep = this.route.snapshot.queryParamMap.get('slep');
    // Título real de la pestaña (reemplaza el genérico "Frontend"): es el
    // nombre sugerido al guardar y el que usa el pie del PDF.
    const sufijoTitulo = this.slep ? ` - ${this.slep}` : '';
    this.titleService.setTitle(`Informe Avance de Sumarios - ${this.mes} ${this.anio}${sufijoTitulo}`);
    this.dashboardApi.getDashboard(this.mes, this.anio, this.slep ?? undefined).subscribe((datos) => (this.datos = datos));
  }

  ngAfterViewInit(): void {
    // Las hojas aparecen recién cuando llegan los datos (@if), por eso se
    // escucha cuándo cambian en vez de calcular una sola vez al iniciar.
    this.subHojas = this.contenidosHojas.changes.subscribe(() => this.programarAjuste());
    this.programarAjuste();
  }

  ngOnDestroy(): void {
    this.subHojas?.unsubscribe();
  }

  private programarAjuste(): void {
    if (!this.contenidosHojas?.length) return;
    setTimeout(() => {
      this.calcularAjusteImpresion();
      // Se recalcula cuando terminan de cargar las fuentes (Roboto puede
      // llegar después y cambiar levemente las alturas). Recién ahí se
      // avisa a Puppeteer que el informe está listo para capturar.
      document.fonts.ready.then(() => {
        this.calcularAjusteImpresion();
        (window as unknown as Record<string, unknown>)['__informeListo'] = true;
      });
    });
  }

  // Calcula, para cada hoja, cómo adaptarla a la hoja carta en ANCHO y ALTO
  // a la vez, sin deformar nada:
  //  1. Busca el ancho de diagramación cuya proporción ancho/alto coincida
  //     con la de la hoja. Si el contenido es "más alto que la hoja" (el
  //     dashboard), se re-diagrama más ancho (columnas y barras más largas;
  //     el alto casi no cambia porque donut, filas y totales tienen altura
  //     fija). Si ya es "más ancho" (el ranking), se deja en su ancho.
  //  2. Aplica un zoom UNIFORME que lleva ese ancho exacto al ancho útil.
  //  3. El poco espacio vertical que pueda sobrar se reparte entre secciones.
  // La medición cambia el ancho solo por un instante dentro del mismo ciclo
  // de JavaScript (el navegador no alcanza a pintar), así que la pantalla
  // no parpadea. Todo queda en variables CSS que solo se aplican al imprimir.
  private calcularAjusteImpresion(): void {
    const proporcionHoja = this.anchoUtilImpresionPx / this.altoUtilImpresionPx;
    this.contenidosHojas.forEach((ref) => {
      const el = ref.nativeElement;
      let ancho = this.anchoContenidoPx;
      let alto = el.scrollHeight;
      if (!alto) return;
      for (let i = 0; i < 5; i++) {
        const anchoIdeal = alto * proporcionHoja;
        if (anchoIdeal <= ancho + 1) break;
        ancho = Math.round(anchoIdeal);
        el.style.width = `${ancho}px`;
        alto = el.scrollHeight;
      }
      el.style.width = '';
      const zoom = Math.min(this.anchoUtilImpresionPx / ancho, this.altoUtilImpresionPx / alto) * this.holgura;
      const altoConZoom = (this.altoUtilImpresionPx * this.holgura) / zoom;
      el.style.setProperty('--ancho-impresion', `${ancho}px`);
      el.style.setProperty('--zoom-impresion', zoom.toFixed(4));
      el.style.setProperty('--alto-impresion', `${altoConZoom.toFixed(1)}px`);
    });
  }

  imprimir(): void {
    window.print();
  }
}
