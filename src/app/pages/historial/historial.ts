import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AuthService } from '../../core/auth.service';
import { AvisosService } from '../../core/avisos.service';
import { mensajeDeError } from '../../core/errores';
import { ExcelService, FORMATO_FECHA, FORMATO_FECHA_HORA } from '../../data/excel.service';
import { FichajesService } from '../../data/fichajes.service';
import { Fichaje } from '../../data/modelos';
import { diaLargo, duracion, hora, horasDecimal, inicioDelMes, isoDia, mes, sumarMeses } from '../../shared/fechas';
import { calcularJornadas } from '../../shared/jornada';
import { EstadoVacio } from '../../ui/estado-vacio';

/** Historial completo del propio trabajador, por meses, con exportacion. */
@Component({
  selector: 'app-historial',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule, EstadoVacio],
  templateUrl: './historial.html',
  styleUrl: './historial.scss',
})
export class Historial implements OnInit {
  private readonly fichajes = inject(FichajesService);
  private readonly excel = inject(ExcelService);
  private readonly avisos = inject(AvisosService);
  private readonly auth = inject(AuthService);

  readonly mesActual = signal(inicioDelMes());
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly datos = signal<Fichaje[]>([]);

  readonly jornadas = computed(() => calcularJornadas(this.datos()));
  readonly totalMinutos = computed(() => this.jornadas().reduce((t, j) => t + j.minutos, 0));
  readonly diasTrabajados = computed(() => this.jornadas().filter((j) => j.minutos > 0).length);
  readonly esMesActual = computed(() => this.mesActual().getTime() === inicioDelMes().getTime());

  readonly mes = mes;
  readonly diaLargo = diaLargo;
  readonly hora = hora;
  readonly duracion = duracion;
  readonly horasDecimal = horasDecimal;

  ngOnInit() {
    void this.cargar();
  }

  cambiarMes(delta: number) {
    this.mesActual.set(sumarMeses(this.mesActual(), delta));
    void this.cargar();
  }

  async cargar() {
    this.cargando.set(true);
    this.error.set('');
    try {
      const desde = this.mesActual();
      this.datos.set(await this.fichajes.mios(desde, sumarMeses(desde, 1)));
    } catch (e) {
      this.error.set(mensajeDeError(e, 'No se pudo cargar tu historial.'));
    } finally {
      this.cargando.set(false);
    }
  }

  async exportar() {
    const nombre = this.auth.sesion()?.nombre ?? '';
    const ordenados = [...this.datos()].sort((a, b) => a.fecha.toMillis() - b.fecha.toMillis());
    try {
      await this.excel.exportar(`mi-registro-${isoDia(this.mesActual()).slice(0, 7)}`, [
        {
          nombre: 'Fichajes',
          columnas: [
            { titulo: 'Fecha y hora', ancho: 18, formato: FORMATO_FECHA_HORA },
            { titulo: 'Tipo', ancho: 10 },
            { titulo: 'Comunidad', ancho: 36 },
            { titulo: 'Observaciones', ancho: 40 },
          ],
          filas: ordenados.map((f) => [
            f.fecha.toDate(),
            f.tipo === 'entrada' ? 'Entrada' : 'Salida',
            f.comunidadNombre,
            [f.origen === 'manual' ? `Registrado por ${f.registradoPor?.nombre}: ${f.motivo}` : '', f.anulado ? `Anulado: ${f.anulado.motivo}` : '']
              .filter(Boolean)
              .join(' · '),
          ]),
          atenuadas: ordenados.map((f, i) => (f.anulado ? i : -1)).filter((i) => i >= 0),
        },
        {
          nombre: 'Horas por día',
          columnas: [
            { titulo: 'Trabajador', ancho: 28 },
            { titulo: 'Día', ancho: 12, formato: FORMATO_FECHA },
            { titulo: 'Horas', ancho: 10, formato: '0.00' },
            { titulo: 'Incidencias', ancho: 24 },
          ],
          filas: [...this.jornadas()].reverse().map((j) => [nombre, j.dia, Math.round((j.minutos / 60) * 100) / 100, j.incidencias.join(', ')]),
        },
      ]);
    } catch (e) {
      this.avisos.errorDe(e, 'No se pudo generar el Excel.');
    }
  }
}
