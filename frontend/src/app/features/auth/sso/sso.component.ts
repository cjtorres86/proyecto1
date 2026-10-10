import { Component, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

// Ingreso único: el portal GDP-SLEP Studio abre esta página con un pase de un
// solo uso (?pase=...). Se canjea con el servidor y se entra sin pedir clave.
@Component({
  selector: 'app-sso',
  standalone: true,
  template: `
    <main class="min-h-full flex items-center justify-center bg-[#EDF1F7] dark:bg-[#0B1120] px-4 py-10">
      <div class="w-full max-w-[420px] rounded-lg border border-[#D9E0EA] dark:border-[#28324A] border-t-4 border-t-[#1E3A8A] bg-white dark:bg-[#141B2E] p-6 text-center">
        <h1 class="text-[22px] font-medium text-[#1E3A8A] dark:text-[#8FB2F5]">Avance de Sumarios</h1>
        @if (!error()) {
          <p class="mt-3 text-sm text-[#475569] dark:text-[#94A3B8]" role="status">Entrando desde el portal…</p>
          <p class="mt-1 text-xs text-[#64748B]">Si el sistema estuvo un rato sin uso, puede tardar hasta un minuto.</p>
        } @else {
          <p class="mt-3 text-sm font-medium text-[#B4112B]" role="alert">{{ error() }}</p>
          <a [href]="urlPortal" class="mt-5 inline-flex w-full items-center justify-center rounded-md bg-[#1E3A8A] px-4 py-3 text-sm font-medium text-white hover:bg-[#006BB9]">Volver al portal</a>
        }
      </div>
    </main>
  `,
})
export class SsoComponent implements OnInit {
  readonly urlPortal = environment.portalUrl;
  readonly error = signal('');

  constructor(
    private readonly ruta: ActivatedRoute,
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    const pase = this.ruta.snapshot.queryParamMap.get('pase');
    if (!pase) {
      this.error.set('Falta el pase de ingreso. Entra a Avance de Sumarios desde el portal.');
      return;
    }
    this.auth.ingresarConPase(pase).subscribe({
      // replaceUrl: el pase no queda en el historial del navegador.
      next: () => this.router.navigateByUrl('/', { replaceUrl: true }),
      error: (err: HttpErrorResponse) =>
        this.error.set(
          err.status === 0
            ? 'No se pudo contactar al servidor. Espera un minuto y vuelve a entrar desde el portal.'
            : (err.error?.message ?? 'No se pudo entrar. Vuelve a intentarlo desde el portal.'),
        ),
    });
  }
}
