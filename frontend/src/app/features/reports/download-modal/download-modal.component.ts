import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { InformeCatalogo, ReportsApiService } from '../services/reports-api.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';

export interface DownloadModalData { mes: string; anio: string; slep: string | null }

// Formato del archivo: decide el color del ícono (xlsx verde, html azul, pdf
// rojo) y la etiqueta de extensión.
export type FormatoInforme = InformeCatalogo['formato'];

interface Columna {
  categoria: InformeCatalogo['categoria'];
  titulo: string;
  extension: string;
  informes: InformeCatalogo[];
}

// Las 3 columnas, en orden. El contenido de cada una sale del catálogo único.
const COLUMNAS: Omit<Columna, 'informes'>[] = [
  { categoria: 'consolidado', titulo: 'Consolidado', extension: '.xlsx' },
  { categoria: 'interactivo', titulo: 'Interactivo', extension: '.html' },
  { categoria: 'estatico', titulo: 'Estático', extension: '.pdf' },
];

// Nombres de los archivos Excel al descargar (catálogo único).
const ARCHIVO_CONSOLIDADO_MES = 'Informe consolidado de datos por mes.xlsx';
const ARCHIVO_CONSOLIDADO_SLEP = 'Informe consolidado de datos por SLEP.xlsx';

// Ventana "Descargas de informes": tres columnas (Consolidado, Interactivo,
// Estático). Los nombres, descripciones, formatos y orden vienen del catálogo
// único del portal (a través del servidor de Sumarios, con copia de
// respaldo); aquí solo vive QUÉ HACER al elegir cada informe. Cada persona ve
// solo los que su perfil permite.
@Component({
  selector: 'app-download-modal',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  templateUrl: './download-modal.component.html',
})
export class DownloadModalComponent {
  descargando = false;
  cargando = true;
  columnas: Columna[] = [];

