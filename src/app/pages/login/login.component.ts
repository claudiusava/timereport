import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { BrandingService } from '../../services/branding.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly branding = inject(BrandingService);

  empresa = '';
  usuario = '';
  password = '';
  readonly cambiandoEmpresa = signal(false);
  readonly enviando = signal(false);
  readonly error = signal('');

  pedirEmpresa(): boolean {
    return (
      (!this.branding.cliente() || this.cambiandoEmpresa()) &&
      !this.usuario.includes('@')
    );
  }

  cambiarEmpresa() {
    this.empresa = '';
    this.cambiandoEmpresa.set(true);
  }

  async entrar() {
    this.error.set('');
    if (!this.usuario.trim() || !this.password) {
      this.error.set('Escribe tu usuario y tu contraseña.');
      return;
    }
    this.enviando.set(true);
    try {
      let clienteId = this.branding.cliente()?.id ?? null;
      if (this.pedirEmpresa()) {
        if (!this.empresa.trim()) throw new Error('Escribe el código de tu empresa.');
        if (!(await this.branding.cargar(this.empresa))) {
          throw new Error('No existe ninguna empresa con ese código.');
        }
        clienteId = this.branding.cliente()!.id;
        this.cambiandoEmpresa.set(false);
      }
      await this.auth.login(this.usuario, this.password, clienteId);
      await this.router.navigateByUrl('/');
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo iniciar sesión.');
    } finally {
      this.enviando.set(false);
    }
  }
}
