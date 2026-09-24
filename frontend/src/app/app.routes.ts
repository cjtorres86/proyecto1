import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { LayoutComponent } from './layout/layout.component';
import { LoginComponent } from './features/auth/login/login.component';
import { CasesComponent } from './features/cases/cases/cases.component';
import { UserConfigComponent } from './features/users/user-config/user-config.component';
import { ProfileConfigComponent } from './features/users/profile-config/profile-config.component';
import { ErrorReportTableComponent } from './features/reports/error-report-table/error-report-table.component';
import { InformeComponent } from './features/reports/informe/informe.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  // Sin el layout (sin menú/header de la app) a propósito — es un
  // documento para ver/imprimir, no una pantalla de trabajo. Igual
  // protegida por authGuard: los datos del informe no son públicos.
  { path: 'informe/:mes/:anio', component: InformeComponent, canActivate: [authGuard] },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', component: CasesComponent },
      { path: 'usuarios', component: UserConfigComponent, canActivate: [permissionGuard('gestionar_usuarios')] },
      { path: 'perfiles', component: ProfileConfigComponent },
      { path: 'errores', component: ErrorReportTableComponent, canActivate: [permissionGuard('exportar_informe')] },
    ],
  },
];
