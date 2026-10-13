import { Routes } from '@angular/router';

import { conRol, conSesion, inicioSegunRol, sinSesion } from './core/guards';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [sinSesion],
    loadComponent: () => import('./pages/portada/portada').then((m) => m.Portada),
  },
  {
    // Acceso sin empresa conocida: se pide el codigo de empresa.
    path: 'acceso',
    canActivate: [sinSesion],
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    // Enlace por empresa: /#/c/piscinas-norte carga su logo y colores.
    path: 'c/:clienteId',
    canActivate: [sinSesion],
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: 'app',
    canActivate: [conSesion],
    canActivateChild: [conSesion],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', canActivate: [inicioSegunRol], children: [] },
      { path: 'fichaje', loadComponent: () => import('./pages/fichaje/fichaje').then((m) => m.FichajePagina) },
      { path: 'historial', loadComponent: () => import('./pages/historial/historial').then((m) => m.Historial) },
      {
        path: 'control-agua',
        canActivate: [conRol('admin', 'socorrista')],
        loadComponent: () => import('./pages/control-agua/control-agua').then((m) => m.ControlAguaPagina),
      },
      { path: 'perfil', loadComponent: () => import('./pages/perfil/perfil').then((m) => m.Perfil) },
      {
        path: 'panel',
        canActivate: [conRol('admin')],
        loadComponent: () => import('./pages/panel/panel').then((m) => m.Panel),
      },
      {
        path: 'registros',
        canActivate: [conRol('admin')],
        loadComponent: () => import('./pages/registros/registros').then((m) => m.Registros),
      },
      {
        path: 'usuarios',
        canActivate: [conRol('admin')],
        loadComponent: () => import('./pages/usuarios/usuarios').then((m) => m.Usuarios),
      },
      {
        path: 'comunidades',
        canActivate: [conRol('admin')],
        loadComponent: () => import('./pages/comunidades/comunidades').then((m) => m.Comunidades),
      },
      {
        path: 'ajustes',
        canActivate: [conRol('admin')],
        loadComponent: () => import('./pages/ajustes/ajustes').then((m) => m.Ajustes),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
