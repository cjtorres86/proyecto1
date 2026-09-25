import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, map, tap } from 'rxjs';
import { Contenedor, MesActivo, CampoConValor } from '../models/case.model';
import { CasesApiService } from '../../features/cases/services/cases-api.service';

// Servicio de estado reactivo (TDD, sección 13.10) — reemplaza tanto al
// eventBus del PMV como a las llamadas manuales a _renderPanelSlep() /
// _renderPanelDerecho() tras cada cambio. Ningún componente "avisa" a
// otro que algo cambió: todos se suscriben a los mismos Observables
// derivados, y Angular los actualiza solo. Las llamadas HTTP en sí
// viven en CasesApiService — este servicio solo guarda el resultado.
@Injectable({ providedIn: 'root' })
export class CaseStateService {
  private readonly mesActivoSubject = new BehaviorSubject<MesActivo | null>(null);
  readonly mesActivo$ = this.mesActivoSubject.asObservable();

  private readonly contenedoresSubject = new BehaviorSubject<Contenedor[]>([]);
  readonly contenedores$ = this.contenedoresSubject.asObservable();

  private readonly slepActivoSubject = new BehaviorSubject<string | null>(null);
  readonly slepActivo$ = this.slepActivoSubject.asObservable();

  private readonly campoActivoSubject = new BehaviorSubject<string | null>(null);
  readonly campoActivo$ = this.campoActivoSubject.asObservable();

  // Panel Histórico (mejora post-v2.23): estado SEPARADO de slepActivo,
  // a propósito — Formulario y Dashboard siempre deben mostrar el
  // general al volver desde Histórico, sin importar cuántos SLEP haya
  // marcados ahí. Se guarda por NOMBRE de SLEP (no por id de
  // contenedor, que cambia cada mes) para que la marca sobreviva un
  // cambio de mes.
  //
  // "sleps" y "destacado" viven en UN SOLO BehaviorSubject, a
  // propósito — no dos separados (hallazgo real, post-implementación:
  // con dos avisos distintos, uno después del otro, existía una
  // fracción de instante donde "destacado" ya apuntaba al SLEP nuevo
  // pero "sleps" todavía no lo incluía, y ese estado a medio actualizar
  // alcanzaba a armar mal el gráfico antes de autocorregirse). Un solo
  // objeto que cambia de una vez hace que ese estado intermedio sea
  // imposible de observar.
  private readonly historicoSubject = new BehaviorSubject<{ sleps: Set<string>; destacado: string | null }>({
    sleps: new Set<string>(),
    destacado: null,
  });
  readonly slepsHistorico$ = this.historicoSubject.pipe(map((h) => h.sleps));
  readonly slepDestacadoHistorico$ = this.historicoSubject.pipe(map((h) => h.destacado));

  readonly contenedorActivo$: Observable<Contenedor | null> = combineLatest([this.contenedores$, this.slepActivoSubject]).pipe(
    map(([contenedores, slepId]) => contenedores.find((c) => c.id === slepId) ?? null),
  );

  constructor(private readonly api: CasesApiService) {}

  setMesActivo(mes: MesActivo | null): void {
    this.mesActivoSubject.next(mes);
    this.slepActivoSubject.next(null);
    this.campoActivoSubject.next(null);
    if (mes) this.recargarContenedores(mes);
  }

  setSlepActivo(contenedorId: string | null): void {
    this.slepActivoSubject.next(contenedorId);
    this.campoActivoSubject.next(null);
  }

  setCampoActivo(preguntaId: string | null): void {
    this.campoActivoSubject.next(preguntaId);
  }

  // Marca/desmarca un SLEP en el panel Histórico (nombre, no id — ver
  // comentario arriba). Al marcar uno nuevo, pasa a ser el "destacado".
  // Al desmarcar el que ya era el destacado, nadie queda destacado
  // hasta que se marque otro — los demás SLEP que sigan marcados se
  // quedan en gris, sin planilla propia visible. Un solo .next(): sleps
  // y destacado cambian juntos, nunca por separado (ver comentario del
  // subject más arriba).
  toggleSlepHistorico(slep: string): void {
    const actual = this.historicoSubject.value;
    const sleps = new Set(actual.sleps);
    let destacado: string | null;
    if (sleps.has(slep)) {
      sleps.delete(slep);
      destacado = actual.destacado === slep ? null : actual.destacado;
    } else {
      sleps.add(slep);
      destacado = slep;
    }
    this.historicoSubject.next({ sleps, destacado });
  }

  recargarContenedores(mes: MesActivo): void {
    this.api.listarPorMes(mes.mes, mes.anio).subscribe((lista) => this.contenedoresSubject.next(lista));
  }

  crearMes(mes: string, anio: string, formularioId: string): Observable<Contenedor[]> {
    return this.api.crearMes(mes, anio, formularioId).pipe(tap(() => this.recargarContenedores({ mes, anio })));
  }

  getContenedorConValores(id: string): Observable<{ contenedor: Contenedor; campos: CampoConValor[] }> {
    return this.api.getContenedorConValores(id);
  }

  getTotalGeneral(mes: string, anio: string): Observable<{ totalContenedores: number; campos: CampoConValor[] }> {
    return this.api.getTotalGeneral(mes, anio);
  }

  guardarValores(id: string, valores: Record<string, string>): Observable<unknown> {
    return this.api.guardarValores(id, valores).pipe(
      tap(() => {
        const mes = this.mesActivoSubject.value;
        if (mes) this.recargarContenedores(mes);
      }),
    );
  }

  importarArchivo(id: string, archivo: File): Observable<{ desconocidas: string[] }> {
    return this.api.importarArchivo(id, archivo).pipe(
      tap(() => {
        const mes = this.mesActivoSubject.value;
        if (mes) this.recargarContenedores(mes);
      }),
    );
  }
}
