import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { mensajeDeError } from '../../core/errores';
import { FichajesService } from '../../data/fichajes.service';
import { Comunidad, TipoFichaje, Usuario } from '../../data/modelos';

export interface DatosFichajeManual {
  usuarios: Usuario[];
  comunidades: Comunidad[];
}

/** El admin registra un fichaje olvidado. Queda marcado como manual y auditado. */
@Component({
  selector: 'app-dialogo-fichaje-manual',
  imports: [
    ReactiveFormsModule, MatDialogModule, MatButtonModule, MatButtonToggleModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatDatepickerModule, MatIconModule,
  ],
  template: `
    <h2 mat-dialog-title>Registrar fichaje manual</h2>
    <form [formGroup]="form" (ngSubmit)="guardar()">
      <mat-dialog-content>
        <p class="texto-suave">Para corregir un olvido. Queda registrado como corrección tuya, con el motivo, y el trabajador lo verá en su historial.</p>
        @if (error()) {
          <div class="error-formulario" role="alert"><mat-icon svgIcon="error" />{{ error() }}</div>
        }
        <mat-form-field class="ancho-completo">
          <mat-label>Trabajador</mat-label>
          <mat-select formControlName="uid">
            @for (u of datos.usuarios; track u.uid) {
              <mat-option [value]="u.uid">{{ u.nombre }}{{ u.activo ? '' : ' (desactivado)' }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field class="ancho-completo">
          <mat-label>Comunidad</mat-label>
          <mat-select formControlName="comunidadId">
            @for (c of datos.comunidades; track c.id) {
              <mat-option [value]="c.id">{{ c.nombre }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-button-toggle-group formControlName="tipo" class="tipo" aria-label="Tipo de fichaje">
          <mat-button-toggle value="entrada">Entrada</mat-button-toggle>
          <mat-button-toggle value="salida">Salida</mat-button-toggle>
        </mat-button-toggle-group>
        <div class="fila-campos">
          <mat-form-field>
            <mat-label>Día</mat-label>
            <input matInput [matDatepicker]="picker" formControlName="dia" [max]="hoy" />
            <mat-datepicker-toggle matIconSuffix [for]="picker" />
            <mat-datepicker #picker />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Hora</mat-label>
            <input matInput type="time" formControlName="hora" />
          </mat-form-field>
        </div>
        <mat-form-field class="ancho-completo">
          <mat-label>Motivo</mat-label>
          <textarea matInput formControlName="motivo" rows="2" maxlength="500"></textarea>
          @if (form.controls.motivo.touched && form.controls.motivo.invalid) {
            <mat-error>Explica el motivo (mínimo 5 caracteres).</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="guardando()">Registrar</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `.tipo { margin-bottom: 16px; }`,
})
export class DialogoFichajeManual {
  readonly datos = inject<DatosFichajeManual>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<DialogoFichajeManual>);
  private readonly fichajes = inject(FichajesService);
  readonly hoy = new Date();
  readonly guardando = signal(false);
  readonly error = signal('');

  readonly form = inject(FormBuilder).nonNullable.group({
    uid: ['', Validators.required],
    comunidadId: ['', Validators.required],
    tipo: ['salida' as TipoFichaje, Validators.required],
    dia: [new Date() as Date | null, Validators.required],
    hora: ['', [Validators.required, Validators.pattern(/^\d{2}:\d{2}$/)]],
    motivo: ['', [Validators.required, Validators.minLength(5)]],
  });

  async guardar() {
    this.error.set('');
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const [h, m] = v.hora.split(':').map(Number);
    const fecha = new Date(v.dia!);
    fecha.setHours(h, m, 0, 0);
    if (fecha.getTime() > Date.now()) {
      this.error.set('La fecha y hora no pueden ser futuras.');
      return;
    }
    this.guardando.set(true);
    try {
      await this.fichajes.registrarManual({ uid: v.uid, comunidadId: v.comunidadId, tipo: v.tipo, fecha, motivo: v.motivo.trim() });
      this.ref.close(true);
    } catch (e) {
      this.error.set(mensajeDeError(e, 'No se pudo registrar el fichaje.'));
    } finally {
      this.guardando.set(false);
    }
  }
}
