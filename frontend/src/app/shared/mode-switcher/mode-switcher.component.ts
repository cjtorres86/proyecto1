import { AuthService } from '../../core/services/auth.service';
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModoWorkspace, WorkspaceModeService } from '../../core/services/workspace-mode.service';

// Reemplaza el botón único "Ver Dashboard" / "Ver Formulario" de antes
// — con 3 modos ya no alcanza un solo botón que solo sabe apuntar "al
// otro lado". Un componente compartido en vez de repetir el markup en
// los 3 paneles (Inspector de Campo, Dashboard, Histórico); el modo
// activo se pasa por @Input (cada panel sabe cuál es el suyo) y se
// resalta sólido, los otros 2 quedan en el mismo estilo que "Cargar
// Datos" (borde azul, texto azul).
@Component({
  selector: 'app-mode-switcher',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex gap-1">
      @for (opcion of opciones; track opcion.modo) {
        <button
          class="text-xs rounded px-2 py-1 border border-blue-800"
          [class.bg-blue-800]="opcion.modo === modoActivo"
          [class.text-white]="opcion.modo === modoActivo"
          [class.text-blue-800]="opcion.modo !== modoActivo"
          (click)="workspaceMode.irA(opcion.modo)"
        >
          {{ opcion.etiqueta }}
        </button>
      }
    </div>
  `,
})
export class ModeSwitcherComponent {
  @Input({ required: true }) modoActivo!: ModoWorkspace;

  private readonly todas: { modo: ModoWorkspace; etiqueta: string; permiso?: string }[] = [
    { modo: 'formulario', etiqueta: 'Formulario' },
    { modo: 'dashboard-ampliado', etiqueta: 'Dashboard', permiso: 'dashboard' },
    { modo: 'historico', etiqueta: 'Histórico', permiso: 'historico' },
  ];

  // Solo los modos que el perfil permite (Panel de avance, Histórico).
  get opciones() {
    return this.todas.filter((o) => !o.permiso || this.authService.can(o.permiso));
  }

  constructor(
    readonly workspaceMode: WorkspaceModeService,
    private readonly authService: AuthService,
  ) {}
}
