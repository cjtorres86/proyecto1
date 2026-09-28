import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { DashboardApiService } from '../../dashboard/services/dashboard-api.service';
import { CasesApiService } from '../../cases/services/cases-api.service';
import { ReportsApiService, ErrorFila, RankingDetalleFila } from '../services/reports-api.service';
import { ThemeService } from '../../../core/services/theme.service';
import { DashboardDeMes } from '../../../core/models/dashboard.model';
import { CampoConValor } from '../../../core/models/case.model';
import { AdvanceIndicatorComponent } from '../../dashboard/advance-indicator/advance-indicator.component';
import { InitialTotalsDonutComponent } from '../../dashboard/initial-totals-donut/initial-totals-donut.component';
import { TotalAndBarsGroupComponent } from '../../dashboard/total-and-bars-group/total-and-bars-group.component';
import { RankingConDetalleComponent } from '../ranking-con-detalle/ranking-con-detalle.component';
import { TooltipHojaComponent, TooltipHojaFila } from '../tooltip-hoja/tooltip-hoja.component';

// Informe Interactivo: página real de Angular que reutiliza los mismos
// componentes del Dashboard. El PDF es esta misma página impresa por el
// navegador de la persona ("Guardar como PDF"; el botón "PDF" la abre con
// ?imprimir=1 y la ventana de impresión aparece sola).
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
  imports: [CommonModule, AdvanceIndicatorComponent, InitialTotalsDonutComponent, TotalAndBarsGroupComponent, RankingConDetalleComponent, TooltipHojaComponent],
  templateUrl: './informe.component.html',
  styles: [`
    @media print {
      .contenido-hoja {
        width: var(--ancho-impresion, 736px);
        zoom: var(--zoom-impresion, 1);
        height: var(--alto-impresion, auto);
        justify-content: space-between;
      }
      /* Hoja de errores: repite el encabezado de la tabla en cada hoja
         impresa nueva — técnica estándar de impresión, no algo propio de
         este sistema. Solo aplica a esta tabla (fuera de .contenido-hoja,
         que es la de ajuste-a-una-hoja de las demás). */
      .tabla-errores thead {
        display: table-header-group;
      }
      .tabla-errores tr {
        break-inside: avoid;
      }
    }
    /* Barra lateral (botón Imprimir + selector de SLEP), mejora
       post-v2.23: "fixed" para que siga visible al hacer scroll en un
       informe con varias hojas — calculada con el mismo truco que usa
       TooltipHojaComponent: la hoja mide 816px y está centrada
       (mx-auto), así que su borde izquierdo, en cualquier ancho de
       ventana, está siempre a 50% - 408px. calc(50% + 428px) en "right"
       deja la barra pegada a ESE borde (408px + 20px de aire), nunca al
       borde de la pantalla. */
    .barra-lateral-informe {
      position: fixed;
      top: 24px;
      right: calc(50% + 428px);
      width: 170px;
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
  // Hoja de formulario (mejora post-v2.23): reutiliza EXACTAMENTE el
  // mismo endpoint que ya alimenta el "Formulario total general" del
  // sistema — pedirle un SLEP puntual en vez de 'todos' devuelve el
  // formulario real de ese SLEP, sin ningún cálculo nuevo.
  camposFormulario: CampoConValor[] = [];
  // Hoja de errores (mejora post-v2.23): reutiliza EXACTAMENTE el mismo
  // dato que ya alimenta la pantalla "Errores" del sistema — mismo
  // endpoint, mismo cálculo, sin nada nuevo del lado del servidor.
  // ?tipo=errores (InformeComponent al final del botón "Informe de
  // Errores"): muestra SOLO esta hoja, sin Dashboard/Ranking/Formulario.
  // Por defecto ('general'): esta hoja se agrega AL FINAL de las demás.
  errores: ErrorFila[] = [];
  erroresCargados = false;

  // Ranking Interactivo (mejora post-v2.23): hoja propia dentro del
  // MISMO Informe (no una página aparte) — misma maquetación, mismo
  // ajuste a una hoja carta y mismo mecanismo de PDF que las demás. Solo
  // en modo interactivo tiene sentido el detalle al pasar el mouse: un
  // PDF no puede reaccionar al mouse, así que en PDF se ve la tabla sin
  // esa interacción, nada más.
  rankingDetalle: RankingDetalleFila[] = [];
  rankingDetalleCargado = false;

  // Tooltips de los totales del Dashboard (mejora post-v2.23): qué campo
  // tiene el mouse encima ahora mismo. El desglose sale del MISMO
  // rankingDetalle ya cargado (todos los campos de los 36 SLEP) — no
  // hace falta pedirle nada nuevo al servidor.
  campoConMouseEncima: string | null = null;

  // Selector de SLEP (mejora post-v2.23): la lista completa de 36, para
  // elegir uno distinto sin salir del Informe. Mismo catálogo que ya usa
  // "Crear Mes" — si ya llegaron los 36 por rankingDetalle, se reutilizan
  // (sin pedir nada de más); si no (tipo=errores), se piden aparte.
  catalogoSleps: string[] = [];
  selectorSlepAbierto = false;

  // 'errores' fluye libre en varias hojas (sin ajuste-a-una-hoja);
  // 'ranking' y 'general' sí usan ese ajuste, como el Dashboard y el
  // Formulario.
  tipo: 'general' | 'errores' | 'ranking' = 'general';

  // Geometría (96 px por pulgada). Carta = 816 x 1056 px. Márgenes de
  // impresión (@page en styles.scss): 1cm arriba/lados, 1,5cm abajo
  // para el pie -> área imprimible ~740 x 961 px. La hoja impresa mide
  // 940 px de alto (holgura de seguridad bajo 961) con 24 px de padding.
  private readonly anchoContenidoPx = 736;          // ancho fijo del contenido (pantalla e impresión)
  private readonly anchoUtilImpresionPx = 740 - 48; // ancho útil dentro de la hoja impresa
  private readonly altoUtilImpresionPx = 940 - 48;  // alto útil dentro de la hoja impresa
  private readonly holgura = 0.98;                  // margen contra redondeos de subpíxel

  @ViewChildren('contenidoHoja') contenidosHojas!: QueryList<ElementRef<HTMLElement>>;
  private subHojas?: Subscription;
  // Llegó desde el botón "PDF" (?imprimir=1): al terminar de dibujarse,
  // abre sola la ventana de impresión del navegador ("Guardar como PDF").
  imprimirAlCargar = false; // leído por la plantilla (overlay "Preparando tu PDF…")

  constructor(
    private readonly route: ActivatedRoute,
    private readonly dashboardApi: DashboardApiService,
    private readonly casesApi: CasesApiService,
    private readonly titleService: Title,
    private readonly theme: ThemeService,
    private readonly location: Location,
    private readonly reportsApi: ReportsApiService,
  ) {}

  // Todo lo que hace falta según el tipo de informe ya llegó — recién
  // ahí se muestra algo (nunca a medio cargar) y se puede intentar
  // imprimir. "Informe de Errores": solo espera los errores. "Informe
  // General": espera Dashboard, Formulario Y Errores (se agrega al final).
  get listoParaMostrar(): boolean {
    if (this.tipo === 'errores') return this.erroresCargados;
    if (this.tipo === 'ranking') return this.rankingDetalleCargado;
    return !!this.datos && this.camposFormulario.length > 0 && this.erroresCargados && this.rankingDetalleCargado;
  }

  // Desglose por SLEP de UN campo (mejora post-v2.23), para el tooltip de
  // los totales del Dashboard — derivado de rankingDetalle (ya cargado),
  // sin pedir nada nuevo. Solo SLEP con datos reales en ese campo.
  filasDesgloseCampo(preguntaId: string): TooltipHojaFila[] {
    return this.rankingDetalle
      .map((f) => ({ etiqueta: f.slep, valor: f.campos.find((c) => c.preguntaId === preguntaId)?.valor ?? '' }))
      .filter((f) => f.valor !== '');
  }

  tituloDesgloseCampo(preguntaId: string): string {
    const campo = this.rankingDetalle[0]?.campos.find((c) => c.preguntaId === preguntaId);
    return campo ? `${campo.numero}. ${campo.nombre}` : preguntaId;
  }

  // Cambiar de SLEP (mejora post-v2.23, corrección): NO abandona la
  // página — antes usaba window.location.href, y el navegador volvía a
  // descargar el sistema completo desde cero (se sentía como "generar
  // todo el informe de nuevo"). Ahora solo se piden los datos otra vez;
  // la URL se actualiza con Location.replaceState (mismo mecanismo que
  // ya usa abrirImpresion), que cambia la dirección SIN navegar — así un
  // enlace compartido o F5 abren directo en el SLEP elegido.
  cambiarSlep(nuevoSlep: string | null): void {
    this.selectorSlepAbierto = false;
    if (nuevoSlep === this.slep) return;
    this.slep = nuevoSlep;

    const params = new URLSearchParams();
    if (this.slep) params.set('slep', this.slep);
    if (this.tipo !== 'general') params.set('tipo', this.tipo);
    const query = params.toString();
    this.location.replaceState(`/informe/${encodeURIComponent(this.mes)}/${encodeURIComponent(this.anio)}${query ? '?' + query : ''}`);

    // Mismo mensaje "Cargando…" de la primera carga, mientras llegan los
    // datos del SLEP nuevo — nunca se mezclan datos de 2 SLEP distintos.
    this.datos = null;
    this.camposFormulario = [];
    this.errores = [];
    this.erroresCargados = false;
    this.rankingDetalle = [];
    this.rankingDetalleCargado = false;
    this.campoConMouseEncima = null;
    this.cargarDatos();
  }

  ngOnInit(): void {
    // El Informe/PDF siempre se ve igual sin importar el tema elegido —
    // es un documento que se imprime y se archiva, no una pantalla de
    // trabajo (mismo motivo por el que ya se fuerza color-scheme claro
    // en el <head>). No toca la preferencia guardada de la persona: al
    // volver al resto del sistema, su tema sigue como lo dejó.
    this.theme.forzarClaroSinGuardar();
    this.imprimirAlCargar = this.route.snapshot.queryParamMap.get('imprimir') === '1';
    const tipoPedido = this.route.snapshot.queryParamMap.get('tipo');
    this.tipo = tipoPedido === 'errores' || tipoPedido === 'ranking' ? tipoPedido : 'general';
    // Sin animaciones en esta pestaña: la impresión debe tomar las barras
    // ya en su valor final, no a medio "llenarse" (ver .sin-animaciones en
    // styles.scss).
    if (this.imprimirAlCargar) document.documentElement.classList.add('sin-animaciones');
    this.mes = this.route.snapshot.paramMap.get('mes') ?? '';
    this.anio = this.route.snapshot.paramMap.get('anio') ?? '';
    this.slep = this.route.snapshot.queryParamMap.get('slep');
    this.casesApi.listarSlep().subscribe((lista) => (this.catalogoSleps = lista.map((s) => s.nombre)));
    this.cargarDatos();
  }

  // Pide los datos según this.mes/anio/tipo/slep actuales (mejora
  // post-v2.23): separado de ngOnInit para poder llamarlo de nuevo al
  // cambiar de SLEP, sin abandonar la página — antes cambiarSlep()
  // navegaba con window.location.href, y el navegador volvía a
  // descargar el sistema completo desde cero, no solo a pedir los datos
  // nuevos. Mismo mensaje "Cargando…" que la primera carga, mientras
  // llegan.
  private cargarDatos(): void {
    // Título real de la pestaña (reemplaza el genérico "Frontend"): es el
    // nombre sugerido al guardar y el que usa el pie del PDF.
    const sufijoTitulo = this.slep ? ` - ${this.slep}` : '';
    const nombreInforme = this.tipo === 'errores' ? 'Informe de Errores' : this.tipo === 'ranking' ? 'Ranking' : 'Informe Avance de Sumarios';
    this.titleService.setTitle(`${nombreInforme} - ${this.mes} ${this.anio}${sufijoTitulo}`);

    if (this.tipo === 'ranking') {
      this.reportsApi.getRankingDetalle(this.mes, this.anio, this.slep ?? undefined).subscribe((lista) => {
        this.rankingDetalle = lista;
        this.rankingDetalleCargado = true;
        this.programarAjuste();
      });
      return;
    }

    this.reportsApi.listarErrores(this.mes, this.anio, this.slep ?? undefined).subscribe((lista) => {
      this.errores = lista;
      this.erroresCargados = true;
      this.programarAjuste();
    });
    if (this.tipo === 'general') {
      this.dashboardApi.getDashboard(this.mes, this.anio, this.slep ?? undefined).subscribe((datos) => {
        this.datos = datos;
        this.programarAjuste();
      });
      this.casesApi.getTotalGeneral(this.mes, this.anio, this.slep ?? undefined).subscribe((r) => {
        this.camposFormulario = r.campos;
        this.programarAjuste();
      });
      // También en modo general: alimenta el Ranking (ahora con tooltip
      // de detalle, igual que la hoja "Ranking Interactivo") y los
      // tooltips de los totales del Dashboard.
      this.reportsApi.getRankingDetalle(this.mes, this.anio, this.slep ?? undefined).subscribe((lista) => {
        this.rankingDetalle = lista;
        this.rankingDetalleCargado = true;
        this.programarAjuste();
      });
    }
  }

  ngAfterViewInit(): void {
    // Las hojas aparecen recién cuando llegan los datos (@if), por eso se
    // escucha cuándo cambian en vez de calcular una sola vez al iniciar.
    this.subHojas = this.contenidosHojas.changes.subscribe(() => this.programarAjuste());
    this.programarAjuste();
  }

  ngOnDestroy(): void {
    this.subHojas?.unsubscribe();
    document.documentElement.classList.remove('sin-animaciones');
  }

  // Abre la ventana de impresión una sola vez. Antes quita "imprimir" de
  // la dirección (con el Location de Angular), para que recargar la
  // pestaña no la vuelva a abrir. Espera 2 cuadros de pantalla para que
  // todo esté dibujado en su estado final.
  private abrirImpresion(): void {
    this.imprimirAlCargar = false;
    const params = new URLSearchParams();
    if (this.slep) params.set('slep', this.slep);
    if (this.tipo !== 'general') params.set('tipo', this.tipo);
    const query = params.toString();
    this.location.replaceState(`/informe/${encodeURIComponent(this.mes)}/${encodeURIComponent(this.anio)}${query ? '?' + query : ''}`);
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  }

  // Con ?tipo=errores no hay hojas de ajuste-a-carta que calcular (la
  // hoja de errores fluye libre en varias hojas, ver plantilla) — solo
  // hace falta esperar a que los datos y las fuentes estén listos.
  private programarAjuste(): void {
    if (!this.listoParaMostrar) return;
    if (this.tipo === 'errores') {
      document.fonts.ready.then(() => {
        if (this.imprimirAlCargar) this.abrirImpresion();
      });
      return;
    }
    if (!this.contenidosHojas?.length) return;
    setTimeout(() => {
      this.calcularAjusteImpresion();
      // Se recalcula cuando terminan de cargar las fuentes (Roboto puede
      // llegar después y cambiar levemente las alturas). Recién ahí, si se
      // llegó desde el botón "PDF", se abre la ventana de impresión.
      document.fonts.ready.then(() => {
        this.calcularAjusteImpresion();
        if (this.imprimirAlCargar) this.abrirImpresion();
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

  colorBarraRanking(pct: number | null): string {
    if (pct === null) return '#D1D5DB';
    if (pct >= 75) return '#00E0FF';
    if (pct >= 50) return '#16A34A';
    if (pct >= 25) return '#D97706';
    return '#DC2626';
  }
}
