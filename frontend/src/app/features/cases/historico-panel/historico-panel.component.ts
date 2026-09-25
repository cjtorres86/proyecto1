import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, combineLatest, switchMap, of, forkJoin, map } from 'rxjs';
import { CaseStateService } from '../../../core/services/case-state.service';
import { CasesApiService } from '../services/cases-api.service';
import { HistoricoSlep } from '../../../core/models/case.model';
import { ModeSwitcherComponent } from '../../../shared/mode-switcher/mode-switcher.component';
import { HistoricoChartComponent, SerieHistoricoAvance } from '../historico-chart/historico-chart.component';

type PuntoAvance = { mes: string; anio: string; pct: number | null };

// Misma escala de umbrales que RankingComponent.colorBarra(). Recibe
// SIEMPRE un número: "sin datos" ya llega convertido a 0 (ver
// aNumero). Antes aceptaba null y lo pintaba gris #D1D5DB, el mismo
// gris de las líneas no destacadas: por eso el SLEP marcado se veía
// igual que el resto (hallazgo real).
function colorPorAvance(pct: number): string {
  if (pct >= 75) return '#00E0FF';
  if (pct >= 50) return '#16A34A';
  if (pct >= 25) return '#D97706';
  return '#DC2626';
}

// "Sin datos" (sin sumarios instruidos ese mes, pctAvance = null en
// DashboardService.calculateMetrics) cuenta como 0% en el gráfico —
// misma regla que la planilla general ("sin datos o cero = cero").
// Así un SLEP sin datos igual dibuja su línea (roja, en 0%) en vez de
// desaparecer del gráfico.
const aNumero = (pct: number | null) => pct ?? 0;
const clave = (p: { mes: string; anio: string }) => `${p.mes} ${p.anio}`;

// Gris de las líneas no destacadas: distinto de los 4 colores de la
// escala de avance, así nunca se confunde con un destacado.
const GRIS_FONDO = '#D1D5DB';

// Panel "Ver Histórico" — 2 niveles:
//
// GENERAL (sin ningún SLEP marcado): una línea (% de avance mes a mes,
// el mismo indicador del Dashboard) más la planilla tipo Excel
// (columnas = SLEP, filas = mes). Reutiliza CasesService.
// getHistoricoAvance()/getHistoricoAvanceTodosLosSlep() — mismo motor
// de suma que el Dashboard, nunca un cálculo aparte.
//
// POR SLEP: clickear un SLEP en el panel (estando en este modo) agrega
// su propia línea al MISMO gráfico general, en gris — clickearlo de
// nuevo la quita. El último que se marcó ("destacado") queda en SU
// PROPIO color (según su avance en el MES ACTIVO) y encima de todas
// las demás líneas, incluida la general; la planilla general se
// reemplaza por la planilla detallada de ESE SLEP mientras haya uno
// destacado.
//
// Eje de tiempo: el backend entrega los meses del más reciente al más
// antiguo (orden de planilla). El gráfico los invierte para leerse de
// izquierda (pasado) a derecha (presente). El color se busca por
// NOMBRE del mes activo, nunca por posición en la lista (hallazgo
// real: tomar el último elemento daba el mes MÁS ANTIGUO, no el actual).
@Component({
  selector: 'app-historico-panel',
  standalone: true,
  imports: [CommonModule, ModeSwitcherComponent, HistoricoChartComponent],
  templateUrl: './historico-panel.component.html',
  // El host ocupa todo el alto de su celda: así el contenedor interno
  // (#contenedor, el que hace scroll) tiene un alto real que medir.
  host: { class: 'block h-full' },
})
export class HistoricoPanelComponent implements OnInit, AfterViewInit, OnDestroy {
  // Alto del gráfico adaptado a la pantalla (mejora post-v2.23). En
  // pantallas grandes (2K) queda en el máximo, igual que antes. En
  // pantallas más chicas (o con escala de Windows al 125%/150%, que para
  // el navegador equivale a una pantalla más chica) baja lo justo para
  // verse COMPLETO dentro de lo visible del panel; las tablas quedan
  // debajo, alcanzables con el scroll. Nunca baja del mínimo legible.
  static readonly ALTO_MAXIMO = 780;
  static readonly ALTO_MINIMO = 280;
  // Aire entre el borde inferior del gráfico y el borde visible del panel.
  static readonly MARGEN_INFERIOR = 12;
  altoGrafico = HistoricoPanelComponent.ALTO_MAXIMO;

  @ViewChild('contenedor', { static: true }) private contenedor!: ElementRef<HTMLElement>;
  private zonaGraficoEl?: HTMLElement;
  // La zona del gráfico solo existe cuando hay un mes elegido (@if): el
  // setter se entera cuando aparece y recalcula en el siguiente cuadro
  // (requestAnimationFrame), ya con el layout listo y fuera del ciclo de
  // detección de cambios en curso.
  @ViewChild('zonaGrafico') private set zonaGrafico(ref: ElementRef<HTMLElement> | undefined) {
    this.zonaGraficoEl = ref?.nativeElement;
    if (this.zonaGraficoEl) requestAnimationFrame(() => this.recalcularAltoGrafico());
  }
  private observadorTamano?: ResizeObserver;

  mes: string | null = null;
  anio: string | null = null;

  etiquetasMeses: string[] = [];
  series: SerieHistoricoAvance[] = [];

  tablaGeneral: { sleps: string[]; filas: { mes: string; anio: string; valores: number[] }[] } | null = null;

  slepDestacado: string | null = null;
  datosSlepDestacado: HistoricoSlep | null = null;

