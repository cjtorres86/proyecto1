import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../core/services/theme.service';

// Interruptor claro/oscuro (mejora post-v2.23, fase 2) — un <button
// role="switch">, no un mat-slide-toggle genérico: pista en forma de
// píldora con degradé (cielo→dorado en claro, pizarra→índigo en
// oscuro) y una burbuja que se desliza con un rebote sutil, mostrando
// el sol o la luna (PrimeIcons, sin depender de íconos externos que la
// red corporativa pueda bloquear). Ningún elemento nuevo además del
// botón: fácil de ubicar junto a cualquier otro control.
@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      type="button"
      role="switch"
      class="interruptor-tema"
      [class.interruptor-tema--oscuro]="theme.esOscuro"
      [attr.aria-checked]="theme.esOscuro"
      [attr.aria-label]="theme.esOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
      [title]="theme.esOscuro ? 'Modo oscuro activado' : 'Modo claro activado'"
      (click)="theme.alternar()"
    >
      <span class="interruptor-tema__burbuja">
        <i class="pi" [class.pi-sun]="!theme.esOscuro" [class.pi-moon]="theme.esOscuro"></i>
      </span>
    </button>
  `,
  styles: [`
    .interruptor-tema {
      position: relative;
      width: 50px;
      height: 27px;
      padding: 0;
      border: none;
      border-radius: 999px;
      cursor: pointer;
      flex-shrink: 0;
      background: linear-gradient(135deg, #7DD3FC 0%, #FDE68A 100%);
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.15);
      transition: background 0.45s ease;
    }
    .interruptor-tema--oscuro {
      background: linear-gradient(135deg, #1E2A4A 0%, #4338CA 100%);
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.4);
    }
    .interruptor-tema__burbuja {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 21px;
      height: 21px;
      border-radius: 50%;
      background: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
      transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.4s ease;
    }
    .interruptor-tema--oscuro .interruptor-tema__burbuja {
      transform: translateX(23px);
      background: #1E2A4A;
    }
    .interruptor-tema__burbuja i {
      font-size: 11px;
      color: #F59E0B;
      transition: color 0.3s ease;
    }
    .interruptor-tema--oscuro .interruptor-tema__burbuja i {
      color: #C7D2FE;
    }
    .interruptor-tema:focus-visible {
      outline: 2px solid #7DA6F5;
      outline-offset: 2px;
    }
  `],
})
export class ThemeToggleComponent {
  constructor(readonly theme: ThemeService) {}
}
