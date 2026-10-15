import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

// Ventanas del formulario (Guardar y Cargar datos), con el lenguaje de
// "Descargas de informes": el vidrio semiblanco llega por defecto a todas las
// ventanas (app.config.ts) y el contenido usa la sección .ve de styles.scss.
export const OPCIONES_VIDRIO = { maxWidth: '94vw', autoFocus: 'first-tabbable' as const };

// ---------- 1. Antes de guardar ----------
export interface ConfirmarGuardarData { slep: string; mes: string; anio: string; cambios: number }

@Component({
  selector: 'app-confirmar-guardar',
  standalone: true,
  template: `
    <div class="ve" role="dialog" aria-labelledby="ve-t-guardar">
      <div class="ve-cab">
        <span class="ve-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M5 4h11l3 3v13H5z" /><path d="M8 4v5h7V4M8 20v-6h8v6" /></svg></span>
        <div>
          <h2 class="ve-titulo" id="ve-t-guardar">¡Todo listo para guardar!</h2>
          <p class="ve-texto">Vas a guardar {{ d.cambios === 1 ? '1 campo' : d.cambios + ' campos' }} de {{ d.slep }} · {{ d.mes }} {{ d.anio }}. Si quieres darles una última mirada, todavía estás a tiempo.</p>
        </div>
      </div>
      <dl class="ve-resumen">
        <dt>Servicio Local</dt><dd>{{ d.slep }}</dd>
        <dt>Mes</dt><dd>{{ d.mes }} {{ d.anio }}</dd>
        <dt>Campos con cambios</dt><dd>{{ d.cambios }}</dd>
      </dl>
      <div class="ve-botones">
        <button type="button" class="ve-btn" (click)="ref.close(false)">Seguir revisando</button>
        <button type="button" class="ve-btn principal" (click)="ref.close(true)">Sí, guardar</button>
      </div>
    </div>
  `,
})
export class ConfirmarGuardarDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) readonly d: ConfirmarGuardarData, readonly ref: MatDialogRef<ConfirmarGuardarDialogComponent, boolean>) {}
}

// ---------- 2. Cargar datos: mes anterior o archivo ----------
export interface CargarDatosData {
  slep: string;
  // El mes anterior con datos de este SLEP (null: no hay; "motivo" explica por qué).
  anterior: { mes: string; anio: string; campos: number } | null;
  motivo: string;
}
export type CargarDatosResultado = { tipo: 'anterior' } | { tipo: 'archivo'; archivo: File };

@Component({
  selector: 'app-cargar-datos',
  standalone: true,
  template: `
    <div class="ve" role="dialog" aria-labelledby="ve-t-cargar">
      <div class="ve-cab">
        <span class="ve-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14" /></svg></span>
        <div>
          <h2 class="ve-titulo" id="ve-t-cargar">¿Cómo quieres cargar los datos?</h2>
          <p class="ve-texto">Elige la forma que más te acomode para {{ d.slep }}. Nada se guarda hasta que presiones «Guardar».</p>
        </div>
      </div>
      <div class="ve-opciones">
        <!-- Mes anterior -->
        <button type="button" class="ve-opcion" [class.desactivada]="!d.anterior" [attr.aria-disabled]="!d.anterior" (click)="d.anterior && ref.close({ tipo: 'anterior' })">
          <span class="ve-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16M9 15l2 2 4-4" /></svg></span>
          <span>
            <b>Cargar datos del mes anterior{{ d.anterior ? ' (' + d.anterior.mes + ' ' + d.anterior.anio + ')' : '' }}</b>
            <p>Parte con los datos que se guardaron {{ d.anterior ? 'en ' + d.anterior.mes.toLowerCase() : 'el mes anterior' }} y cambia solo lo que se movió este mes. ¡Te ahorra bastante tiempo!</p>
            @if (!d.anterior) { <small>{{ d.motivo }}</small> }
          </span>
        </button>
        <!-- Archivo: el selector de archivos se abre desde la misma ventana. -->
        <label class="ve-opcion" tabindex="0" (keydown.enter)="selector.click()" (keydown.space)="$event.preventDefault(); selector.click()">
          <span class="ve-ico verde" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M9.5 12l5 5M14.5 12l-5 5" /></svg></span>
          <span>
            <b>Cargar archivo con datos (Excel)</b>
            <p>Para que la carga salga a la primera, revisa que tu Excel esté limpio:</p>
            <ul class="ve-lista">
              <li>Solo archivos .xlsx, con los datos en la primera hoja.</li>
              <li>Fila 1: las preguntas del formulario, sin columnas extra ni repetidas.</li>
              <li>Fila 2: los datos de tu SLEP (una sola fila).</li>
              <li>Sin filas ni columnas ocultas, sin celdas combinadas y sin filtros.</li>
              <li>Sin fórmulas con error (#¡REF!, #N/A…) y solo números: 1500, no «1.500 casos».</li>
            </ul>
          </span>
          <input #selector type="file" accept=".xlsx" hidden (change)="elegirArchivo($event)" />
        </label>
      </div>
      <div class="ve-botones">
        <button type="button" class="ve-btn" (click)="ref.close()">Ahora no</button>
      </div>
    </div>
  `,
})
export class CargarDatosDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) readonly d: CargarDatosData, readonly ref: MatDialogRef<CargarDatosDialogComponent, CargarDatosResultado>) {}

  elegirArchivo(e: Event): void {
    const input = e.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (archivo) this.ref.close({ tipo: 'archivo', archivo });
  }
}

// ---------- 3. Problemas del archivo ----------
export interface ProblemasArchivoData {
  nombreArchivo: string;
  problemas: { titulo: string; detalle: string; solucion: string }[];
}

@Component({
  selector: 'app-problemas-archivo',
  standalone: true,
  template: `
    <div class="ve" role="dialog" aria-labelledby="ve-t-problemas">
      <div class="ve-cab">
        <span class="ve-ico alerta" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 3 20h18z" /><path d="M12 10v4M12 17v.01" /></svg></span>
        <div>
          <h2 class="ve-titulo" id="ve-t-problemas">Ya casi está</h2>
          <p class="ve-texto">Encontramos {{ d.problemas.length === 1 ? 'un detalle' : d.problemas.length + ' detalles' }} en «{{ d.nombreArchivo }}». Corrígelos y vuelve a cargarlo; todavía no se cargó ningún dato.</p>
        </div>
      </div>
      <div class="ve-problemas">
        @for (p of d.problemas; track p.titulo) {
          <div class="ve-problema">
            <b>{{ p.titulo }}</b>
            <p>{{ p.detalle }}</p>
            <p class="como">Cómo resolverlo: {{ p.solucion }}</p>
          </div>
        }
      </div>
      <div class="ve-botones">
        <button type="button" class="ve-btn principal" (click)="ref.close()">Entendido</button>
      </div>
    </div>
  `,
})
export class ProblemasArchivoDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) readonly d: ProblemasArchivoData, readonly ref: MatDialogRef<ProblemasArchivoDialogComponent>) {}
}
