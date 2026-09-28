import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface ErrorFila { slep: string; campo: string; formula: string; mensaje: string; valorIngresado: string }

// Ranking Interactivo: el detalle completo de UN SLEP para su tooltip.
export interface RankingDetalleFila {
  slep: string;
  pct: number | null;
  campos: { numero: number; nombre: string; valor: string }[];
}

@Injectable({ providedIn: 'root' })
export class ReportsApiService {
  constructor(private readonly http: HttpClient) {}

  descargarExcelGeneral(): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/reports/excel/general`, { responseType: 'blob' });
  }

  descargarExcelPorSlep(): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/reports/excel/por-slep`, { responseType: 'blob' });
  }

  listarErrores(mes: string, anio: string, slep?: string): Observable<ErrorFila[]> {
    const params: Record<string, string> = { mes, anio };
    if (slep) params['slep'] = slep;
    return this.http.get<ErrorFila[]>(`${environment.apiUrl}/cases/errores`, { params });
  }

  // Ranking Interactivo (mejora post-v2.23): el ranking del mes con el
  // detalle completo de cada SLEP, de una sola vez — alimenta los
  // tooltips sin pedir cada SLEP por separado al pasar el mouse.
  getRankingDetalle(mes: string, anio: string, slep?: string): Observable<RankingDetalleFila[]> {
    const params: Record<string, string> = { mes, anio };
    if (slep) params['slep'] = slep;
    return this.http.get<RankingDetalleFila[]>(`${environment.apiUrl}/cases/ranking-detalle`, { params });
  }
}
