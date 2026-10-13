import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth.service';
import { EmpresaService } from '../../core/empresa.service';
import { mensajeDeError } from '../../core/errores';
import { DEMO } from './demo';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements OnInit {
  /** De la ruta /c/:clienteId (vacio en /acceso). */
  readonly clienteId = input<string>();

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly empresa = inject(EmpresaService);

  readonly cargandoEmpresa = signal(false);
  readonly enviando = signal(false);
  readonly error = signal('');
  readonly verPassword = signal(false);
  readonly demo = DEMO;
  readonly esDemo = computed(() => this.empresa.empresa()?.id === DEMO.id);
  /** Se pide el codigo de empresa si no viene en el enlace o no existe. */
  readonly pedirEmpresa = signal(false);

  readonly form = inject(FormBuilder).nonNullable.group({
    empresa: [''],
    usuario: ['', Validators.required],
    password: ['', Validators.required],
  });

  async ngOnInit() {
    const motivo = this.auth.motivoCierre();
    if (motivo) this.error.set(motivo);
    const id = this.clienteId();
    if (!id) {
      this.pedirEmpresa.set(true);
      this.form.controls.empresa.setValue(this.empresa.id() ?? '');
      return;
    }
    this.cargandoEmpresa.set(true);
    try {
      if (!(await this.empresa.cargar(id))) {
        this.pedirEmpresa.set(true);
        this.error.set(`No existe ninguna empresa con el código "${id}". Revisa el enlace o escribe el código.`);
      }
    } catch (e) {
      this.pedirEmpresa.set(true);
      this.error.set(mensajeDeError(e, 'No se pudo conectar. Comprueba tu conexión.'));
    } finally {
      this.cargandoEmpresa.set(false);
    }
  }

  usarDemo(usuario: string) {
    this.form.patchValue({ usuario, password: DEMO.password });
  }

  cambiarEmpresa() {
    this.empresa.olvidar();
    void this.router.navigate(['/acceso']);
  }

  async entrar() {
    this.error.set('');
    this.form.markAllAsTouched();
    const { empresa, usuario, password } = this.form.getRawValue();
    if (!usuario.trim() || !password) return;
    this.enviando.set(true);
    try {
      let clienteId = this.empresa.empresa()?.id;
      if (this.pedirEmpresa()) {
        if (!empresa.trim()) throw new Error('Escribe el código de tu empresa.');
        if (!(await this.empresa.cargar(empresa))) throw new Error('No existe ninguna empresa con ese código.');
        clienteId = this.empresa.empresa()!.id;
      }
      if (!clienteId) throw new Error('Escribe el código de tu empresa.');
      await this.auth.login(usuario, password, clienteId);
      await this.router.navigateByUrl('/app');
    } catch (e) {
      this.error.set(mensajeDeError(e, 'No se pudo iniciar sesión.'));
    } finally {
      this.enviando.set(false);
    }
  }
}
