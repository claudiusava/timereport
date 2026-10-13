import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-estado-vacio',
  imports: [MatIconModule],
  template: `
    <mat-icon [svgIcon]="icono()" />
    <p class="titulo">{{ titulo() }}</p>
    @if (texto()) {
      <p class="texto">{{ texto() }}</p>
    }
    <ng-content />
  `,
  styles: `
    :host { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 32px 16px; gap: 4px; color: var(--mat-sys-on-surface-variant); }
    mat-icon { width: 48px; height: 48px; color: var(--mat-sys-outline); margin-bottom: 8px; }
    .titulo { font: var(--mat-sys-title-medium); color: var(--mat-sys-on-surface); margin: 0; }
    .texto { font: var(--mat-sys-body-medium); margin: 0; max-width: 40ch; }
  `,
})
export class EstadoVacio {
  readonly icono = input('info');
  readonly titulo = input.required<string>();
  readonly texto = input<string>();
}
