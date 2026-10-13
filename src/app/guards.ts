import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { Rol } from './models/modelos';
import { AuthService } from './services/auth.service';

export const conSesion: CanActivateFn = async () => {
  const sesion = await inject(AuthService).sesionResuelta();
  return sesion ? true : inject(Router).createUrlTree(['/login']);
};

export const sinSesion: CanActivateFn = async () => {
  const sesion = await inject(AuthService).sesionResuelta();
  return sesion ? inject(Router).createUrlTree(['/']) : true;
};

/** Las reglas de Firestore son la proteccion real; esto solo evita pantallas vacias. */
export function conRol(...roles: Rol[]): CanActivateFn {
  return async () => {
    const sesion = await inject(AuthService).sesionResuelta();
    return sesion && roles.includes(sesion.rol)
      ? true
      : inject(Router).createUrlTree(['/']);
  };
}
