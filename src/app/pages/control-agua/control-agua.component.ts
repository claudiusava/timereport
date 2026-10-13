import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';

import {
  Comunidad,
  ControlAgua,
  NIVELES_CLORO,
  NIVELES_PH,
} from '../../models/modelos';
import { AvisosService } from '../../services/avisos.service';
import { ComunidadesService } from '../../services/comunidades.service';
import { ControlesAguaService } from '../../services/controles-agua.service';
import { fechaHora, inicioDelDia, sumarDias } from '../../shared/fechas';
import { FotoControlComponent } from '../../components/foto-control.component';

const DIAS_HISTORIAL = 31;

@Component({
  selector: 'app-control-agua',
  standalone: true,
  imports: [FormsModule, FotoControlComponent],
  templateUrl: './control-agua.component.html',
  styleUrl: './control-agua.component.scss',
})
export class ControlAguaComponent implements OnInit, OnDestroy {
  private readonly comunidadesSrv = inject(ComunidadesService);
  private readonly controlesSrv = inject(ControlesAguaService);
  private readonly avisos = inject(AvisosService);

  readonly nivelesCloro = NIVELES_CLORO;
  readonly nivelesPh = NIVELES_PH;
  readonly fechaHora = fechaHora;

  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly comunidades = signal<Comunidad[]>([]);
  readonly controles = signal<ControlAgua[]>([]);
  readonly vistaPrevia = signal<string | null>(null);

  form = this.formularioVacio();
  foto: File | null = null;

  async ngOnInit() {
    try {
      const [comunidades] = await Promise.all([
        this.comunidadesSrv.misComunidades(),
        this.cargarControles(),
      ]);
      this.comunidades.set(comunidades);
      if (comunidades.length === 1) this.form.comunidadId = comunidades[0].id;
    } catch (e) {
      this.avisos.errorDe(e, 'No se pudieron cargar tus datos.');
    } finally {
      this.cargando.set(false);
    }
  }

  ngOnDestroy() {
    this.limpiarVistaPrevia();
  }

  colorCloro(valor: number | null) {
    return this.nivelesCloro.find((n) => n.valor === valor)?.color ?? '';
  }

  colorPh(valor: number | null) {
    return this.nivelesPh.find((n) => n.valor === valor)?.color ?? '';
  }

  elegirFoto(evento: Event) {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;
    this.limpiarVistaPrevia();
    if (archivo && !archivo.type.startsWith('image/')) {
      this.avisos.error('El archivo tiene que ser una imagen.');
      input.value = '';
      return;
    }
    this.foto = archivo;
    if (archivo) this.vistaPrevia.set(URL.createObjectURL(archivo));
  }

  async guardar(ngForm: NgForm) {
    const comunidad = this.comunidades().find((c) => c.id === this.form.comunidadId);
    if (ngForm.invalid || !comunidad || this.form.cloro === null || this.form.ph === null) {
      ngForm.control.markAllAsTouched();
      this.avisos.error('Completa todos los campos.');
      return;
    }
    if (!this.foto) {
      this.avisos.error('Haz una foto del control.');
      return;
    }
    this.guardando.set(true);
    try {
      await this.controlesSrv.crear({
        comunidad,
        cloro: this.form.cloro,
        ph: this.form.ph,
        banistas: Number(this.form.banistas),
        rebosadero: Number(this.form.rebosadero),
        aguaDepurada: Number(this.form.aguaDepurada),
        foto: this.foto,
      });
      this.avisos.ok('Control guardado');
      const comunidadId = this.form.comunidadId;
      ngForm.resetForm();
      this.form = { ...this.formularioVacio(), comunidadId };
      this.foto = null;
      this.limpiarVistaPrevia();
      await this.cargarControles();
    } catch (e) {
      this.avisos.errorDe(e, 'No se pudo guardar el control.');
    } finally {
      this.guardando.set(false);
    }
  }

  private async cargarControles() {
    const desde = sumarDias(inicioDelDia(), -DIAS_HISTORIAL);
    this.controles.set(await this.controlesSrv.mios(desde));
  }

  private formularioVacio() {
    return {
      comunidadId: '',
      cloro: null as number | null,
      ph: null as number | null,
      banistas: null as number | null,
      rebosadero: null as number | null,
      aguaDepurada: null as number | null,
    };
  }

  private limpiarVistaPrevia() {
    const url = this.vistaPrevia();
    if (url) URL.revokeObjectURL(url);
    this.vistaPrevia.set(null);
  }
}
