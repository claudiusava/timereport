import {
  ApplicationConfig,
  Injectable,
  LOCALE_ID,
  isDevMode,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { DateAdapter, MAT_DATE_LOCALE, NativeDateAdapter, provideNativeDateAdapter } from '@angular/material/core';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { provideRouter, withComponentInputBinding, withHashLocation, withInMemoryScrolling } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';
import { provideIconos } from './core/iconos';

/** Fechas escritas a mano en formato español (dd/mm/aaaa). */
@Injectable()
class AdaptadorFechas extends NativeDateAdapter {
  override parse(valor: unknown): Date | null {
    if (typeof valor === 'string') {
      const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(valor.trim());
      if (m) {
        const anio = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
        const fecha = new Date(anio, Number(m[2]) - 1, Number(m[1]));
        return fecha.getDate() === Number(m[1]) ? fecha : this.invalid();
      }
    }
    return super.parse(valor);
  }

  override getFirstDayOfWeek() {
    return 1;
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Rutas con hash (#/app/fichaje): GitHub Pages solo sirve ficheros que
    // existen, asi que con rutas "limpias" recargar /timereport/app/fichaje
    // daria 404. Con hash el servidor siempre recibe /timereport/.
    provideRouter(routes, withHashLocation(), withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    provideIconos(),
    provideNativeDateAdapter(),
    { provide: DateAdapter, useClass: AdaptadorFechas },
    { provide: LOCALE_ID, useValue: 'es' },
    { provide: MAT_DATE_LOCALE, useValue: 'es-ES' },
    { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { appearance: 'outline', subscriptSizing: 'dynamic' } },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
