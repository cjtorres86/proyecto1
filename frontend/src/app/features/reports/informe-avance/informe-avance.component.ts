import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import { HistoricoDetalle } from '../../../core/utils/avance';
import { ConfigMotor, iniciarMotor } from './motor-informe';
import { descargarHtml, documentoAutonomo, estilosDeLaPagina, jsonParaScript } from '../../../core/utils/guardar-html';

// Nombre formal del informe (catálogo único): título de la pestaña y del archivo guardado.
const NOMBRE_INFORME = 'Informe interactivo nacional';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Informe Interactivo de avance (Descargar → Informe Interactivo): se abre en
// una pestaña aparte. Toma los datos de /cases/informe-avance (mismo cálculo
// que el Histórico) y arranca el motor del informe aprobado.
@Component({
  selector: 'app-informe-avance',
  standalone: true,
  templateUrl: './informe-avance.component.html',
  styleUrls: ['./informe-avance.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class InformeAvanceComponent implements OnInit, OnDestroy {
  estado: 'cargando' | 'listo' | 'error' | 'sin-permiso' = 'cargando';
  mensaje = '';
  private destruir?: () => void;
  // Para "Guardar": la página tal como es ANTES de que el motor la llene, y
  // los datos con que se arrancó. El archivo guardado vuelve a arrancar el
  // mismo motor con esos datos, así conserva toda la interacción.
  private plantilla = '';
  private cfg?: ConfigMotor;

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
    private readonly ruta: ActivatedRoute,
  ) {}

  async ngOnInit(): Promise<void> {
    document.title = `${NOMBRE_INFORME} · Avance de Sumarios`;
    if (!this.auth.can('exportar_informe')) {
      this.estado = 'sin-permiso';
      return;
    }
    try {
      const [detalle, logo] = await Promise.all([
        firstValueFrom(this.http.get<HistoricoDetalle>(`${environment.apiUrl}/cases/informe-avance`)),
        this.logoComoDataUrl(),
      ]);
      if (!detalle.meses.length) {
        this.estado = 'error';
        this.mensaje = 'Todavía no hay meses con información para el informe.';
        return;
      }
      const u = this.auth.usuarioActual();
      const q = this.ruta.snapshot.queryParamMap;
      const mesPedido = MESES.indexOf(q.get('mes') ?? '');
      const cfg: ConfigMotor = {
        ...this.adaptar(detalle),
        logo,
        usuario: { nombre: u?.nombreParaMostrar ?? '', perfil: u?.esSuperadmin ? 'Superadmin' : (u?.perfil?.nombre ?? '') },
        inicial: { anio: q.get('anio') ?? undefined, mes: mesPedido >= 0 ? mesPedido : undefined, slep: q.get('slep') ?? undefined },
        alSalir: () => this.auth.logout(),
      };
      this.estado = 'listo';
      this.cfg = cfg;
      // El motor necesita la página ya dibujada (y visible) para medirla.
      setTimeout(() => {
        this.plantilla = document.querySelector('.ia')?.outerHTML ?? '';
        this.destruir = iniciarMotor(cfg);
      });
    } catch {
      this.estado = 'error';
      this.mensaje = 'No se pudo cargar el informe. Espera un minuto y vuelve a intentarlo.';
    }
  }

  // Del formato del servidor (meses seguidos) al del motor (por año, enero a
  // diciembre). Cada registro pierde su primer valor (casos informados), que
  // el informe no usa.
  private adaptar(d: HistoricoDetalle): Pick<ConfigMotor, 'fuente' | 'posiciones' | 'alcanceCompleto'> {
    const anios: ConfigMotor['fuente']['anios'] = {};
    const posiciones: ConfigMotor['posiciones'] = {};
    d.meses.forEach((m, k) => {
      const mi = MESES.indexOf(m.mes);
      if (mi < 0) return;
      anios[m.anio] ??= d.sleps.map(() => Array(12).fill(null));
      posiciones[m.anio] ??= Array(12).fill(null);
      d.sleps.forEach((s, i) => (anios[m.anio][i][mi] = s.valores[k] ? s.valores[k]!.slice(1) : null));
      posiciones[m.anio][mi] = d.posicion?.[k] ?? null;
    });
    return { fuente: { sleps: d.sleps.map((s) => s.slep), anios }, posiciones, alcanceCompleto: d.alcanceCompleto };
  }

  // Guardar: un .html que se abre sin el sistema y conserva lo interactivo
  // (filtros, gráficos, tooltips, ranking). Lleva los estilos, la página
  // original, el motor y los datos. Generar Word/Excel/PDF y "Salir" necesitan
  // el sistema, así que en el archivo guardado no aparecen.
  guardar(): void {
    if (!this.cfg || !this.plantilla) return;
    const { alSalir: _, ...datos } = this.cfg;
    const estilos = estilosDeLaPagina() + '\n#g-save,#r-open,#salir,.u-sep{display:none!important}';
    const script = `var CFG=${jsonParaScript(datos)};CFG.alSalir=function(){};
document.addEventListener('DOMContentLoaded',function(){(${iniciarMotor.toString()})(CFG);});`;
    const hoy = new Date().toLocaleDateString('es-CL');
    const aviso = `<p style="margin:0;padding:6px 16px;background:#eef4fb;color:#25306B;font:12px Roboto,Arial,sans-serif">${NOMBRE_INFORME} · guardado el ${hoy} desde Avance de Sumarios. Los datos son los de ese momento.</p>`;
    descargarHtml(NOMBRE_INFORME, documentoAutonomo({ titulo: NOMBRE_INFORME, estilos, cuerpo: aviso + this.plantilla, script }));
  }

  private async logoComoDataUrl(): Promise<string> {
    const blob = await (await fetch('/logo-dep.png')).blob();
    return new Promise((ok, ko) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.onerror = ko;
      r.readAsDataURL(blob);
    });
  }

  ngOnDestroy(): void {
    this.destruir?.();
  }
}
