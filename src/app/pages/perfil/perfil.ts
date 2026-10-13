import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { AuthService } from '../../core/auth.service';
import { AvisosService } from '../../core/avisos.service';
import { EmpresaService } from '../../core/empresa.service';
import { mensajeDeError } from '../../core/errores';
import { ModoTema } from '../../core/tema';
import { etiquetaRol } from '../../data/modelos';

const PASSWORD_MINIMA = 8;

function coinciden(grupo: AbstractControl): ValidationErrors | null {
  const { nueva, repetir } = grupo.value as { nueva: string; repetir: string };
  return nueva && repetir && nueva !== repetir ? { distintas: true } : null;
}

@Component({
  selector: 'app-perfil',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatButtonToggleModule, MatIconModule],
  templateUrl: './perfil.html',
  styles: `
    :host { display: block; max-width: 640px; margin: 0 auto; }
    .datos { display: grid; grid-template-columns: auto 1fr; gap: 8px 24px; margin: 0; }
    dt { color: var(--mat-sys-on-surface-variant); }
    dd { margin: 0; font-weight: 500; }
    form { display: flex; flex-direction: column; gap: 4px; }
    form button { align-self: flex-start; margin-top: 8px; }
  `,
})
export class Perfil {
  readonly auth = inject(AuthService);
  readonly empresa = inject(EmpresaService);
  private readonly avisos = inject(AvisosService);
  readonly etiquetaRol = etiquetaRol;
  readonly minima = PASSWORD_MINIMA;
  readonly guardando = signal(false);
  readonly error = signal('');

  readonly form = inject(FormBuilder).nonNullable.group(
    {
      actual: ['', Validators.required],
      nueva: ['', [Validators.required, Validators.minLength(PASSWORD_MINIMA)]],
      repetir: ['', Validators.required],
    },
    { validators: coinciden },
  );

  cambiarModo(modo: ModoTema) {
    this.empresa.cambiarModo(modo);
  }

  async cambiarPassword() {
    this.error.set('');
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.guardando.set(true);
    try {
      const { actual, nueva } = this.form.getRawValue();
      await this.auth.cambiarPassword(actual, nueva);
      this.form.reset();
      this.avisos.ok('Contraseña cambiada');
    } catch (e) {
      this.error.set(mensajeDeError(e, 'No se pudo cambiar la contraseña.'));
    } finally {
      this.guardando.set(false);
    }
  }
}
