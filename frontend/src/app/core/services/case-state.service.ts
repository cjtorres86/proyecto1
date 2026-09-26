import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, catchError, combineLatest, debounceTime, distinctUntilChanged, filter, map, merge, of, shareReplay, switchMap, tap } from 'rxjs';
import { Contenedor, MesActivo, CampoConValor } from '../models/case.model';
import { CasesApiService } from '../../features/cases/services/cases-api.service';

// Servicio de estado reactivo (TDD, sección 13.10) — reemplaza tanto al
// eventBus del PMV como a las llamadas manuales a _renderPanelSlep() /
// _renderPanelDerecho() tras cada cambio. Ningún componente "avisa" a
// otro que algo cambió: todos se suscriben a los mismos Observables
// derivados, y Angular los actualiza solo. Las llamadas HTTP en sí
// viven en CasesApiService — este servicio solo guarda el resultado.
// El formulario abierto, tal como lo muestran el panel Formulario y el
// Inspector de Campo. contenedor = null en el "Total general" (suma de
// los SLEP del mes), que además trae cuántos SLEP suma.
export interface DetalleFormulario {
  contenedor: Contenedor | null;
  campos: CampoConValor[];
  totalContenedores: number;
}

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

  // El formulario abierto, COMPARTIDO (optimización de rendimiento):
  // antes el panel Formulario y el Inspector lo pedían cada uno por su
  // cuenta (2 pedidos iguales), y el Inspector lo volvía a pedir COMPLETO
  // en cada clic sobre un campo. Ahora se pide una sola vez por formulario
  // abierto y ambos paneles leen el mismo resultado.
  //  - debounceTime(0): si mes, SLEP y campo cambian casi a la vez (por
  //    ejemplo al entrar), se hace UN pedido, no uno por cada cambio.
  //  - distinctUntilChanged: elegir de nuevo lo mismo no vuelve a pedir.
  //  - recargaDetalle: fuerza un pedido nuevo cuando algo cambió en el
  //    servidor (cerrar/abrir el mes).
  //  - detalleGuardado: al guardar, el servidor ya devuelve el formulario
  //    actualizado, así que se reparte sin pedirlo de nuevo.
  private readonly recargaDetalle = new BehaviorSubject<number>(0);
  private readonly detalleGuardado = new Subject<{ slepId: string; detalle: DetalleFormulario }>();

  readonly detalleActivo$: Observable<DetalleFormulario | null> = merge(
    combineLatest([this.mesActivoSubject, this.slepActivoSubject, this.recargaDetalle]).pipe(
      debounceTime(0),
      distinctUntilChanged(
        ([mesA, slepA, recargaA], [mesB, slepB, recargaB]) =>
          mesA?.mes === mesB?.mes && mesA?.anio === mesB?.anio && slepA === slepB && recargaA === recargaB,
      ),
      switchMap(([mes, slepId]) => {
        const pedido: Observable<DetalleFormulario | null> = slepId
          ? this.api.getContenedorConValores(slepId).pipe(map((r) => ({ contenedor: r.contenedor, campos: r.campos, totalContenedores: 0 })))
          : mes
            ? this.api.getTotalGeneral(mes.mes, mes.anio).pipe(map((r) => ({ contenedor: null, campos: r.campos, totalContenedores: r.totalContenedores })))
            : of(null);
        // Un error de red no debe dejar los paneles sin funcionar para siempre.
        return pedido.pipe(catchError(() => of(null)));
      }),
    ),
    this.detalleGuardado.pipe(
      filter((g) => g.slepId === this.slepActivoSubject.value),
      map((g) => g.detalle),
    ),
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  constructor(private readonly api: CasesApiService) {}

  private refrescarDetalle(): void {
    this.recargaDetalle.next(this.recargaDetalle.value + 1);
  }

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

  crearMes(mes: string, anio: string, formularioId: string, sleps: string[]): Observable<Contenedor[]> {
    return this.api.crearMes(mes, anio, formularioId, sleps).pipe(tap(() => this.recargarContenedores({ mes, anio })));
  }

  getTotalGeneral(mes: string, anio: string): Observable<{ totalContenedores: number; campos: CampoConValor[] }> {
    return this.api.getTotalGeneral(mes, anio);
  }

  // El servidor devuelve el formulario ya actualizado: se reparte a los
  // paneles directo, sin volver a pedirlo.
  guardarValores(id: string, valores: Record<string, string>): Observable<{ contenedor: Contenedor; campos: CampoConValor[] }> {
    return this.api.guardarValores(id, valores).pipe(
      tap((detalle) => {
        this.detalleGuardado.next({ slepId: id, detalle: { contenedor: detalle.contenedor, campos: detalle.campos, totalContenedores: 0 } });
        const mes = this.mesActivoSubject.value;
        if (mes) this.recargarContenedores(mes);
      }),
    );
  }

  // Vista previa del Excel (mejora post-v2.23): no cambia nada en la base,
  // así que no hay que recargar contenedores.
  importarArchivo(id: string, archivo: File): Observable<{ valores: Record<string, string> }> {
    return this.api.importarArchivo(id, archivo);
  }

  // Tras cerrar, se recargan los contenedores del mes activo para que
  // cerradoEn llegue a todos los paneles (Formulario bloquea la edición).
  cerrarMes(mes: MesActivo): Observable<{ cerrados: number }> {
    return this.api.cerrarMes(mes.mes, mes.anio).pipe(
      tap(() => {
        const activo = this.mesActivoSubject.value;
        if (activo?.mes === mes.mes && activo?.anio === mes.anio) {
          this.recargarContenedores(activo);
          this.refrescarDetalle();
        }
      }),
    );
  }

  // Tras eliminar, si era el mes activo, se deselecciona: ya no existe
  // en la interfaz.
  // Tras reabrir, se recargan los contenedores para que cerradoEn=null
  // llegue a todos los paneles.
  abrirMes(mes: MesActivo): Observable<{ abiertos: number }> {
    return this.api.abrirMes(mes.mes, mes.anio).pipe(
      tap(() => {
        const activo = this.mesActivoSubject.value;
        if (activo?.mes === mes.mes && activo?.anio === mes.anio) {
          this.recargarContenedores(activo);
          this.refrescarDetalle();
        }
      }),
    );
  }

  eliminarMes(mes: MesActivo): Observable<{ eliminados: number }> {
    return this.api.eliminarMes(mes.mes, mes.anio).pipe(
      tap(() => {
        const activo = this.mesActivoSubject.value;
        if (activo?.mes === mes.mes && activo?.anio === mes.anio) {
          this.setMesActivo(null);
          this.contenedoresSubject.next([]);
        }
      }),
    );
  }
}
