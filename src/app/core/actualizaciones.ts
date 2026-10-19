import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SwUpdate } from '@angular/service-worker';
import { filter } from 'rxjs';

/** Si la version nueva llega en los primeros segundos, se recarga sin preguntar (aun no se ha escrito nada). */
const RECARGA_DIRECTA_MS = 10_000;
const COMPROBAR_CADA_MS = 30 * 60_000;

/**
 * Versiones nuevas de la app (PWA). El service worker sirve la version
 * guardada y descarga la nueva en segundo plano; sin esto, la nueva no se
 * veria hasta cerrar todas las pestañas.
 */
@Injectable({ providedIn: 'root' })
export class ActualizacionesService {
  private readonly sw = inject(SwUpdate);
  private readonly snack = inject(MatSnackBar);
  private readonly inicio = Date.now();
  private avisado = false;

  iniciar() {
    if (!this.sw.isEnabled) return;

    this.sw.versionUpdates.pipe(filter((e) => e.type === 'VERSION_READY')).subscribe(() => {
      if (Date.now() - this.inicio < RECARGA_DIRECTA_MS) {
        void this.aplicar();
      } else {
        this.avisar();
      }
    });
    // La cache quedo inservible (p. ej. se borraron ficheros antiguos del servidor).
    this.sw.unrecoverable.subscribe(() => location.reload());

    const comprobar = () => void this.sw.checkForUpdate().catch(() => undefined);
    comprobar();
    setInterval(comprobar, COMPROBAR_CADA_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') comprobar();
    });
  }

  private avisar() {
    if (this.avisado) return;
    this.avisado = true;
    this.snack
      .open('Hay una versión nueva de la aplicación', 'Actualizar')
      .onAction()
      .subscribe(() => void this.aplicar());
  }

  private async aplicar() {
    try {
      await this.sw.activateUpdate();
    } finally {
      location.reload();
    }
  }
}
