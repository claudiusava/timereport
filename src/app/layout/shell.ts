import { Component, computed, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../core/auth.service';
import { EmpresaService } from '../core/empresa.service';
import { pantallaMovil } from '../core/pantalla';
import { etiquetaRol } from '../data/modelos';

interface Enlace {
  ruta: string;
  etiqueta: string;
  icono: string;
}

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive, MatSidenavModule, MatToolbarModule, MatListModule,
    MatIconModule, MatButtonModule, MatMenuModule, MatDividerModule, MatTooltipModule,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  readonly auth = inject(AuthService);
  readonly empresa = inject(EmpresaService);
  private readonly router = inject(Router);

  readonly movil = pantallaMovil();
  readonly sinConexion = signal(!navigator.onLine);
  readonly etiquetaRol = etiquetaRol;

  readonly jornada = computed<Enlace[]>(() => [
    { ruta: 'fichaje', etiqueta: 'Fichaje', icono: 'schedule' },
    { ruta: 'historial', etiqueta: 'Mi historial', icono: 'history' },
    ...(this.auth.puedeControlAgua() ? [{ ruta: 'control-agua', etiqueta: 'Control de agua', icono: 'water_drop' }] : []),
  ]);

  readonly gestion = computed<Enlace[]>(() =>
    this.auth.esAdmin()
      ? [
          { ruta: 'panel', etiqueta: 'Panel', icono: 'dashboard' },
          { ruta: 'registros', etiqueta: 'Registros', icono: 'table_view' },
          { ruta: 'usuarios', etiqueta: 'Usuarios', icono: 'group' },
          { ruta: 'comunidades', etiqueta: 'Comunidades', icono: 'apartment' },
          { ruta: 'ajustes', etiqueta: 'Ajustes', icono: 'settings' },
        ]
      : [],
  );

  /** Barra inferior del movil: como mucho 4 accesos y "Más". */
  readonly inferior = computed<Enlace[]>(() =>
    this.auth.esAdmin() ? this.gestion().slice(0, 4) : [...this.jornada(), { ruta: 'perfil', etiqueta: 'Perfil', icono: 'person' }],
  );
  readonly enMas = computed<Enlace[]>(() =>
    this.auth.esAdmin() ? [...this.jornada(), ...this.gestion().slice(4)] : [],
  );

  constructor() {
    addEventListener('online', () => this.sinConexion.set(false));
    addEventListener('offline', () => this.sinConexion.set(true));
    // Si la sesion se cierra (otra pestaña, usuario desactivado, token
    // revocado...), volver al login en lugar de dejar la pantalla colgada.
    effect(() => {
      if (this.auth.sesion() === null) {
        const id = this.empresa.id();
        void this.router.navigate(id ? ['/c', id] : ['/acceso']);
      }
    });
  }

  salir() {
    void this.auth.logout();
  }
}
