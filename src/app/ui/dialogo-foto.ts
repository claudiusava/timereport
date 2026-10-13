import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-dialogo-foto',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="cabecera">
      <h2 mat-dialog-title>{{ datos.titulo ?? 'Foto del control' }}</h2>
      <button mat-icon-button mat-dialog-close aria-label="Cerrar"><mat-icon svgIcon="close" /></button>
    </div>
    <mat-dialog-content>
      <img [src]="datos.url" alt="Foto del control de agua" />
    </mat-dialog-content>
  `,
  styles: `
    .cabecera { display: flex; align-items: center; justify-content: space-between; padding-right: 8px; }
    img { display: block; max-width: 100%; max-height: 75vh; border-radius: 12px; margin: 0 auto; }
  `,
})
export class DialogoFoto {
  readonly datos = inject<{ url: string; titulo?: string }>(MAT_DIALOG_DATA);
}
