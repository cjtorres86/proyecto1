import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface RegistroBitacora {
  id: string;
  usuarioNombre: string;
  perfilNombre: string;
  ip: string;
  accion: string;
  descripcion: string;
  detalle: Record<string, unknown> | null;
  creadoEn: string;
}

export interface FiltrosBitacora {
  usuarioId?: string;
  accion?: string;
  desde?: string;
  hasta?: string;
  texto?: string;
  pagina: number;
  porPagina: number;
}

@Injectable({ providedIn: 'root' })
export class BitacoraApiService {
  constructor(private readonly http: HttpClient) {}

  listar(filtros: FiltrosBitacora): Observable<{ filas: RegistroBitacora[]; total: number }> {
    const params: Record<string, string> = { pagina: String(filtros.pagina), porPagina: String(filtros.porPagina) };
    if (filtros.usuarioId) params['usuarioId'] = filtros.usuarioId;
    if (filtros.accion) params['accion'] = filtros.accion;
    if (filtros.desde) params['desde'] = filtros.desde;
    if (filtros.hasta) params['hasta'] = filtros.hasta;
    if (filtros.texto) params['texto'] = filtros.texto;
    return this.http.get<{ filas: RegistroBitacora[]; total: number }>(`${environment.apiUrl}/bitacora`, { params });
  }

  // Acciones que ocurren enteras en el navegador (ver RegistrarEventoDto
  // en el backend — la lista de "accion" permitidas está fija ahí, no
  // acá, para que el frontend no pueda inventar tipos nuevos).
  registrarEvento(accion: 'informe_visto' | 'informe_pdf_descargado', descripcion: string): void {
    this.http.post(`${environment.apiUrl}/bitacora/evento`, { accion, descripcion }).subscribe({ error: () => undefined });
  }
}
