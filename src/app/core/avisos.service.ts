import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';

import { DatosConfirmar, DialogoConfirmar } from '../ui/dialogo-confirmar';
import { DatosMotivo, DialogoMotivo } from '../ui/dialogo-motivo';
import { mensajeDeError } from './errores';

/** Mensajes flotantes y dialogos de confirmacion. */
@Injectable({ providedIn: 'root' })
export class AvisosService {
  private readonly snack = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  ok(texto: string) {
    this.snack.open(texto, undefined, { duration: 3500, panelClass: 'aviso-ok' });
  }

  error(texto: string) {
    this.snack.open(texto, 'Cerrar', { duration: 8000, panelClass: 'aviso-error' });
  }

  /** Muestra el mensaje de un error capturado (y lo deja en la consola). */
  errorDe(e: unknown, porDefecto?: string) {
    console.error(e);
    this.error(mensajeDeError(e, porDefecto));
  }

  confirmar(datos: DatosConfirmar): Promise<boolean> {
    const ref = this.dialog.open(DialogoConfirmar, { data: datos, width: '440px', autoFocus: 'dialog' });
    return firstValueFrom(ref.afterClosed()).then((r) => r === true);
  }

  /** Pide un motivo (para anular registros). Devuelve null si se cancela. */
  pedirMotivo(datos: DatosMotivo): Promise<string | null> {
    const ref = this.dialog.open(DialogoMotivo, { data: datos, width: '480px' });
    return firstValueFrom(ref.afterClosed()).then((r) => (typeof r === 'string' ? r : null));
  }
}
