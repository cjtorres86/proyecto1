import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { ReportsApiService } from '../services/reports-api.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';

export interface DownloadModalData { mes: string; anio: string; slep: string | null }

// Tipo de archivo — decide el ícono y el color de cada fila (mejora
// post-v2.23, rediseño). Un solo lugar para agregar una modalidad nueva
// de descarga a futuro: basta un elemento más en \`opciones\`.
export type TipoArchivo = 'excel' | 'pdf' | 'html';

interface OpcionDescarga {
  tipo: TipoArchivo;
  titulo: string;
  descripcion: string;
  accion: () => void;
}

// Equivalente al modal único de descarga del PMV (TDD, sección 9.6) —
// las mismas 4 modalidades, cada una visible u oculta según el permiso
// y el alcance de quien lo abre.
@Component({
  selector: 'app-download-modal',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  templateUrl: './download-modal.component.html',
})
export class DownloadModalComponent {
  descargando = false;

  // La lista completa de opciones, ya armada con su ícono/descripción —
  // la plantilla solo recorre esto, sin repetir 6 bloques casi iguales.
  // Se recalcula cada vez (getter): sus 2 primeras filas dependen del
  // alcance de quien abrió la ventana.
  get opciones(): OpcionDescarga[] {
    const lista: OpcionDescarga[] = [];
    if (this.authService.can('exportar_excel')) {
      if (this.alcanceEsTodos) {
        lista.push({
          tipo: 'excel',
          titulo: 'Consolidado por Mes',
          descripcion: 'Los 36 SLEP, una hoja por mes.',
          accion: () => this.descargarExcelGeneral(),
        });
      }
      lista.push({
        tipo: 'excel',
        titulo: this.textoConsolidadoPorSlep,
        descripcion: this.alcanceEsTodos ? 'Cada SLEP en su propia hoja, con todos sus meses.' : 'Todos tus meses, en una sola hoja.',
        accion: () => this.descargarExcelPorSlep(),
      });
    }
    if (this.authService.can('exportar_informe')) {
      lista.push(
        {
          tipo: 'html',
          titulo: 'Informe General — Interactivo',
          descripcion: 'Dashboard, ranking, formulario y errores, para revisar en pantalla.',
          accion: () => this.verInformeGeneral(),
        },
        {
          tipo: 'pdf',
          titulo: 'Informe General — PDF',
          descripcion: 'El mismo informe, listo para guardar o imprimir.',
          accion: () => this.descargarPDFGeneral(),
        },
        {
          tipo: 'html',
          titulo: 'Ranking Interactivo',
          descripcion: 'Solo el ranking — pasa el mouse sobre un SLEP para ver sus 37 campos.',
          accion: () => this.verRankingInteractivo(),
        },
        {
          tipo: 'html',
          titulo: 'Informe de Errores — Interactivo',
          descripcion: 'Solo los errores de validación del mes, para revisar en pantalla.',
          accion: () => this.verInformeErrores(),
        },
        {
          tipo: 'pdf',
          titulo: 'Informe de Errores — PDF',
          descripcion: 'Los mismos errores, listos para guardar o imprimir.',
          accion: () => this.descargarPDFErrores(),
        },
      );
    }
    return lista;
  }

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: DownloadModalData,
    private readonly dialogRef: MatDialogRef<DownloadModalComponent>,
    private readonly reportsApi: ReportsApiService,
    readonly authService: AuthService,
    private readonly notification: NotificationService,
  ) {}

  get alcanceEsTodos(): boolean {
    const u = this.authService.usuarioActual();
    return !!u && (u.esSuperadmin || u.alcance === 'todos');
  }

  get textoConsolidadoPorSlep(): string {
    if (this.alcanceEsTodos) return 'Consolidado por SLEP';
    return `El consolidado de ${this.authService.usuarioActual()?.alcance}`;
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
      next: (blob) => { this.descargarBlob(blob, 'GDP-SLEP_Consolidado_por_Mes.xlsx'); this.descargando = false; },
      error: () => { this.notification.mostrar('No se pudo descargar el Excel.'); this.descargando = false; },
    });
  }

  descargarExcelPorSlep(): void {
    this.descargando = true;
    this.reportsApi.descargarExcelPorSlep().subscribe({
      next: (blob) => { this.descargarBlob(blob, 'GDP-SLEP_Consolidado_por_SLEP.xlsx'); this.descargando = false; },
      error: () => { this.notification.mostrar('No se pudo descargar el Excel.'); this.descargando = false; },
    });
  }

  // El informe interactivo ahora es una página real de Angular (mejora
  // post-v2.23) — ya no se le pide HTML al backend, se abre la ruta
  // directo. El botón "PDF" abre la misma página y dispara la
  // impresión de inmediato (mismo documento, dos formas de verlo).
  //
  // Informe por SLEP (mejora post-v2.23): si hay un SLEP activo al
  // abrir el modal, se agrega a la URL — el Informe ya sabe filtrarse
  // por SLEP (mismo mecanismo del Dashboard por SLEP) y el ranking se
  // esconde solo, sin código nuevo para eso.
  verInformeGeneral(): void {
    this.abrirInforme(false, false);
  }

  // PDF (opción B): abre el Informe en otra pestaña y el propio Informe
  // lanza la ventana de impresión del navegador apenas termina de
  // dibujarse, lista para "Guardar como PDF". Lo arma el computador de la
  // persona, al instante — antes lo armaba el servidor gratuito de Render
  // desde cero (abrir Chrome, cargar el sistema, pedir los datos…) y
  // tardaba mucho.
  descargarPDFGeneral(): void {
    this.abrirInforme(true, false);
  }

  // Informe de Errores (mejora post-v2.23): la MISMA página del Informe,
  // con ?tipo=errores — reutiliza toda la maquetación, el ajuste de
  // impresión y el mecanismo de PDF del Informe General; solo cambia qué
  // hoja(s) muestra.
  verInformeErrores(): void {
    this.abrirInforme(false, true);
  }

  descargarPDFErrores(): void {
    this.abrirInforme(true, true);
  }

  // Ranking Interactivo (mejora post-v2.23): ruta propia (no el Informe)
  // porque no es para imprimir — los tooltips no existen en un PDF.
  verRankingInteractivo(): void {
    const params = new URLSearchParams();
    if (this.data.slep) params.set('slep', this.data.slep);
    const query = params.toString();
    window.open(`/ranking-interactivo/${encodeURIComponent(this.data.mes)}/${encodeURIComponent(this.data.anio)}${query ? '?' + query : ''}`, '_blank');
  }

  private abrirInforme(imprimir: boolean, soloErrores: boolean): void {
    const params = new URLSearchParams();
    if (this.data.slep) params.set('slep', this.data.slep);
    if (imprimir) params.set('imprimir', '1');
    if (soloErrores) params.set('tipo', 'errores');
    const query = params.toString();
    window.open(`/informe/${encodeURIComponent(this.data.mes)}/${encodeURIComponent(this.data.anio)}${query ? '?' + query : ''}`, '_blank');
  }

  cerrar(): void {
    this.dialogRef.close();
  }
}
