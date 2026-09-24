import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Usuario } from '../models/user.model';

export type ModoWorkspace = 'formulario' | 'dashboard-ampliado' | 'historico';

// Alternar vista (TDD, sección 7.8) — un servicio de estado más, mismo
// patrón que CaseStateService: nadie llama a un _renderX(), los
// componentes se suscriben a modo$ y Angular actualiza solo.
@Injectable({ providedIn: 'root' })
export class WorkspaceModeService {
  private readonly modoSubject = new BehaviorSubject<ModoWorkspace>('formulario');
  readonly modo$ = this.modoSubject.asObservable();

  irA(modo: ModoWorkspace): void {
    this.modoSubject.next(modo);
  }

  // Modo por defecto según perfil (TDD v2.17, sección 7.8): Admin y el
  // superadmin arrancan en Dashboard ampliado; Validador y Digitador
  // arrancan en Formulario.
  fijarModoPorDefecto(usuario: Usuario): void {
    const esAdmin = usuario.esSuperadmin || usuario.perfil?.id === 'perfil_admin';
    this.modoSubject.next(esAdmin ? 'dashboard-ampliado' : 'formulario');
  }
}
