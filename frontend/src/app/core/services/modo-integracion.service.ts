import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

// ¿Avance de Sumarios está integrado al portal GDP-SLEP Studio o funciona
// independiente? Lo decide el servidor (variable INGRESO_SOLO_PORTAL), así
// que la pantalla cambia sola cuando se activa o desactiva la integración.
// Mientras no se sabe, se asume "integrado" (lo más restrictivo).
@Injectable({ providedIn: 'root' })
export class ModoIntegracionService {
  readonly integrado = signal(true);
  private cargado = false;

  constructor(private readonly http: HttpClient) {}

  cargar(): void {
    if (this.cargado) return;
    this.cargado = true;
    this.http.get<{ integrado: boolean }>(`${environment.apiUrl}/auth/modo`).subscribe({
      next: (r) => this.integrado.set(r.integrado),
      error: () => (this.cargado = false),
    });
  }
}
