import { Component, effect, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from './services/auth.service';
import { AvisosService } from './services/avisos.service';
import { BrandingService } from './services/branding.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  readonly auth = inject(AuthService);
  readonly branding = inject(BrandingService);
  readonly avisos = inject(AvisosService);
  private readonly router = inject(Router);

  constructor() {
    // La marca que manda es la del cliente del usuario que ha entrado, aunque
    // en este dispositivo se hubiera recordado otra empresa.
    effect(() => {
      const sesion = this.auth.sesion();
      if (sesion && sesion.clienteId !== this.branding.cliente()?.id) {
        void this.branding.cargar(sesion.clienteId);
      }
    });
  }

  async salir() {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }
}
