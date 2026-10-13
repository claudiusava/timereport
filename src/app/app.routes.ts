import { Routes } from '@angular/router';

import { conRol, conSesion, sinSesion } from './guards';

export const routes: Routes = [
  {
    // Enlace por empresa: /timereport/#/c/simasport recuerda la empresa en el
    // dispositivo y carga su logo y colores.
    path: 'c/:clienteId',
    loadComponent: () =>
      import('./pages/entrar-cliente/entrar-cliente.component').then(
        (m) => m.EntrarClienteComponent,
      ),
  },
  {
    path: 'login',
    canActivate: [sinSesion],
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [conSesion],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'fichaje' },
      {
        path: 'fichaje',
        loadComponent: () =>
          import('./pages/fichaje/fichaje.component').then((m) => m.FichajeComponent),
      },
      {
        path: 'control-agua',
        canActivate: [conRol('admin', 'socorrista')],
        loadComponent: () =>
          import('./pages/control-agua/control-agua.component').then(
            (m) => m.ControlAguaComponent,
          ),
      },
      {
        path: 'admin/usuarios',
        canActivate: [conRol('admin')],
        loadComponent: () =>
          import('./pages/admin-usuarios/admin-usuarios.component').then(
            (m) => m.AdminUsuariosComponent,
          ),
      },
      {
        path: 'admin/comunidades',
        canActivate: [conRol('admin')],
        loadComponent: () =>
          import('./pages/admin-comunidades/admin-comunidades.component').then(
            (m) => m.AdminComunidadesComponent,
          ),
      },
      {
        path: 'admin/registros',
        canActivate: [conRol('admin')],
        loadComponent: () =>
          import('./pages/admin-registros/admin-registros.component').then(
            (m) => m.AdminRegistrosComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
