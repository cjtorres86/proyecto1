import { SsoComponent } from './features/auth/sso/sso.component';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { inject } from '@angular/core';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { BitacoraComponent } from './features/bitacora/bitacora/bitacora.component';
import { LayoutComponent } from './layout/layout.component';
import { LoginComponent } from './features/auth/login/login.component';
import { CasesComponent } from './features/cases/cases/cases.component';
import { UserConfigComponent } from './features/users/user-config/user-config.component';
import { ProfileConfigComponent } from './features/users/profile-config/profile-config.component';
import { InformeComponent } from './features/reports/informe/informe.component';

// El ranking ya no es una hoja del Informe: los enlaces anteriores
// (/informe/Agosto/2026?tipo=ranking[&imprimir=1]) llevan a su informe propio.
const rankingEnSuInforme: CanActivateFn = (ruta) => {
  if (ruta.queryParamMap.get('tipo') !== 'ranking') return true;
  const queryParams: Record<string, string> = { mes: ruta.paramMap.get('mes') ?? '', anio: ruta.paramMap.get('anio') ?? '' };
  if (ruta.queryParamMap.get('imprimir') === '1') queryParams['imprimir'] = '1';
  return inject(Router).createUrlTree(['/informe-ranking'], { queryParams });
};

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  // Ingreso único: el portal abre Sumarios aquí, con un pase de un solo uso.
  { path: 'sso', component: SsoComponent },
  // Sin el layout (sin menú/header de la app) a propósito — es un
  // documento para ver/imprimir, no una pantalla de trabajo. Igual
  // protegida por authGuard: los datos del informe no son públicos.
  { path: 'informe/:mes/:anio', component: InformeComponent, canActivate: [authGuard, rankingEnSuInforme] },
  // Informe Interactivo de avance (Descargar → Informe Interactivo): pestaña aparte.
  // Se carga solo al abrirlo (no pesa en la carga inicial de Sumarios).
  { path: 'informe-avance', loadComponent: () => import('./features/reports/informe-avance/informe-avance.component').then((m) => m.InformeAvanceComponent), canActivate: [authGuard] },
  // Informe de ranking (interactivo y, con ?imprimir=1, estático): mismo diseño que el nacional.
  { path: 'informe-ranking', loadComponent: () => import('./features/reports/informe-ranking/informe-ranking.component').then((m) => m.InformeRankingComponent), canActivate: [authGuard] },
  // Descarga directa de un Excel (la usa el asistente del portal).
  { path: 'descargar', loadComponent: () => import('./features/reports/descarga/descarga.component').then((m) => m.DescargaComponent), canActivate: [authGuard] },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', component: CasesComponent },
      { path: 'usuarios', component: UserConfigComponent, canActivate: [permissionGuard('ver_usuarios')] },
      { path: 'perfiles', component: ProfileConfigComponent, canActivate: [permissionGuard('ver_perfiles')] },
      { path: 'bitacora', component: BitacoraComponent, canActivate: [permissionGuard('ver_bitacora')] },
    ],
  },
];