  cargando = false;
  private sub?: Subscription;

  constructor(
    private readonly caseState: CaseStateService,
    private readonly api: CasesApiService,
    private readonly zone: NgZone,
  ) {}

  ngOnInit(): void {
    this.sub = combineLatest([this.caseState.mesActivo$, this.caseState.slepsHistorico$, this.caseState.slepDestacadoHistorico$])
      .pipe(
        switchMap(([mes, sleps, destacado]) => {
          if (!mes) return of(null);
          this.cargando = true;

          const listaSleps = [...sleps];
          return forkJoin({
            // El mes activo y el destacado viajan DENTRO del resultado:
            // el subscribe nunca lee propiedades de la clase que pueden
            // haber cambiado mientras llegaban las respuestas.
            mesActivo: of(mes),
            destacado: of(destacado),
            general: this.api.getHistoricoAvance(mes.mes, mes.anio),
            // La planilla general solo hace falta si NO hay un SLEP
            // destacado (se reemplaza por su planilla detallada).
            tabla: destacado ? of(null) : this.api.getHistoricoAvanceTodos(mes.mes, mes.anio),
            porSlep: listaSleps.length
              ? forkJoin(listaSleps.map((s) => this.api.getHistoricoAvance(mes.mes, mes.anio, s).pipe(map((datos) => ({ slep: s, datos })))))
              : of([] as { slep: string; datos: PuntoAvance[] }[]),
            destacadoHistorico: destacado ? this.api.getHistorico(destacado, mes.mes, mes.anio) : of(null),
          });
        }),
      )
      .subscribe((resultado) => {
        this.cargando = false;
        if (!resultado) {
          this.mes = null;
          this.anio = null;
          this.etiquetasMeses = [];
          this.series = [];
          this.tablaGeneral = null;
          this.slepDestacado = null;
          this.datosSlepDestacado = null;
          return;
        }

        const { mesActivo, destacado } = resultado;
        this.mes = mesActivo.mes;
        this.anio = mesActivo.anio;
        this.slepDestacado = destacado;

        // Eje X de izquierda (más antiguo) a derecha (mes activo).
        this.etiquetasMeses = [...resultado.general].reverse().map(clave);

        // Alinea cualquier serie a las etiquetas del eje por NOMBRE de
        // mes (no por posición), con "sin datos" convertido a 0.
        const alinear = (datos: PuntoAvance[]) => {
          const porClave = new Map(datos.map((p) => [clave(p), aNumero(p.pct)]));
          return this.etiquetasMeses.map((k) => porClave.get(k) ?? 0);
        };
        // % del MES ACTIVO, buscado por nombre — de acá sale el color.
        const pctMesActivo = (datos: PuntoAvance[]) =>
          aNumero(datos.find((p) => p.mes === mesActivo.mes && p.anio === mesActivo.anio)?.pct ?? null);

        // La General va en color solo cuando es la única protagonista
        // (ningún SLEP marcado). Apenas hay un SLEP destacado, pasa a
        // gris como el resto: la única línea de color es la del último
        // SLEP marcado. Conserva su grosor (prioridad 1), así sigue
        // siendo reconocible entre las grises.
        const serieGeneral: SerieHistoricoAvance = {
          etiqueta: 'General (36 SLEP)',
          datos: alinear(resultado.general),
          color: destacado ? GRIS_FONDO : colorPorAvance(pctMesActivo(resultado.general)),
          prioridad: 1,
        };
        const seriesSlep: SerieHistoricoAvance[] = resultado.porSlep.map(({ slep, datos }) => {
          const esDestacado = slep === destacado;
          return {
            etiqueta: slep,
            datos: alinear(datos),
            color: esDestacado ? colorPorAvance(pctMesActivo(datos)) : GRIS_FONDO,
            prioridad: esDestacado ? 2 : 0,
          };
        });
        this.series = [serieGeneral, ...seriesSlep];

        this.tablaGeneral = resultado.tabla;
        this.datosSlepDestacado = resultado.destacadoHistorico;
      });
  }

  ngAfterViewInit(): void {
    // ResizeObserver (API estándar del navegador): avisa cada vez que el
    // panel cambia de tamaño — ventana redimensionada, zoom del
    // navegador, o la ventana arrastrada del notebook al monitor 2K.
    this.observadorTamano = new ResizeObserver(() => this.recalcularAltoGrafico());
    this.observadorTamano.observe(this.contenedor.nativeElement);
  }

  // Espacio visible para el gráfico = alto visible del panel, menos lo que
  // hay encima del gráfico (encabezado y título), menos un margen. Se mide
  // con offsetTop (posición de diseño, no cambia al hacer scroll), así el
  // resultado es el mismo aunque el usuario esté a mitad de la página.
  private recalcularAltoGrafico(): void {
    const contenedor = this.contenedor?.nativeElement;
    const zona = this.zonaGraficoEl;
    if (!contenedor || !zona) return;
    const disponible = contenedor.clientHeight - zona.offsetTop - HistoricoPanelComponent.MARGEN_INFERIOR;
    const alto = Math.round(Math.min(HistoricoPanelComponent.ALTO_MAXIMO, Math.max(HistoricoPanelComponent.ALTO_MINIMO, disponible)));
    // ResizeObserver avisa fuera de la zona de Angular: zone.run hace que
    // la vista se actualice. Solo se actualiza si el valor cambió.
    if (alto !== this.altoGrafico) this.zone.run(() => (this.altoGrafico = alto));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.observadorTamano?.disconnect();
  }
}
