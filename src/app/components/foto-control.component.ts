import { Component, effect, inject, input, signal } from '@angular/core';

import { ControlesAguaService } from '../services/controles-agua.service';

/** Miniatura de la foto de un control de agua; al pulsarla se amplia. */
@Component({
  selector: 'app-foto-control',
  standalone: true,
  template: `
    @if (url(); as u) {
      <button type="button" class="miniatura" (click)="ampliada.set(true)" aria-label="Ver foto">
        <img [src]="u" alt="Foto del control" loading="lazy" />
      </button>
      @if (ampliada()) {
        <div class="fondo-dialogo" (click)="ampliada.set(false)">
          <img class="ampliada" [src]="u" alt="Foto del control" />
        </div>
      }
    } @else if (path()) {
      <span class="miniatura vacia">…</span>
    } @else {
      <span class="miniatura vacia">Sin foto</span>
    }
  `,
  styles: `
    .miniatura {
      display: block;
      width: 56px;
      height: 56px;
      padding: 0;
      border: 1px solid var(--color-borde);
      border-radius: 8px;
      overflow: hidden;
      background: var(--color-fondo);
      cursor: zoom-in;
    }
    .miniatura img { width: 100%; height: 100%; object-fit: cover; }
    .vacia {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.7rem;
      color: var(--color-texto-suave);
      cursor: default;
    }
    .ampliada {
      max-width: 96vw;
      max-height: 90vh;
      margin: auto;
      border-radius: 8px;
    }
  `,
})
export class FotoControlComponent {
  private readonly controles = inject(ControlesAguaService);
  readonly path = input<string | null>(null);
  readonly url = signal<string | null>(null);
  readonly ampliada = signal(false);

  constructor() {
    effect(
      () => {
        const path = this.path();
        this.url.set(null);
        if (path) {
          this.controles
            .urlFoto(path)
            .then((u) => this.url.set(u))
            .catch((e) => console.warn('No se pudo cargar la foto', e));
        }
      },
      { allowSignalWrites: true },
    );
  }
}
