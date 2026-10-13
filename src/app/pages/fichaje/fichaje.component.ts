import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Comunidad, Imputacion, TipoFichaje } from '../../models/modelos';
import { AvisosService } from '../../services/avisos.service';
import { BrandingService } from '../../services/branding.service';
import { ComunidadesService } from '../../services/comunidades.service';
import { ImputacionesService } from '../../services/imputaciones.service';
import { diaLargo, hora, inicioDelDia, mismoDia, sumarDias } from '../../shared/fechas';
import { deGeoPoint, distanciaM, obtenerPosicion } from '../../shared/geo';
import { agruparPorDia } from '../../shared/jornada';

const CLAVE_ULTIMA_COMUNIDAD = 'timereport.ultimaComunidad';
const DIAS_HISTORIAL = 31;

@Component({
  selector: 'app-fichaje',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './fichaje.component.html',
  styleUrl: './fichaje.component.scss',
})
export class FichajeComponent implements OnInit, OnDestroy {
  private readonly comunidadesSrv = inject(ComunidadesService);
  private readonly imputacionesSrv = inject(ImputacionesService);
  private readonly branding = inject(BrandingService);
  private readonly avisos = inject(AvisosService);

  readonly cargando = signal(true);
  readonly fichando = signal(false);
  readonly comunidades = signal<Comunidad[]>([]);
  readonly historial = signal<Imputacion[]>([]);
  readonly ahora = signal(new Date());
  readonly errorUbicacion = signal('');
  comunidadId = '';

  private reloj?: ReturnType<typeof setInterval>;

  readonly hoy = computed(() => {
    const ahora = this.ahora();
    return this.historial().filter((i) => {
      const f = i.fecha?.toDate();
      return !f || mismoDia(f, ahora);
    });
  });

  readonly cuenta = computed(() => {
    const hoy = this.hoy();
    return {
      entradas: hoy.filter((i) => i.tipo === 'entrada').length,
      salidas: hoy.filter((i) => i.tipo === 'salida').length,
    };
  });

  readonly siguienteTipo = computed<TipoFichaje>(() =>
    this.cuenta().entradas > this.cuenta().salidas ? 'salida' : 'entrada',
  );

  readonly limiteAlcanzado = computed(() => {
    const max = this.branding.config().maxFichajesDia;
    const { entradas, salidas } = this.cuenta();
    return entradas >= max && salidas >= max;
  });

  readonly dias = computed(() => agruparPorDia(this.historial()));

  readonly diaLargo = diaLargo;
  readonly hora = hora;

  async ngOnInit() {
    this.reloj = setInterval(() => this.ahora.set(new Date()), 1000);
    try {
      const [comunidades] = await Promise.all([
        this.comunidadesSrv.misComunidades(),
        this.cargarHistorial(),
      ]);
      this.comunidades.set(comunidades);
      this.comunidadId = this.comunidadPorDefecto(comunidades);
    } catch (e) {
      this.avisos.errorDe(e, 'No se pudieron cargar tus datos.');
    } finally {
      this.cargando.set(false);
    }
  }

  ngOnDestroy() {
    clearInterval(this.reloj);
  }

  async fichar() {
    this.errorUbicacion.set('');
    const comunidad = this.comunidades().find((c) => c.id === this.comunidadId);
    if (!comunidad) {
      this.avisos.error('Elige la comunidad.');
      return;
    }
    if (!navigator.onLine) {
      // Sin conexion Firestore guardaria el fichaje al recuperarla, con la
      // hora de ese momento y no la real.
      this.avisos.error('Necesitas conexión a internet para fichar.');
      return;
    }
    const destino = deGeoPoint(comunidad.ubicacion);
    if (!destino) {
      this.errorUbicacion.set(
        'Esta comunidad no tiene ubicación configurada. Avisa al administrador.',
      );
      return;
    }

    this.fichando.set(true);
    try {
      const pos = await obtenerPosicion();
      const distancia = distanciaM(
        { lat: pos.coords.latitude, lng: pos.coords.longitude },
        destino,
      );
      const radio = this.branding.config().radioFichajeM;
      if (distancia > radio) {
        this.errorUbicacion.set(
          `Estás a ${formatearDistancia(distancia)} de ${comunidad.nombre}. ` +
            `Para fichar tienes que estar a menos de ${formatearDistancia(radio)}.`,
        );
        return;
      }

      const tipo = this.siguienteTipo();
      await this.imputacionesSrv.fichar(comunidad, tipo);
      guardarUltimaComunidad(comunidad.id);
      this.avisos.ok(tipo === 'entrada' ? 'Entrada registrada' : 'Salida registrada');
      await this.cargarHistorial();
    } catch (e) {
      if (e instanceof Error && !('code' in e)) this.errorUbicacion.set(e.message);
      else this.avisos.errorDe(e, 'No se pudo registrar el fichaje.');
    } finally {
      this.fichando.set(false);
    }
  }

  private async cargarHistorial() {
    const desde = sumarDias(inicioDelDia(), -DIAS_HISTORIAL);
    this.historial.set(await this.imputacionesSrv.mios(desde));
  }

  /** Para la salida, la comunidad de la ultima entrada; si no, la ultima usada. */
  private comunidadPorDefecto(comunidades: Comunidad[]): string {
    const ids = new Set(comunidades.map((c) => c.id));
    const ultimaHoy = this.hoy()[0];
    if (ultimaHoy && ids.has(ultimaHoy.comunidadId)) return ultimaHoy.comunidadId;
    const guardada = leerUltimaComunidad();
    if (guardada && ids.has(guardada)) return guardada;
    return comunidades.length === 1 ? comunidades[0].id : '';
  }
}

function formatearDistancia(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(m)} m`;
}

function leerUltimaComunidad(): string | null {
  try {
    return localStorage.getItem(CLAVE_ULTIMA_COMUNIDAD);
  } catch {
    return null;
  }
}

function guardarUltimaComunidad(id: string) {
  try {
    localStorage.setItem(CLAVE_ULTIMA_COMUNIDAD, id);
  } catch {
    // No es importante.
  }
}
