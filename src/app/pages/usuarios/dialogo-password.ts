import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { mensajeDeError } from '../../core/errores';
import { Usuario } from '../../data/modelos';
import { UsuariosService } from '../../data/usuarios.service';

@Component({
  selector: 'app-dialogo-password',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Nueva contraseña para {{ usuario.nombre }}</h2>
    <form (submit)="$event.preventDefault(); guardar()">
      <mat-dialog-content>
        @if (error()) {
          <div class="error-formulario" role="alert"><mat-icon svgIcon="error" />{{ error() }}</div>
        }
        <p class="texto-suave">Se cerrarán sus sesiones abiertas. Comunícale la nueva contraseña; podrá cambiarla desde Mi perfil.</p>
        <mat-form-field class="ancho-completo">
          <mat-label>Contraseña</mat-label>
          <input matInput [formControl]="password" autocomplete="new-password" cdkFocusInitial />
          @if (password.invalid) {
            <mat-error>Mínimo 8 caracteres.</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="guardando()">Cambiar contraseña</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class DialogoPassword {
  readonly usuario = inject<Usuario>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<DialogoPassword>);
  private readonly usuarios = inject(UsuariosService);
  readonly guardando = signal(false);
  readonly error = signal('');
  readonly password = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] });

  async guardar() {
    this.password.markAsTouched();
    if (this.password.invalid) return;
    this.guardando.set(true);
    this.error.set('');
    try {
      await this.usuarios.restablecerPassword(this.usuario.uid, this.password.value);
      this.ref.close(true);
    } catch (e) {
      this.error.set(mensajeDeError(e, 'No se pudo cambiar la contraseña.'));
    } finally {
      this.guardando.set(false);
    }
  }
}
