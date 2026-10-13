import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { Rol } from '../data/modelos';
import { AuthService } from './auth.service';
import { EmpresaService } from './empresa.service';

// Ojo: inject() solo funciona antes del primer await de cada guard.

/** Sin sesion se va al login de la empresa recordada (o al acceso general). */
export const conSesion: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const empresa = inject(EmpresaService);
  const router = inject(Router);
  if (await auth.sesionResuelta()) return true;
  const id = empresa.id();
  return router.createUrlTree(id ? ['/c', id] : ['/acceso']);
};

/** Con sesion, la portada y el login llevan dentro de la app. */
export const sinSesion: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return (await auth.sesionResuelta()) ? router.createUrlTree(['/app']) : true;
};

/** Las reglas de Firestore son la proteccion real; esto solo evita pantallas vacias. */
export function conRol(...roles: Rol[]): CanActivateFn {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const sesion = await auth.sesionResuelta();
    return sesion && roles.includes(sesion.rol) ? true : router.createUrlTree(['/app']);
  };
}

/** Pantalla de inicio segun el rol. */
export const inicioSegunRol: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const sesion = await auth.sesionResuelta();
  return router.createUrlTree(['/app', sesion?.rol === 'admin' ? 'panel' : 'fichaje']);
};
