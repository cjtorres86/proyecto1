import { Component, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { ReportsApiService } from '../services/reports-api.service';
import { environment } from '../../../../environments/environment';

// Descarga directa de un Excel (?archivo=consolidado-mes | consolidado-slep):
// la usa el asistente del portal, que no puede descargar archivos de Sumarios
// por sí mismo. Mismos permisos que el botón Descargar (los verifica el servidor).
const ARCHIVOS: Record<string, { nombre: string; titulo: string; pedir: (api: ReportsApiService) => Observable<Blob> }> = {
  'consolidado-mes': { nombre: 'Informe consolidado de datos por mes.xlsx', titulo: 'Informe consolidado de datos por mes', pedir: (api) => api.descargarExcelGeneral() },
  'consolidado-slep': { nombre: 'Informe consolidado de datos por SLEP.xlsx', titulo: 'Informe consolidado de datos por SLEP', pedir: (api) => api.descargarExcelPorSlep() },
};

@Component({
  selector: 'app-descarga',
  standalone: true,
  template: `
    <main class="min-h-full flex items-center justify-center bg-[#EDF1F7] dark:bg-[#0B1120] px-4 py-10">
      <div class="w-full max-w-[440px] rounded-lg border border-[#D9E0EA] dark:border-[#28324A] border-t-4 border-t-[#1E3A8A] bg-white dark:bg-[#141B2E] p-6 text-center">
        <h1 class="text-[20px] font-medium text-[#1E3A8A] dark:text-[#8FB2F5]">{{ titulo() }}</h1>
        @switch (estado()) {
          @case ('descargando') { <p class="mt-3 text-sm text-[#475569] dark:text-[#94A3B8]" role="status">Preparando el archivo…</p> }
          @case ('listo') { <p class="mt-3 text-sm text-[#475569] dark:text-[#94A3B8]" role="status">Listo: el archivo se descargó. Ya puedes cerrar esta pestaña.</p> }
          @default { <p class="mt-3 text-sm font-medium text-[#B4112B]" role="alert">{{ error() }}</p> }
        }
        <a [href]="urlPortal" class="mt-5 inline-flex w-full items-center justify-center rounded-md border border-[#1E3A8A] px-4 py-2.5 text-sm font-medium text-[#1E3A8A] hover:bg-[#EDF1F7] dark:text-[#8FB2F5]">Volver al portal</a>
      </div>
    </main>
  `,
})
export class DescargaComponent implements OnInit {
  readonly urlPortal = environment.portalUrl;
  readonly titulo = signal('Descarga');
  readonly estado = signal<'descargando' | 'listo' | 'error'>('descargando');
  readonly error = signal('');

  constructor(
    private readonly ruta: ActivatedRoute,
    private readonly api: ReportsApiService,
  ) {}

  ngOnInit(): void {
    const archivo = ARCHIVOS[this.ruta.snapshot.queryParamMap.get('archivo') ?? ''];
    if (!archivo) {
      this.estado.set('error');
      this.error.set('Ese archivo no existe.');
      return;
    }
    this.titulo.set(archivo.titulo);
    archivo.pedir(this.api).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = archivo.nombre;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        this.estado.set('listo');
      },
      error: (err: HttpErrorResponse) => {
        this.estado.set('error');
        this.error.set(err.status === 403 ? 'Tu perfil no permite descargar este archivo.' : 'No se pudo descargar el archivo. Vuelve a intentarlo.');
      },
    });
  }
}
