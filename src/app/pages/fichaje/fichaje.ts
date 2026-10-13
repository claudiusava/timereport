import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';

import { guardar, leer } from '../../core/almacen';
import { AvisosService } from '../../core/avisos.service';
import { EmpresaService } from '../../core/empresa.service';
import { mensajeDeError } from '../../core/errores';
import { ComunidadesService } from '../../data/comunidades.service';
import { FichajesService } from '../../data/fichajes.service';
import { Comunidad, Fichaje, TipoFichaje } from '../../data/modelos';
import { diaLargo, duracion, hora, inicioDelDia } from '../../shared/fechas';
import { deGeoPoint, formatearDistancia, obtenerPosicion } from '../../shared/geo';
import { calcularJornadas } from '../../shared/jornada';
import { distanciaM } from '../../shared/reglas';
import { EstadoVacio } from '../../ui/estado-vacio';

type Fase = 'listo' | 'ubicando' | 'guardando';

@Component({
  selector: 'app-fichaje',
  imports: [
    FormsModule, RouterLink, MatButtonModule, MatIconModule, MatFormFieldModule, MatSelectModule,
    MatProgressSpinnerModule, EstadoVacio,
  ],
  templateUrl: './fichaje.html',
  styleUrl: './fichaje.scss',
})
export class FichajePagina implements OnInit, OnDestroy {
  private readonly comunidadesSrv = inject(ComunidadesService);
  private readonly fichajes = inject(FichajesService);
  private readonly avisos = inject(AvisosService);
  readonly empresa = inject(EmpresaService);

  readonly cargando = signal(true);
  readonly errorCarga = signal('');
  readonly fase = signal<Fase>('listo');
  readonly error = signal('');
  readonly comunidades = signal<Comunidad[]>([]);
  readonly hoy = signal<Fichaje[]>([]);
  readonly siguiente = signal<TipoFichaje>('entrada');
  readonly ultimo = signal<Fichaje | null>(null);
  readonly comunidadId = signal('');
  readonly ahora = signal(new Date());

  readonly diaLargo = diaLargo;
  readonly hora = hora;
  readonly duracion = duracion;
  private reloj?: ReturnType<typeof setInterval>;

  readonly comunidad = computed(() => this.comunidades().find((c) => c.id === this.comunidadId()) ?? null);
  readonly jornadaHoy = computed(() => calcularJornadas(this.hoy(), this.ahora()).find((j) => j.dia.getTime() === inicioDelDia(this.ahora()).getTime()));

  /** Minutos trabajados hoy, contando el tramo en curso. */
  readonly minutosHoy = computed(() => {
    const j = this.jornadaHoy();
    const abierto = this.ultimo()?.tipo === 'entrada' && this.siguiente() === 'salida' ? this.ultimo() : null;
    const enCurso = abierto ? (this.ahora().getTime() - abierto.fecha.toMillis()) / 60000 : 0;
    return (j?.minutos ?? 0) + enCurso;
  });

  readonly limiteAlcanzado = computed(() => {
    if (this.siguiente() !== 'entrada') return false;
    const entradas = this.hoy().filter((f) => f.tipo === 'entrada' && !f.anulado).length;
    return entradas >= this.empresa.config().maxFichajesDia;
  });

  readonly ocupado = computed(() => this.fase() !== 'listo');

  async ngOnInit() {
    this.reloj = setInterval(() => this.ahora.set(new Date()), 1000);
    await this.cargar();
  }

  ngOnDestroy() {
    clearInterval(this.reloj);
  }

  async cargar() {
    this.cargando.set(true);
    this.errorCarga.set('');
    try {
      const [comunidades] = await Promise.all([
        this.comunidadesSrv.listar().then((l) => l.filter((c) => c.activa)),
        this.recargarEstado(),
      ]);
      this.comunidades.set(comunidades);
      this.comunidadId.set(this.comunidadPorDefecto(comunidades));
    } catch (e) {
      this.errorCarga.set(mensajeDeError(e, 'No se pudieron cargar tus datos.'));
    } finally {
      this.cargando.set(false);
    }
  }

  async fichar() {
    this.error.set('');
    const comunidad = this.comunidad();
    if (!comunidad) {
      this.error.set('Elige la comunidad.');
      return;
    }
    if (!navigator.onLine) {
      this.error.set('Necesitas conexión a internet para fichar.');
      return;
    }
    const destino = deGeoPoint(comunidad.ubicacion);
    if (!destino) {
      this.error.set('Esta comunidad no tiene ubicación configurada. Avisa al administrador.');
      return;
    }

    const tipo = this.siguiente();
    try {
      this.fase.set('ubicando');
      const pos = await obtenerPosicion();
      const radio = this.empresa.config().radioFichajeM;
      if (!this.empresa.esDemo()) {
        if (pos.precision > radio) {
          throw new Error(`La ubicación no es precisa (±${Math.round(pos.precision)} m). Activa el GPS y vuelve a intentarlo.`);
        }
        const distancia = distanciaM(pos, destino);
        if (distancia > radio) {
          throw new Error(
            `Estás a ${formatearDistancia(distancia)} de ${comunidad.nombre}. Para fichar tienes que estar a menos de ${formatearDistancia(radio)}.`,
          );
        }
      }
      this.fase.set('guardando');
      await this.fichajes.fichar(comunidad.id, tipo, pos);
      guardar('ultimaComunidad', comunidad.id);
      this.avisos.ok(tipo === 'entrada' ? `Entrada registrada en ${comunidad.nombre}` : 'Salida registrada');
    } catch (e) {
      this.error.set(mensajeDeError(e, 'No se pudo registrar el fichaje.'));
    } finally {
      this.fase.set('listo');
    }
    // Se recarga siempre: si el servidor ya tenia el fichaje (p. ej. se corto
    // la respuesta), la pantalla queda en el estado real.
    await this.recargarEstado().catch(() => undefined);
  }

  private async recargarEstado() {
    const [hoy, { tipo, ultimo }] = await Promise.all([
      this.fichajes.mios(inicioDelDia()),
      this.fichajes.siguienteTipo(),
    ]);
    this.hoy.set(hoy);
    this.siguiente.set(tipo);
    this.ultimo.set(ultimo);
    if (tipo === 'salida' && ultimo) this.comunidadId.set(ultimo.comunidadId);
  }

  /** Para la salida, la comunidad de la entrada; si no, la ultima usada. */
  private comunidadPorDefecto(lista: Comunidad[]): string {
    const ids = new Set(lista.map((c) => c.id));
    const ultimo = this.ultimo();
    if (this.siguiente() === 'salida' && ultimo && ids.has(ultimo.comunidadId)) return ultimo.comunidadId;
    const guardada = leer('ultimaComunidad');
    if (guardada && ids.has(guardada)) return guardada;
    return lista.length === 1 ? lista[0].id : '';
  }
}
