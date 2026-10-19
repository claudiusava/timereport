import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';

import { AvisosService } from '../../core/avisos.service';
import { mensajeDeError } from '../../core/errores';
import { ComunidadesService } from '../../data/comunidades.service';
import { ControlesAguaService, FotoPendiente } from '../../data/controles-agua.service';
import {
  Comunidad,
  COLORES_CLORO,
  COLORES_PH,
  ControlAgua,
  NIVELES_CLORO,
  NIVELES_PH,
  RANGO_CLORO,
  RANGO_PH,
  fueraDeRango,
} from '../../data/modelos';
import { fechaHora, inicioDelDia, sumarDias } from '../../shared/fechas';
import { decimal } from '../../shared/numeros';
import { EstadoVacio } from '../../ui/estado-vacio';
import { FotoControl } from '../../ui/foto-control';

const ENTERO = Validators.pattern(/^\d+$/);

@Component({
  selector: 'app-control-agua',
  imports: [
    ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, FotoControl, EstadoVacio,
  ],
  templateUrl: './control-agua.html',
  styleUrl: './control-agua.scss',
})
export class ControlAguaPagina implements OnInit, OnDestroy {
  private readonly comunidadesSrv = inject(ComunidadesService);
  private readonly controles = inject(ControlesAguaService);
  private readonly avisos = inject(AvisosService);

  readonly nivelesCloro = NIVELES_CLORO;
  readonly nivelesPh = NIVELES_PH;
  readonly rangoCloro = RANGO_CLORO;
  readonly rangoPh = RANGO_PH;
  readonly coloresCloro = COLORES_CLORO;
  readonly coloresPh = COLORES_PH;
  readonly fueraDeRango = fueraDeRango;
  readonly fechaHora = fechaHora;
  readonly decimal = decimal;

  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly error = signal('');
  readonly comunidades = signal<Comunidad[]>([]);
  readonly recientes = signal<ControlAgua[]>([]);
  readonly vistaPrevia = signal<string | null>(null);
  readonly pendiente = signal<FotoPendiente | null>(null);
  private foto: File | null = null;

  readonly form = inject(FormBuilder).group({
    comunidadId: ['', Validators.required],
    cloro: [null as number | null, Validators.required],
    ph: [null as number | null, Validators.required],
    banistas: [null as number | null, [Validators.required, Validators.min(0), Validators.max(10000), ENTERO]],
    rebosadero: [null as number | null, [Validators.required, Validators.min(0), Validators.max(100000), ENTERO]],
    aguaDepurada: [null as number | null, [Validators.required, Validators.min(0), Validators.max(1000000)]],
  });
  readonly valores = toSignal(this.form.valueChanges, { initialValue: this.form.value });

  readonly avisoCloro = computed(() => this.aviso(this.valores().cloro, RANGO_CLORO));
  readonly avisoPh = computed(() => this.aviso(this.valores().ph, RANGO_PH));

  private aviso(valor: number | null | undefined, rango: { min: number; max: number }) {
    return valor != null && fueraDeRango(valor, rango) ? 'Fuera del rango recomendado' : '';
  }

  async ngOnInit() {
    try {
      const [comunidades] = await Promise.all([this.comunidadesSrv.listar(), this.cargarRecientes()]);
      const activas = comunidades.filter((c) => c.activa);
      this.comunidades.set(activas);
      if (activas.length === 1) this.form.controls.comunidadId.setValue(activas[0].id);
    } catch (e) {
      this.error.set(mensajeDeError(e, 'No se pudieron cargar tus datos.'));
    } finally {
      this.cargando.set(false);
    }
  }

  ngOnDestroy() {
    this.quitarVistaPrevia();
  }

  elegirFoto(evento: Event) {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;
    input.value = '';
    this.quitarVistaPrevia();
    if (!archivo) return;
    if (!archivo.type.startsWith('image/')) {
      this.error.set('El archivo tiene que ser una foto.');
      return;
    }
    this.error.set('');
    this.foto = archivo;
    this.vistaPrevia.set(URL.createObjectURL(archivo));
  }

  async guardar() {
    this.error.set('');
    this.form.markAllAsTouched();
    const comunidad = this.comunidades().find((c) => c.id === this.form.value.comunidadId);
    if (this.form.invalid || !comunidad) {
      this.error.set('Revisa los campos marcados en rojo.');
      return;
    }
    if (!this.foto) {
      this.error.set('Haz una foto del control.');
      return;
    }
    const v = this.form.getRawValue();
    this.guardando.set(true);
    try {
      await this.controles.crear(
        {
          comunidad,
          cloro: Number(v.cloro),
          ph: Number(v.ph),
          banistas: Number(v.banistas),
          rebosadero: Number(v.rebosadero),
          aguaDepurada: Number(v.aguaDepurada),
        },
        this.foto,
      );
      this.avisos.ok('Control guardado');
      this.limpiar();
    } catch (e) {
      if (e instanceof FotoPendiente) {
        this.pendiente.set(e);
        this.limpiar();
      } else {
        this.error.set(mensajeDeError(e, 'No se pudo guardar el control.'));
      }
    } finally {
      this.guardando.set(false);
    }
    await this.cargarRecientes().catch(() => undefined);
  }

  async reintentarFoto() {
    const p = this.pendiente();
    if (!p) return;
    this.guardando.set(true);
    try {
      await this.controles.subirFoto(p.fotoPath, p.foto);
      this.pendiente.set(null);
      this.avisos.ok('Foto subida');
      await this.cargarRecientes();
    } catch {
      this.avisos.error('Sigue sin poder subirse. Comprueba tu conexión y vuelve a intentarlo.');
    } finally {
      this.guardando.set(false);
    }
  }

  private limpiar() {
    // Se mantiene la comunidad: lo normal es registrar varios controles seguidos.
    const comunidadId = this.form.value.comunidadId ?? '';
    this.form.reset({ comunidadId });
    this.foto = null;
    this.quitarVistaPrevia();
  }

  private async cargarRecientes() {
    this.recientes.set(await this.controles.mios(sumarDias(inicioDelDia(), -30)));
  }

  private quitarVistaPrevia() {
    const url = this.vistaPrevia();
    if (url) URL.revokeObjectURL(url);
    this.vistaPrevia.set(null);
  }
}
