import { Component, effect, inject, input, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

import { ControlesAguaService } from '../data/controles-agua.service';
import { DialogoFoto } from './dialogo-foto';

/** Miniatura de la foto de un control de agua; al pulsarla se amplia. */
@Component({
  selector: 'app-foto-control',
  imports: [MatIconModule],
  template: `
    @if (url(); as u) {
      <button type="button" class="miniatura" (click)="ampliar(u)" [attr.aria-label]="'Ver foto ' + (etiqueta() ?? '')">
        <img [src]="u" alt="" />
      </button>
    } @else {
      <span class="miniatura vacia" [attr.title]="estado()">
        <mat-icon [svgIcon]="estado() === 'cargando' ? 'hourglass_top' : 'photo_camera'" />
      </span>
    }
  `,
  styles: `
    :host { display: inline-flex; }
    .miniatura {
      width: 48px; height: 48px; padding: 0; border: 0; border-radius: 8px; overflow: hidden;
      background: var(--mat-sys-surface-container-high); cursor: zoom-in;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .miniatura img { width: 100%; height: 100%; object-fit: cover; }
    .vacia { cursor: default; color: var(--mat-sys-outline); }
  `,
})
export class FotoControl {
  private readonly controles = inject(ControlesAguaService);
  private readonly dialog = inject(MatDialog);
  readonly path = input<string | null>(null);
  readonly etiqueta = input<string>();
  readonly url = signal<string | null>(null);
  readonly estado = signal<'cargando' | 'sin foto' | 'no disponible'>('cargando');

  constructor() {
    effect(() => {
      const path = this.path();
      this.url.set(null);
      if (!path) {
        this.estado.set('sin foto');
        return;
      }
      this.estado.set('cargando');
      this.controles
        .urlFoto(path)
        .then((u) => this.path() === path && this.url.set(u))
        .catch(() => this.estado.set('no disponible'));
    });
  }

  ampliar(url: string) {
    this.dialog.open(DialogoFoto, { data: { url, titulo: this.etiqueta() }, maxWidth: '96vw' });
  }
}
