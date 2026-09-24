import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Usuario, Perfil } from '../../../core/models/user.model';

@Injectable({ providedIn: 'root' })
export class UsersApiService {
  constructor(private readonly http: HttpClient) {}

  listarUsuarios(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(`${environment.apiUrl}/users`);
  }

  crearUsuario(dto: { usuario: string; contrasena: string; nombreParaMostrar: string; alcance: string; perfilId?: string; esSuperadmin?: boolean }): Observable<Usuario> {
    return this.http.post<Usuario>(`${environment.apiUrl}/users`, dto);
  }

  actualizarUsuario(id: string, dto: Partial<{ contrasena: string; nombreParaMostrar: string; alcance: string; perfilId: string }>): Observable<Usuario> {
    return this.http.patch<Usuario>(`${environment.apiUrl}/users/${id}`, dto);
  }

  listarPerfiles(): Observable<Perfil[]> {
    return this.http.get<Perfil[]>(`${environment.apiUrl}/perfiles`);
  }

  crearPerfil(dto: { id: string; nombre: string; vistas: string[]; acciones: string[]; gestion: string[] }): Observable<Perfil> {
    return this.http.post<Perfil>(`${environment.apiUrl}/perfiles`, dto);
  }
}
