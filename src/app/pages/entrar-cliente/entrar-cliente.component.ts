import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { BrandingService } from '../../services/branding.service';

/** /#/c/{clienteId}: recuerda la empresa en este dispositivo y va al login. */
@Component({
  selector: 'app-entrar-cliente',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="contenedor">
      @if (noExiste()) {
        <div class="tarjeta">
          <h1>Empresa no encontrada</h1>
          <p>El enlace no corresponde a ninguna empresa. Revisa el enlace que te han enviado.</p>
          <a class="boton" routerLink="/login">Ir al inicio de sesión</a>
        </div>
      } @else {
        <div class="cargando"></div>
      }
    </div>
  `,
})
export class EntrarClienteComponent implements OnInit {
  private readonly branding = inject(BrandingService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  readonly noExiste = signal(false);

  async ngOnInit() {
    const id = this.ruta.snapshot.paramMap.get('clienteId') ?? '';
    if (await this.branding.cargar(id)) {
      await this.router.navigateByUrl('/login', { replaceUrl: true });
    } else {
      this.noExiste.set(true);
    }
  }
}
