import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { WorkspaceModeService } from '../../../core/services/workspace-mode.service';
import { MensajesService } from '../../../core/services/mensajes.service';
import { ThemeToggleComponent } from '../../../shared/theme-toggle/theme-toggle.component';

// Login en 2 zonas (mejora post-v2.23):
//
// ARRIBA — ClaveÚnica, solo como vista previa: campos y botón
// desactivados, marcados "Próximamente". Todavía no hay integración.
// Nota para cuando se integre de verdad: según la guía técnica oficial
// de la Secretaría de Gobierno Digital, el RUT y la clave se ingresan
// en el sitio de ClaveÚnica (redirección a pantalla completa), nunca en
// un formulario propio — estos campos se reemplazarán por el botón
// oficial que redirige, requisito de certificación.
//
// ABAJO — el acceso actual con usuario del sistema, sin cambios de
// funcionamiento.
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, ThemeToggleComponent],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  readonly form;
  readonly claveUnicaForm;
  cargando = false;
  // Pasa a false si frontend/public/claveunica.svg no existe todavía —
  // la plantilla muestra entonces el nombre en texto simple.
  logoClaveUnicaDisponible = true;

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly notification: NotificationService,
    private readonly workspaceMode: WorkspaceModeService,
    private readonly router: Router,
    private readonly mensajes: MensajesService,
  ) {
    this.form = this.fb.group({
      usuario: ['', Validators.required],
      contrasena: ['', Validators.required],
    });
    // Desactivados desde el origen (no solo con CSS): no se pueden
    // escribir ni enviar mientras la integración no exista.
    this.claveUnicaForm = this.fb.group({
      rut: [{ value: '', disabled: true }],
      clave: [{ value: '', disabled: true }],
    });
  }

  enviar(): void {
    if (this.form.invalid) return;
    this.cargando = true;
    const { usuario, contrasena } = this.form.getRawValue();
    this.authService.login(usuario!, contrasena!).subscribe({
      next: (res) => {
        this.workspaceMode.fijarModoPorDefecto(res.usuario);
        this.notification.mostrar(`¡Hola ${usuario}! Ponte casco y cinturón de seguridad, ¡aquí vamos!`);
        this.router.navigate(['/']);
        // Si hay un mensaje sin leer en cualquier parte del sistema, esto
        // la reemplaza por la navegación directa a donde está.
        this.mensajes.irANoLeidoSiExiste();
      },
      error: () => {
        this.cargando = false;
        this.notification.mostrar('Usuario o contraseña incorrectos.');
      },
    });
  }
}
