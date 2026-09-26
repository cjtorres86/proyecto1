import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

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

  constructor(private readonly http: HttpClient) {}

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

  listar(contenedorId: string, preguntaId: string): Observable<MensajeCampo[]> {
    return this.leido(contenedorId, preguntaId, this.http.get<MensajeCampo[]>(this.base(contenedorId), { params: { pregunta: preguntaId } }));
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
