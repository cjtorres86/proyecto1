import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { ReportsApiService } from '../services/reports-api.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';

export interface DownloadModalData { mes: string; anio: string }

// Equivalente al modal único de descarga del PMV (TDD, sección 9.6) —
// las mismas 4 modalidades, cada una visible u oculta según el permiso
// y el alcance de quien lo abre.
@Component({
  selector: 'app-download-modal',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  templateUrl: './download-modal.component.html',
})
export class DownloadModalComponent {
  descargando = false;

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
      next: (blob) => { this.descargarBlob(blob, 'GDP-SLEP_Consolidado_General.xlsx'); this.descargando = false; },
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
  verInforme(): void {
    window.open(`/informe/${this.data.mes}/${this.data.anio}`, '_blank');
  }

  // Ahora pide el PDF real al backend (Puppeteer, ver PdfService) —
  // deja de depender de que el navegador del usuario tenga bien
  // configurada la impresión.
  descargarPDF(): void {
    this.descargando = true;
    this.reportsApi.descargarInformePdf(this.data.mes, this.data.anio).subscribe({
      next: (blob) => { this.descargarBlob(blob, `Avance_de_Sumarios_${this.data.mes}_${this.data.anio}.pdf`); this.descargando = false; },
      error: () => { this.notification.mostrar('No se pudo generar el PDF.'); this.descargando = false; },
    });
  }

  cerrar(): void {
    this.dialogRef.close();
  }
}
