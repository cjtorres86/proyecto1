import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap, filter, take } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CaseStateService } from './case-state.service';
import { WorkspaceModeService } from './workspace-mode.service';

export type TipoReaccion = 'corazon' | 'like' | 'feliz';

// Tal como lo entrega el backend (MensajesService.aVista): los permisos
// (puedeModificar) ya vienen calculados por el servidor.
export interface MensajeCampo {
  id: string;
  texto: string | null;
  autor: { nombre: string; perfil: string };
  esMio: boolean;
  creadoEn: string;
  editado: boolean;
  eliminado: boolean;
  respuestaA: { id: string; autor: string; texto: string | null; eliminado: boolean } | null;
  reacciones: Record<TipoReaccion, { total: number; mia: boolean }>;
  puedeModificar: boolean;
}

// Chat por campo (mejora post-v2.23). Un solo servicio para las dos
// cosas que necesita la interfaz: hablar con el backend y llevar los
// contadores de "no leídos" del formulario abierto (las burbujas rojas
// del panel Formulario). No es en vivo: los contadores se cargan al abrir
// un formulario y al volver a la pestaña.
//
// Todas las operaciones devuelven la conversación completa ya
// actualizada; como el servidor la marca como leída al entregarla, el
// campo deja de contar como "no leído" apenas se ve.
@Injectable({ providedIn: 'root' })
export class MensajesService {
  private readonly noLeidosSubject = new BehaviorSubject<Record<string, number>>({});
  readonly noLeidos$ = this.noLeidosSubject.asObservable();
  private contenedorActual: string | null = null;

  constructor(
    private readonly http: HttpClient,
    private readonly caseState: CaseStateService,
    private readonly workspaceMode: WorkspaceModeService,
    private readonly router: Router,
  ) {}

  // Aviso al iniciar sesión (mejora post-v2.23): si hay un mensaje sin
  // leer en cualquier parte del sistema, elige su mes, su SLEP y su
  // campo, cambia a modo Formulario (donde vive el Inspector con el
  // chat) y lleva a la persona directo ahí. Si no hay nada nuevo, no
  // toca nada — el sistema arranca como siempre. Se llama desde el login
  // y desde la restauración de sesión al recargar la página (F9 en
  // app.config.ts), para que valga en los dos casos.
  irANoLeidoSiExiste(): void {
    this.buscarProximoNoLeido().subscribe((proximo) => {
      if (!proximo) return;
      this.caseState.setMesActivo({ mes: proximo.mes, anio: proximo.anio });
      // Los contenedores del mes recién elegido llegan async — se espera
      // la primera lista con datos para encontrar el id del SLEP buscado
      // (setSlepActivo necesita el id, el aviso solo trae el nombre).
      this.caseState.contenedores$
        .pipe(
          filter((lista) => lista.length > 0),
          take(1),
        )
        .subscribe((lista) => {
          const contenedor = lista.find((c) => c.slep === proximo.slep);
          if (!contenedor) return;
          this.caseState.setSlepActivo(contenedor.id);
          this.caseState.setCampoActivo(proximo.preguntaId);
          this.workspaceMode.irA('formulario');
          this.router.navigate(['/']);
        });
    });
  }

  // Carga los contadores del formulario abierto (null = ninguno abierto,
  // o el "Total general", que no tiene chat).
  cargarNoLeidos(contenedorId: string | null): void {
    this.contenedorActual = contenedorId;
    if (!contenedorId) {
      this.noLeidosSubject.next({});
      return;
    }
    this.http.get<Record<string, number>>(`${this.base(contenedorId)}/no-leidos`).subscribe({
      // Si mientras tanto se abrió otro formulario, esta respuesta ya no aplica.
      next: (conteos) => { if (this.contenedorActual === contenedorId) this.noLeidosSubject.next(conteos); },
      error: () => this.noLeidosSubject.next({}),
    });
  }

  // De solo lectura, NO marca nada como leído (mejora post-v2.23) — ver
  // marcarLeido, la acción explícita.
  listar(contenedorId: string, preguntaId: string): Observable<MensajeCampo[]> {
    return this.http.get<MensajeCampo[]>(this.base(contenedorId), { params: { pregunta: preguntaId } });
  }

  // Marca la conversación como leída — se llama ante una interacción real
  // (tocar un mensaje, responder, empezar a escribir), nunca con solo
  // abrir el campo (eso lo hace listar(), que ya no marca nada).
  marcarLeido(contenedorId: string, preguntaId: string): void {
    const actuales = this.noLeidosSubject.value;
    if (contenedorId !== this.contenedorActual || !actuales[preguntaId]) return;
    this.http.post(`${this.base(contenedorId)}/marcar-leido`, {}, { params: { pregunta: preguntaId } }).subscribe({
      next: () => {
        const { [preguntaId]: _, ...resto } = this.noLeidosSubject.value;
        this.noLeidosSubject.next(resto);
      },
    });
  }

  // Aviso al iniciar sesión (mejora post-v2.23): el mensaje sin leer más
  // reciente en cualquier SLEP y mes al que la persona tenga acceso.
  buscarProximoNoLeido(): Observable<{ mes: string; anio: string; slep: string; preguntaId: string } | null> {
    return this.http.get<{ mes: string; anio: string; slep: string; preguntaId: string } | null>(
      `${environment.apiUrl}/mensajes/proximo-no-leido`,
    );
  }

  crear(contenedorId: string, preguntaId: string, texto: string, respuestaAId: string | null): Observable<MensajeCampo[]> {
    const cuerpo = respuestaAId ? { preguntaId, texto, respuestaAId } : { preguntaId, texto };
    return this.leido(contenedorId, preguntaId, this.http.post<MensajeCampo[]>(this.base(contenedorId), cuerpo));
  }

  editar(contenedorId: string, preguntaId: string, mensajeId: string, texto: string): Observable<MensajeCampo[]> {
    return this.leido(contenedorId, preguntaId, this.http.patch<MensajeCampo[]>(`${this.base(contenedorId)}/${mensajeId}`, { texto }));
  }

  borrar(contenedorId: string, preguntaId: string, mensajeId: string): Observable<MensajeCampo[]> {
    return this.leido(contenedorId, preguntaId, this.http.delete<MensajeCampo[]>(`${this.base(contenedorId)}/${mensajeId}`));
  }

  reaccionar(contenedorId: string, preguntaId: string, mensajeId: string, tipo: TipoReaccion): Observable<MensajeCampo[]> {
    return this.leido(contenedorId, preguntaId, this.http.post<MensajeCampo[]>(`${this.base(contenedorId)}/${mensajeId}/reacciones`, { tipo }));
  }

  private base(contenedorId: string): string {
    return `${environment.apiUrl}/cases/${contenedorId}/mensajes`;
  }

  // Tras cualquier respuesta exitosa, el campo ya fue visto: se apaga su
  // burbuja (el servidor ya lo marcó como leído).
  private leido(contenedorId: string, preguntaId: string, peticion: Observable<MensajeCampo[]>): Observable<MensajeCampo[]> {
    return peticion.pipe(
      tap(() => {
        const actuales = this.noLeidosSubject.value;
        if (contenedorId !== this.contenedorActual || !actuales[preguntaId]) return;
        const { [preguntaId]: _, ...resto } = actuales;
        this.noLeidosSubject.next(resto);
      }),
    );
  }
}
