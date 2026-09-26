import { Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Observable, Subscription } from 'rxjs';
import { MensajeCampo, MensajesService, TipoReaccion } from '../../../core/services/mensajes.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/confirm-dialog/confirm-dialog.component';

// Conversación de UN campo de UN formulario (mejora post-v2.23), dentro
// del Inspector de Campo. Estilo tablón de publicaciones (no es en vivo):
// se carga al abrir el campo. Toda acción recibe del servidor la
// conversación ya actualizada y solo reemplaza la lista — las reglas
// (quién puede editar/borrar, "una sola vez") viven en el backend.
@Component({
  selector: 'app-field-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './field-chat.component.html',
  styles: [`
    .reaccion {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 13px; line-height: 1; padding: 3px 8px;
      border-radius: 999px; border: 1px solid rgba(100, 116, 139, 0.28);
      background: transparent; cursor: pointer;
      transition: transform 0.12s ease, background 0.2s ease, border-color 0.2s ease;
    }
    .reaccion:hover:not(:disabled) { transform: scale(1.08); }
    .reaccion:disabled { cursor: default; opacity: 0.6; }
    .reaccion--mia { background: rgba(59, 130, 246, 0.16); border-color: rgba(59, 130, 246, 0.6); }
    .mensaje { transition: box-shadow 0.3s ease; }
    .mensaje--resaltado { box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.65); }
    .inicial {
      width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 600; color: #fff;
      background: linear-gradient(135deg, #3B5BA9, #1E3A8A);
    }
  `],
})
export class FieldChatComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) contenedorId!: string;
  @Input({ required: true }) preguntaId!: string;
  @ViewChild('cajaTexto') private cajaTexto?: ElementRef<HTMLTextAreaElement>;

  readonly reacciones: { tipo: TipoReaccion; emoji: string; etiqueta: string }[] = [
    { tipo: 'corazon', emoji: '❤️', etiqueta: 'Me encanta' },
    { tipo: 'like', emoji: '👍', etiqueta: 'Me gusta' },
    { tipo: 'feliz', emoji: '😊', etiqueta: 'Me alegra' },
  ];
  readonly largoMaximo = 2000;

  mensajes: MensajeCampo[] = [];
  cargando = false;
  ocupado = false;
  texto = '';
  respondiendoA: MensajeCampo | null = null;
  editandoId: string | null = null;
  textoEdicion = '';
  resaltadoId: string | null = null;
  private carga?: Subscription;

  constructor(
    private readonly mensajesService: MensajesService,
    private readonly authService: AuthService,
    private readonly notification: NotificationService,
    private readonly dialog: MatDialog,
  ) {}

  get esSuperadmin(): boolean {
    return !!this.authService.usuarioActual()?.esSuperadmin;
  }

  // Cambió el campo o el formulario: se carga su conversación (y el
  // servidor la marca como leída, lo que apaga su burbuja).
  ngOnChanges(): void {
    this.texto = '';
    this.respondiendoA = null;
    this.cancelarEdicion();
    this.mensajes = [];
    this.cargando = true;
    this.carga?.unsubscribe();
    this.carga = this.mensajesService.listar(this.contenedorId, this.preguntaId).subscribe({
      next: (lista) => {
        this.mensajes = lista;
        this.cargando = false;
      },
      error: (err) => {
        this.cargando = false;
        this.avisarError(err, 'No se pudo cargar la conversación.');
      },
    });
  }

  ngOnDestroy(): void {
    this.carga?.unsubscribe();
  }

  enviar(): void {
    const texto = this.texto.trim();
    if (!texto || this.ocupado) return;
    this.ejecutar(this.mensajesService.crear(this.contenedorId, this.preguntaId, texto, this.respondiendoA?.id ?? null), () => {
      this.texto = '';
      this.respondiendoA = null;
    });
  }

  responder(m: MensajeCampo): void {
    this.respondiendoA = m;
    this.cajaTexto?.nativeElement.focus();
  }

  iniciarEdicion(m: MensajeCampo): void {
    this.editandoId = m.id;
    this.textoEdicion = m.texto ?? '';
  }

  cancelarEdicion(): void {
    this.editandoId = null;
    this.textoEdicion = '';
  }

  // Si el texto no cambió, solo se cierra: no se gasta la única edición.
  guardarEdicion(m: MensajeCampo): void {
    const texto = this.textoEdicion.trim();
    if (!texto || texto === m.texto) return this.cancelarEdicion();
    this.ejecutar(this.mensajesService.editar(this.contenedorId, this.preguntaId, m.id, texto), () => this.cancelarEdicion());
  }

  borrar(m: MensajeCampo): void {
    const data: ConfirmDialogData = {
      titulo: 'Borrar mensaje',
      mensaje:
        'El mensaje se mostrará como "Mensaje eliminado" para todos.' +
        (this.esSuperadmin ? '' : '\nEs tu única edición o borrado permitido para este mensaje.'),
      textoConfirmar: 'Borrar',
      peligroso: true,
    };
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, { width: '420px', data })
      .afterClosed()
      .subscribe((confirmado) => {
        if (confirmado) this.ejecutar(this.mensajesService.borrar(this.contenedorId, this.preguntaId, m.id));
      });
  }

  reaccionar(m: MensajeCampo, tipo: TipoReaccion): void {
    if (this.ocupado) return;
    this.ejecutar(this.mensajesService.reaccionar(this.contenedorId, this.preguntaId, m.id, tipo));
  }

  // Al tocar una cita, se lleva la vista al mensaje original y se resalta
  // un momento, para seguir el hilo.
  irAMensaje(id: string): void {
    const destino = document.getElementById(`msg-${id}`);
    if (!destino) return;
    destino.scrollIntoView({ behavior: 'smooth', block: 'center' });
    this.resaltadoId = id;
    setTimeout(() => {
      if (this.resaltadoId === id) this.resaltadoId = null;
    }, 1600);
  }

  inicial(nombre: string): string {
    return (nombre.trim()[0] ?? '?').toUpperCase();
  }

  private ejecutar(peticion: Observable<MensajeCampo[]>, alTerminar?: () => void): void {
    this.ocupado = true;
    peticion.subscribe({
      next: (lista) => {
        this.mensajes = lista;
        this.ocupado = false;
        alTerminar?.();
      },
      error: (err) => {
        this.ocupado = false;
        this.avisarError(err, 'No se pudo completar la acción.');
      },
    });
  }

  private avisarError(err: { error?: { message?: string | string[] } }, porDefecto: string): void {
    const mensaje = err?.error?.message;
    this.notification.mostrar((Array.isArray(mensaje) ? mensaje[0] : mensaje) ?? porDefecto, 6000);
  }
}
