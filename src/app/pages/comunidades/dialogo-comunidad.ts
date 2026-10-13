import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { GeoPoint } from 'firebase/firestore';

import { mensajeDeError } from '../../core/errores';
import { ComunidadesService } from '../../data/comunidades.service';
import { Comunidad } from '../../data/modelos';
import { deGeoPoint, enlaceMapa, formatearCoordenadas, obtenerPosicion, parsearCoordenadas } from '../../shared/geo';

export interface DatosDialogoComunidad {
  comunidad: Comunidad | null;
  todas: Comunidad[];
}

@Component({
  selector: 'app-dialogo-comunidad',
  imports: [
    ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule,
    MatSlideToggleModule, MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ datos.comunidad ? 'Editar comunidad' : 'Nueva comunidad' }}</h2>
    <form [formGroup]="form" (ngSubmit)="guardar()">
      <mat-dialog-content>
        @if (error()) {
          <div class="error-formulario" role="alert"><mat-icon svgIcon="error" />{{ error() }}</div>
        }
        <mat-form-field class="ancho-completo">
          <mat-label>Nombre</mat-label>
          <input matInput formControlName="nombre" maxlength="200" cdkFocusInitial />
        </mat-form-field>
        <mat-form-field class="ancho-completo">
          <mat-label>Código</mat-label>
          <input matInput formControlName="codigo" maxlength="45" />
          <mat-hint>Vuestra referencia interna (número de cliente, contrato…).</mat-hint>
        </mat-form-field>
        <mat-form-field class="ancho-completo">
          <mat-label>Ubicación (latitud, longitud)</mat-label>
          <input matInput formControlName="coordenadas" placeholder="40.416775, -3.703790" />
          <mat-icon matIconPrefix svgIcon="location_on" />
          <mat-hint>En Google Maps, mantén pulsado sobre la piscina y copia las coordenadas.</mat-hint>
        </mat-form-field>
        <div class="acciones-ubicacion">
          <button mat-stroked-button type="button" (click)="usarMiUbicacion()" [disabled]="ubicando()">
            @if (ubicando()) { <mat-spinner diameter="18" /> } @else { <mat-icon svgIcon="my_location" /> }
            Usar mi ubicación actual
          </button>
          @if (mapa(); as url) {
            <a mat-button [href]="url" target="_blank" rel="noopener"><mat-icon svgIcon="map" />Ver en el mapa</a>
          }
        </div>
        <mat-slide-toggle formControlName="activa">Activa (los trabajadores pueden fichar en ella)</mat-slide-toggle>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancelar</button>
        <button mat-flat-button type="submit" [disabled]="guardando()">Guardar</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .acciones-ubicacion { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 16px; }
    mat-spinner { display: inline-block; margin-right: 8px; }
  `,
})
export class DialogoComunidad {
  readonly datos = inject<DatosDialogoComunidad>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<DialogoComunidad>);
  private readonly comunidades = inject(ComunidadesService);
  readonly guardando = signal(false);
  readonly ubicando = signal(false);
  readonly error = signal('');

  readonly form = inject(FormBuilder).nonNullable.group({
    nombre: [this.datos.comunidad?.nombre ?? '', Validators.required],
    codigo: [this.datos.comunidad?.codigo ?? '', Validators.required],
    coordenadas: [formatearCoordenadas(deGeoPoint(this.datos.comunidad?.ubicacion)), Validators.required],
    activa: [this.datos.comunidad?.activa ?? true],
  });

  mapa() {
    const c = parsearCoordenadas(this.form.controls.coordenadas.value);
    return c ? enlaceMapa(c) : null;
  }

  async usarMiUbicacion() {
    this.ubicando.set(true);
    this.error.set('');
    try {
      const p = await obtenerPosicion();
      this.form.controls.coordenadas.setValue(formatearCoordenadas(p));
    } catch (e) {
      this.error.set(mensajeDeError(e, 'No se pudo obtener la ubicación.'));
    } finally {
      this.ubicando.set(false);
    }
  }

  async guardar() {
    this.error.set('');
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    const nombre = v.nombre.trim();
    const codigo = v.codigo.trim();
    const coords = parsearCoordenadas(v.coordenadas);
    if (!nombre || !codigo) {
      this.error.set('El nombre y el código son obligatorios.');
      return;
    }
    if (!coords) {
      this.error.set('La ubicación debe tener el formato "40.416775, -3.703790".');
      return;
    }
    const repetida = this.datos.todas.find(
      (c) => c.id !== this.datos.comunidad?.id && c.codigo.toLowerCase() === codigo.toLowerCase(),
    );
    if (repetida) {
      this.error.set(`El código ${codigo} ya lo usa ${repetida.nombre}.`);
      return;
    }
    this.guardando.set(true);
    try {
      const datos = { nombre, codigo, ubicacion: new GeoPoint(coords.lat, coords.lng), activa: v.activa };
      if (this.datos.comunidad) await this.comunidades.actualizar(this.datos.comunidad.id, datos);
      else await this.comunidades.crear(datos);
      this.ref.close(true);
    } catch (e) {
      this.error.set(mensajeDeError(e, 'No se pudo guardar la comunidad.'));
    } finally {
      this.guardando.set(false);
    }
  }
}
