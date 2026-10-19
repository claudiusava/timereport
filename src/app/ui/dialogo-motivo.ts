import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface DatosMotivo {
  titulo: string;
  texto: string;
  aceptar: string;
}

/** Pide un motivo obligatorio (anulaciones y correcciones quedan auditadas). */
@Component({
  selector: 'app-dialogo-motivo',
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule],
  template: `
    <h2 mat-dialog-title>{{ datos.titulo }}</h2>
    <form (submit)="$event.preventDefault(); aceptar()">
      <mat-dialog-content>
        <p>{{ datos.texto }}</p>
        <mat-form-field class="ancho-completo" subscriptSizing="dynamic">
          <mat-label>Motivo</mat-label>
          <textarea matInput [formControl]="motivo" rows="3" maxlength="500" cdkFocusInitial></textarea>
          <mat-hint>Queda registrado en la auditoría junto con tu nombre y la fecha.</mat-hint>
          @if (motivo.hasError('minlength') || motivo.hasError('required')) {
            <mat-error>Explica el motivo (mínimo 5 caracteres).</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button class="boton-peligro" type="submit">{{ datos.aceptar }}</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class DialogoMotivo {
  readonly datos = inject<DatosMotivo>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<DialogoMotivo>);
  readonly motivo = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(5)] });

  aceptar() {
    this.motivo.markAsTouched();
    if (this.motivo.valid) this.ref.close(this.motivo.value.trim());
  }
}