  // Qué hace cada informe del catálogo, por su id. Un informe nuevo en el
  // catálogo sin acción aquí no se muestra (no habría qué abrir).
  private readonly acciones: Record<string, () => void> = {
    sumarios_consolidado_mes: () => this.descargarExcelGeneral(),
    sumarios_consolidado_slep: () => this.descargarExcelPorSlep(),
    sumarios_informe_interactivo: () => this.verInformeInteractivo(),
    sumarios_dashboard_interactivo: () => this.verDashboard(false),
    sumarios_dashboard_pdf: () => this.verDashboard(true),
    sumarios_ranking_interactivo: () => this.verRanking(false),
    sumarios_errores_interactivo: () => this.abrirInforme(false, 'errores'),
    sumarios_informe_general_pdf: () => this.abrirInforme(true, 'general', null),
    sumarios_informe_slep_pdf: () => this.verInformePorSlep(),
    sumarios_ranking_pdf: () => this.verRanking(true),
    sumarios_errores_pdf: () => this.abrirInforme(true, 'errores'),
  };

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: DownloadModalData,
    private readonly dialogRef: MatDialogRef<DownloadModalComponent>,
    private readonly reportsApi: ReportsApiService,
    readonly authService: AuthService,
    private readonly notification: NotificationService,
  ) {
    this.reportsApi.getCatalogo().subscribe({
      next: ({ informes }) => this.armarColumnas(informes),
      error: () => {
        this.cargando = false;
        this.notification.mostrar('No se pudo cargar la lista de informes.');
      },
    });
  }

  get alcanceEsTodos(): boolean {
    const u = this.authService.usuarioActual();
    return !!u && (u.esSuperadmin || u.alcance === 'todos');
  }

  // Solo lo que la persona puede abrir: el permiso de su perfil, el alcance
  // que exige el informe y que esté disponible.
  private armarColumnas(informes: InformeCatalogo[]): void {
    const permitidos = informes
      .filter((i) => i.estado === 'activa' && this.acciones[i.id])
      .filter((i) => this.authService.can(i.permiso) && (!i.requiereAlcanceTodos || this.alcanceEsTodos))
      .sort((a, b) => a.orden - b.orden);
    this.columnas = COLUMNAS.map((c) => ({ ...c, informes: permitidos.filter((i) => i.categoria === c.categoria) }));
    this.cargando = false;
  }

  get hayInformes(): boolean {
    return this.columnas.some((c) => c.informes.length);
  }

  elegir(i: InformeCatalogo): void {
    if (!this.descargando) this.acciones[i.id]?.();
  }

  private descargarBlob(blob: Blob, nombreArchivo: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    a.click();
    URL.revokeObjectURL(url);
  }

  descargarExcelGeneral(): void {
    this.descargando = true;
    this.reportsApi.descargarExcelGeneral().subscribe({
      next: (blob) => { this.descargarBlob(blob, ARCHIVO_CONSOLIDADO_MES); this.descargando = false; },
      error: () => { this.notification.mostrar('No se pudo descargar el Excel.'); this.descargando = false; },
    });
  }

  descargarExcelPorSlep(): void {
    this.descargando = true;
    this.reportsApi.descargarExcelPorSlep().subscribe({
      next: (blob) => { this.descargarBlob(blob, ARCHIVO_CONSOLIDADO_SLEP); this.descargando = false; },
      error: () => { this.notification.mostrar('No se pudo descargar el Excel.'); this.descargando = false; },
    });
  }

  // Informe interactivo nacional: la página del Informe Interactivo de
  // avance, en otra pestaña, en el mes (y el SLEP, si hay uno activo) que se
  // está mirando.
  verInformeInteractivo(): void {
    const p = new URLSearchParams({ mes: this.data.mes, anio: this.data.anio });
    if (this.data.slep) p.set('slep', this.data.slep);
    window.open(`/informe-avance?${p.toString()}`, '_blank');
  }

  // Informe de dashboard: el Dashboard del mes (y del SLEP, si hay uno activo)
  // con el diseño de los informes. Estático = la misma página con ?imprimir=1.
  private verDashboard(imprimir: boolean): void {
    const p = new URLSearchParams({ mes: this.data.mes, anio: this.data.anio });
    if (this.data.slep) p.set('slep', this.data.slep);
    if (imprimir) p.set('imprimir', '1');
    window.open(`/informe-dashboard?${p.toString()}`, '_blank');
  }

  // Informe de ranking (mismo diseño que el nacional), en el mes que se está
  // mirando. Estático = la misma página con ?imprimir=1, que abre sola la
  // ventana de impresión ("Guardar como PDF"). El ranking es de todos los SLEP.
  private verRanking(imprimir: boolean): void {
    const p = new URLSearchParams({ mes: this.data.mes, anio: this.data.anio });
    if (imprimir) p.set('imprimir', '1');
    window.open(`/informe-ranking?${p.toString()}`, '_blank');
  }

  // Informe estático por SLEP: el informe nacional, del SLEP que se está
  // mirando en la aplicación (quien trabaja con un solo SLEP, el suyo).
  get slepParaInforme(): string | null {
    const u = this.authService.usuarioActual();
    return this.data.slep ?? (u && !u.esSuperadmin && u.alcance !== 'todos' ? u.alcance : null);
  }

  private verInformePorSlep(): void {
    const slep = this.slepParaInforme;
    if (!slep) {
      this.notification.mostrar('Para el informe por SLEP, primero elige un SLEP en la aplicación.');
      return;
    }
    this.abrirInforme(true, 'general', slep);
  }

  // Errores (interactivo) y los estáticos nacional, por SLEP y de errores: la
  // página del Informe. Estático = la misma página con ?imprimir=1, que abre
  // sola la ventana de impresión ("Guardar como PDF"). El nacional va siempre
  // con todos los SLEP (quien trabaja con uno solo, igual ve solo el suyo).
  private abrirInforme(imprimir: boolean, tipo: 'general' | 'errores', slep: string | null = this.data.slep): void {
    const params = new URLSearchParams();
    if (slep) params.set('slep', slep);
    if (imprimir) params.set('imprimir', '1');
    if (tipo !== 'general') params.set('tipo', tipo);
    const query = params.toString();
    window.open(`/informe/${encodeURIComponent(this.data.mes)}/${encodeURIComponent(this.data.anio)}${query ? '?' + query : ''}`, '_blank');
  }

  cerrar(): void {
    this.dialogRef.close();
  }
}
