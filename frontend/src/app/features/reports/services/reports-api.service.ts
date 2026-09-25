import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

interface ErrorFila { slep: string; campo: string; mensaje: string }

@Injectable({ providedIn: 'root' })
export class ReportsApiService {
  constructor(private readonly http: HttpClient) {}

  descargarExcelGeneral(): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/reports/excel/general`, { responseType: 'blob' });
  }

  descargarExcelPorSlep(): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/reports/excel/por-slep`, { responseType: 'blob' });
  }

  descargarInforme(mes: string, anio: string): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/reports/informe`, { params: { mes, anio }, responseType: 'blob' });
  }

  descargarInformePdf(mes: string, anio: string, slep?: string): Observable<Blob> {
    const params: Record<string, string> = { mes, anio };
    if (slep) params['slep'] = slep;
    return this.http.get(`${environment.apiUrl}/reports/informe-pdf`, { params, responseType: 'blob' });
  }

  listarErrores(mes: string, anio: string): Observable<ErrorFila[]> {
    return this.http.get<ErrorFila[]>(`${environment.apiUrl}/cases/errores`, { params: { mes, anio } });
  }
}
