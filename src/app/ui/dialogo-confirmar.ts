import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

export interface DatosConfirmar {
  titulo: string;
  texto: string;
  aceptar?: string;
  peligro?: boolean;
}

@Component({
  selector: 'app-dialogo-confirmar',
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ datos.titulo }}</h2>
    <mat-dialog-content>{{ datos.texto }}</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button [class.boton-peligro]="datos.peligro" [mat-dialog-close]="true" cdkFocusInitial>
        {{ datos.aceptar ?? 'Aceptar' }}
      </button>
    </mat-dialog-actions>
  `,
})
export class DialogoConfirmar {
  readonly datos = inject<DatosConfirmar>(MAT_DIALOG_DATA);
}
