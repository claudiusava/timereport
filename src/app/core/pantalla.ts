import { BreakpointObserver } from '@angular/cdk/layout';
import { Signal, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

/** Ancho a partir del cual se usa la disposicion de movil (barra inferior, listas en vez de tablas). */
export const CONSULTA_MOVIL = '(max-width: 840px)';

/** Señal que indica si la pantalla es de movil. Hay que llamarla en un contexto de inyeccion. */
export function pantallaMovil(): Signal<boolean> {
  const observador = inject(BreakpointObserver);
  return toSignal(observador.observe(CONSULTA_MOVIL).pipe(map((r) => r.matches)), {
    initialValue: observador.isMatched(CONSULTA_MOVIL),
  });
}
