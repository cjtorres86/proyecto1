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
