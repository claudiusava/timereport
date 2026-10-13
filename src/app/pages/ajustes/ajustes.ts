import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AvisosService } from '../../core/avisos.service';
import { EmpresaService } from '../../core/empresa.service';
import { mensajeDeError } from '../../core/errores';
import { aplicarTema } from '../../core/tema';
import { AjustesEmpresa, EmpresaAdminService } from '../../data/empresa-admin.service';
import { EntradaAuditoria } from '../../data/modelos';
import { fechaHora } from '../../shared/fechas';
import { EstadoVacio } from '../../ui/estado-vacio';

const COLORES = ['#00658f', '#006a60', '#3a6a00', '#8b5000', '#a8364b', '#6750a4', '#4a5c92', '#5d5f5f'];

@Component({
  selector: 'app-ajustes',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, EstadoVacio],
  templateUrl: './ajustes.html',
  styleUrl: './ajustes.scss',
})
export class Ajustes implements OnInit {
  readonly empresa = inject(EmpresaService);
  private readonly admin = inject(EmpresaAdminService);
  private readonly avisos = inject(AvisosService);
  readonly colores = COLORES;
  readonly fechaHora = fechaHora;

  readonly guardando = signal(false);
  readonly subiendoLogo = signal(false);
  readonly auditoria = signal<EntradaAuditoria[] | null>(null);
  readonly errorAuditoria = signal('');

  private readonly e = this.empresa.empresa();
  readonly form = inject(FormBuilder).nonNullable.group({
    nombreApp: [this.e?.branding.nombreApp ?? 'TimeReport', [Validators.required, Validators.maxLength(40)]],
    colorPrimario: [this.e?.branding.colorPrimario ?? '#00658f', [Validators.required, Validators.pattern(/^#[0-9a-fA-F]{6}$/)]],
    radioFichajeM: [this.e?.config.radioFichajeM ?? 1000, [Validators.required, Validators.min(50), Validators.max(5000)]],
    maxFichajesDia: [this.e?.config.maxFichajesDia ?? 2, [Validators.required, Validators.min(1), Validators.max(10)]],
  });

  async ngOnInit() {
    try {
      this.auditoria.set(await this.admin.auditoria());
    } catch (e) {
      this.errorAuditoria.set(mensajeDeError(e, 'No se pudo cargar la auditoría.'));
    }
  }

  elegirColor(color: string) {
    this.form.controls.colorPrimario.setValue(color);
    this.form.controls.colorPrimario.markAsDirty();
    aplicarTema(color); // vista previa inmediata
  }

  async subirLogo(evento: Event) {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    this.subiendoLogo.set(true);
    try {
      const logoPath = await this.admin.subirLogo(archivo);
      await this.admin.guardar({ logoPath });
      await this.empresa.recargar();
      this.avisos.ok('Logo actualizado');
      await this.ngOnInit();
    } catch (e) {
      this.avisos.errorDe(e, 'No se pudo subir el logo.');
    } finally {
      this.subiendoLogo.set(false);
    }
  }

  async quitarLogo() {
    try {
      await this.admin.guardar({ logoPath: '' });
      await this.empresa.recargar();
      this.avisos.ok('Logo eliminado: se usa el de TimeReport');
    } catch (e) {
      this.avisos.errorDe(e);
    }
  }

  async guardar() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const actual = this.empresa.empresa();
    const cambios: AjustesEmpresa = {};
    if (v.nombreApp.trim() !== actual?.branding.nombreApp) cambios.nombreApp = v.nombreApp.trim();
    if (v.colorPrimario.toLowerCase() !== actual?.branding.colorPrimario) cambios.colorPrimario = v.colorPrimario.toLowerCase();
    if (Number(v.radioFichajeM) !== actual?.config.radioFichajeM) cambios.radioFichajeM = Number(v.radioFichajeM);
    if (Number(v.maxFichajesDia) !== actual?.config.maxFichajesDia) cambios.maxFichajesDia = Number(v.maxFichajesDia);
    if (!Object.keys(cambios).length) {
      this.avisos.ok('No hay cambios que guardar');
      return;
    }
    this.guardando.set(true);
    try {
      await this.admin.guardar(cambios);
      await this.empresa.recargar();
      this.form.markAsPristine();
      this.avisos.ok('Ajustes guardados');
      await this.ngOnInit();
    } catch (e) {
      this.avisos.errorDe(e, 'No se pudieron guardar los ajustes.');
    } finally {
      this.guardando.set(false);
    }
  }
}
