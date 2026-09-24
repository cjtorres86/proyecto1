import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

// Equivalente directo de toast() del PMV (TDD, sección 13.9) — mismo
// rol, ahora sobre MatSnackBar en vez de un div flotante hecho a mano.
@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(private readonly snackBar: MatSnackBar) {}

  mostrar(mensaje: string, duracionMs = 3000): void {
    this.snackBar.open(mensaje, 'Cerrar', { duration: duracionMs, horizontalPosition: 'center', verticalPosition: 'bottom' });
  }
}
