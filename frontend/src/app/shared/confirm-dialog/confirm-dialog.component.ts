import { Component, Inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface ConfirmDialogData {
  titulo: string;
  mensaje: string;
  textoConfirmar: string;
  // Acción destructiva: el botón de confirmar va en rojo.
  peligroso?: boolean;
  // Líneas "etiqueta: valor" bajo el mensaje (mejora post-v2.23), para que
  // la persona compruebe datos concretos antes de aceptar — ej.: nombre del
  // archivo y SLEP al cargar un Excel. "advertencia" lo resalta en ámbar.
  detalles?: { etiqueta: string; valor: string; advertencia?: boolean }[];
}

// Confirmación reutilizable (mejora post-v2.23) — la usan "Cerrar mes" y
// "Eliminar mes", y cualquier acción futura que requiera confirmar.
// Devuelve true al confirmar; false o undefined al cancelar/cerrar.
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [NgClass, MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.titulo }}</h2>
    <mat-dialog-content>
      <p class="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{{ data.mensaje }}</p>
      @if (data.detalles?.length) {
        <!-- Panel de vidrio dentro del vidrio, como las columnas de Descargas. -->
        <dl class="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm rounded-xl border border-white/75 bg-white/50 px-3 py-2.5 dark:border-white/10 dark:bg-white/5">
          @for (d of data.detalles; track d.etiqueta) {
            <dt class="text-gray-500">{{ d.etiqueta }}</dt>
            <dd class="font-semibold break-all" [class.text-amber-700]="d.advertencia" [class.text-gray-800]="!d.advertencia">{{ d.valor }}</dd>
          }
        </dl>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false">Cancelar</button>
      <button
        mat-flat-button
        [mat-dialog-close]="true"
        class="!text-white"
        [ngClass]="data.peligroso ? '!bg-red-700' : '!bg-[#1E3A8A]'"
      >
        {{ data.textoConfirmar }}
      </button>
    </mat-dialog-actions>
  `,
})
export class ConfirmDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) readonly data: ConfirmDialogData) {}
}
