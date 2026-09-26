import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type Tema = 'claro' | 'oscuro';
const CLAVE_LOCALSTORAGE = 'avance-sumarios-tema';

// Modo oscuro (mejora post-v2.23, fase 2). La clase "dark" en <html> es
// la ÚNICA fuente de verdad — Angular Material (styles.scss, bloque
// .dark), PrimeNG (darkModeSelector: '.dark' en app.config.ts) y
// Tailwind (@custom-variant dark, tailwind.css) reaccionan todos a ESA
// MISMA clase, nunca cada uno por su cuenta, para que nunca puedan
// desincronizarse entre sí — el problema real que tuvimos antes era
// justo eso, con PrimeNG decidiendo su modo oscuro por su cuenta.
//
// index.html trae un script chico que aplica la clase ANTES de que
// Angular arranque (evita el parpadeo de un tema equivocado apenas
// carga la página) — este servicio, al construirse, LEE ese estado ya
// puesto (no lo vuelve a aplicar), y desde ahí administra los cambios
// futuros.
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly temaSubject = new BehaviorSubject<Tema>(
    document.documentElement.classList.contains('dark') ? 'oscuro' : 'claro',
  );
  readonly tema$ = this.temaSubject.asObservable();

  get esOscuro(): boolean {
    return this.temaSubject.value === 'oscuro';
  }

  alternar(): void {
    this.aplicar(this.esOscuro ? 'claro' : 'oscuro');
  }

  // Fuerza el modo claro sin tocar la preferencia guardada — la usa el
  // Informe/PDF (informe.component.ts), que siempre debe verse igual sin
  // importar el tema que tenga elegido quien lo mire.
  forzarClaroSinGuardar(): void {
    document.documentElement.classList.remove('dark');
  }

  private aplicar(tema: Tema): void {
    document.documentElement.classList.toggle('dark', tema === 'oscuro');
    try {
      localStorage.setItem(CLAVE_LOCALSTORAGE, tema);
    } catch {
      // Almacenamiento no disponible (navegación privada, cuota llena…):
      // el tema sigue funcionando para esta sesión, solo no se recuerda.
    }
    this.temaSubject.next(tema);
  }
}
