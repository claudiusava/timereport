import { NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginator, MatPaginatorIntl, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { debounceTime, distinctUntilChanged, firstValueFrom, map } from 'rxjs';

import { AvisosService } from '../../core/avisos.service';
import { mensajeDeError } from '../../core/errores';
import { pantallaMovil } from '../../core/pantalla';
import { ComunidadesService } from '../../data/comunidades.service';
import { ControlesAguaService } from '../../data/controles-agua.service';
import { ExcelService, FORMATO_FECHA, FORMATO_FECHA_HORA, Hoja } from '../../data/excel.service';
import { FichajesService, MAX_REGISTROS } from '../../data/fichajes.service';
import { Comunidad, ControlAgua, Fichaje, RANGO_CLORO, RANGO_PH, Usuario, fueraDeRango } from '../../data/modelos';
import { UsuariosService } from '../../data/usuarios.service';
import { duracion, fechaHora, horasDecimal, inicioDelMes, isoDia, sumarDias } from '../../shared/fechas';
import { Jornada, calcularJornadas, porTrabajador } from '../../shared/jornada';
import { decimal } from '../../shared/numeros';
import { EstadoVacio } from '../../ui/estado-vacio';
import { FotoControl } from '../../ui/foto-control';
import { DialogoFichajeManual } from './dialogo-fichaje-manual';

interface ResumenHoras {
  uid: string;
  nombre: string;
  dias: number;
  minutos: number;
  incidencias: number;
  jornadas: Jornada<Fichaje>[];
}

/** Textos del paginador en castellano. */
export class PaginadorEs extends MatPaginatorIntl {
  override itemsPerPageLabel = 'Por página';
  override nextPageLabel = 'Siguiente';
  override previousPageLabel = 'Anterior';
  override firstPageLabel = 'Primera';
  override lastPageLabel = 'Última';
  override getRangeLabel = (pagina: number, tamano: number, total: number) =>
    total ? `${pagina * tamano + 1}–${Math.min((pagina + 1) * tamano, total)} de ${total}` : '0 de 0';
}

@Component({
  selector: 'app-registros',
  imports: [
    NgTemplateOutlet, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatDatepickerModule, MatButtonModule,
    MatIconModule, MatTableModule, MatSortModule, MatPaginatorModule, MatTabsModule, MatSlideToggleModule, MatMenuModule,
    MatTooltipModule, MatProgressBarModule, FotoControl, EstadoVacio,
  ],
  providers: [{ provide: MatPaginatorIntl, useClass: PaginadorEs }],
  templateUrl: './registros.html',
  styleUrl: './registros.scss',
})
export class Registros implements OnInit {
  private readonly fichajesSrv = inject(FichajesService);
  private readonly controlesSrv = inject(ControlesAguaService);
  private readonly usuariosSrv = inject(UsuariosService);
  private readonly comunidadesSrv = inject(ComunidadesService);
  private readonly excel = inject(ExcelService);
  private readonly avisos = inject(AvisosService);
  private readonly dialog = inject(MatDialog);

  readonly fechaHora = fechaHora;
  readonly duracion = duracion;
  readonly horasDecimal = horasDecimal;
  readonly decimal = decimal;
  readonly movil = pantallaMovil();
  readonly fueraDeRango = fueraDeRango;
  readonly rangoCloro = RANGO_CLORO;
  readonly rangoPh = RANGO_PH;
  readonly max = MAX_REGISTROS;

  readonly cargando = signal(false);
  readonly exportando = signal(false);
  readonly error = signal('');
  readonly truncado = signal(false);
  readonly usuarios = signal<Usuario[]>([]);
  readonly comunidades = signal<Comunidad[]>([]);
  readonly fichajes = signal<Fichaje[]>([]);
  readonly controles = signal<ControlAgua[]>([]);
  readonly pestana = signal(0);

  readonly filtros = inject(FormBuilder).group({
    desde: [inicioDelMes() as Date | null],
    hasta: [new Date() as Date | null],
    uid: [''],
    comunidadId: [''],
    anulados: [true],
  });
  private readonly valoresFiltro = toSignal(this.filtros.valueChanges, { initialValue: this.filtros.getRawValue() });
  /** Filtros aplicados en la ultima busqueda. */
  private aplicados = this.filtros.getRawValue();

  readonly fichajesFiltrados = computed(() => this.filtrar(this.fichajes()));
  readonly controlesFiltrados = computed(() => this.filtrar(this.controles()));
  readonly resumen = computed<ResumenHoras[]>(() =>
    [...porTrabajador(this.fichajesFiltrados()).entries()]
      .map(([uid, lista]) => {
        const jornadas = calcularJornadas(lista);
        return {
          uid,
          nombre: lista[0].usuarioNombre,
          jornadas,
          dias: jornadas.filter((j) => j.minutos > 0).length,
          minutos: jornadas.reduce((t, j) => t + j.minutos, 0),
          incidencias: jornadas.reduce((t, j) => t + j.incidencias.length, 0),
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
  );

  readonly columnasFichajes = ['fecha', 'usuarioNombre', 'tipo', 'comunidadNombre', 'estado', 'acciones'];
  readonly columnasControles = ['foto', 'fecha', 'usuarioNombre', 'comunidadNombre', 'cloro', 'ph', 'banistas', 'rebosadero', 'aguaDepurada', 'acciones'];
  readonly columnasResumen = ['nombre', 'dias', 'media', 'horas', 'incidencias'];
  readonly totales = computed(() =>
    this.resumen().reduce((t, r) => ({ dias: t.dias + r.dias, minutos: t.minutos + r.minutos, incidencias: t.incidencias + r.incidencias }), {
      dias: 0,
      minutos: 0,
      incidencias: 0,
    }),
  );

  readonly tablaFichajes = new MatTableDataSource<Fichaje>([]);
  readonly tablaControles = new MatTableDataSource<ControlAgua>([]);
  /** Pagina visible de cada lista (en movil se pinta como tarjetas en lugar de tabla). */
  readonly paginaFichajesMovil = toSignal(this.tablaFichajes.connect(), { initialValue: [] });
  readonly paginaControlesMovil = toSignal(this.tablaControles.connect(), { initialValue: [] });
  private readonly ordenFichajes = viewChild('ordenFichajes', { read: MatSort });
  private readonly paginaFichajes = viewChild('paginaFichajes', { read: MatPaginator });
  private readonly ordenControles = viewChild('ordenControles', { read: MatSort });
  private readonly paginaControles = viewChild('paginaControles', { read: MatPaginator });

  constructor() {
    const valor = (item: Fichaje | ControlAgua, col: string): string | number =>
      col === 'fecha' ? item.fecha?.toMillis() ?? 0 : ((item as unknown as Record<string, string | number>)[col] ?? '');
    this.tablaFichajes.sortingDataAccessor = valor;
    this.tablaControles.sortingDataAccessor = valor;
    effect(() => (this.tablaFichajes.data = this.fichajesFiltrados()));
    effect(() => (this.tablaControles.data = this.controlesFiltrados()));
    effect(() => {
      this.tablaFichajes.sort = this.ordenFichajes() ?? null;
      this.tablaFichajes.paginator = this.paginaFichajes() ?? null;
      this.tablaControles.sort = this.ordenControles() ?? null;
      this.tablaControles.paginator = this.paginaControles() ?? null;
    });
    // El periodo y el trabajador se consultan en Firestore: se vuelve a buscar en cuanto cambian.
    this.filtros.valueChanges
      .pipe(
        map(({ desde, hasta, uid }) => `${desde?.getTime()}|${hasta?.getTime()}|${uid}`),
        distinctUntilChanged(),
        debounceTime(300),
        takeUntilDestroyed(),
      )
      .subscribe(() => void this.buscar());
  }

  async ngOnInit() {
    try {
      const [usuarios, comunidades] = await Promise.all([this.usuariosSrv.listar(), this.comunidadesSrv.listar()]);
      this.usuarios.set(usuarios);
      this.comunidades.set(comunidades);
    } catch (e) {
      this.avisos.errorDe(e, 'No se pudieron cargar los usuarios.');
    }
    await this.buscar();
  }

  async buscar() {
    const { desde, hasta } = this.filtros.getRawValue();
    // Mientras se elige el rango en el calendario, la fecha final esta vacia.
    if (!desde || !hasta) return;
    if (desde > hasta) {
      this.error.set('La fecha de inicio es posterior a la final.');
      return;
    }
    this.error.set('');
    this.cargando.set(true);
    this.aplicados = this.filtros.getRawValue();
    try {
      const filtro = { desde, hasta: sumarDias(hasta, 1), uid: this.aplicados.uid || undefined };
      const [f, c] = await Promise.all([this.fichajesSrv.registros(filtro), this.controlesSrv.registros(filtro)]);
      this.fichajes.set(f.datos);
      this.controles.set(c.datos);
      this.truncado.set(f.truncado || c.truncado);
    } catch (e) {
      this.error.set(mensajeDeError(e, 'No se pudieron cargar los registros.'));
    } finally {
      this.cargando.set(false);
    }
  }

  media(r: ResumenHoras) {
    return r.dias ? Math.round(r.minutos / r.dias) : 0;
  }

  /** Filtros que se aplican en el navegador (comunidad y anulados). */
  private filtrar<T extends { comunidadId: string; anulado: unknown }>(lista: T[]): T[] {
    const { comunidadId, anulados } = this.valoresFiltro();
    return lista.filter((r) => (!comunidadId || r.comunidadId === comunidadId) && (anulados || !r.anulado));
  }

  async fichajeManual() {
    const ref = this.dialog.open(DialogoFichajeManual, {
      data: { usuarios: this.usuarios(), comunidades: this.comunidades() },
      width: '520px',
      panelClass: 'dialogo-adaptable',
    });
    if (await firstValueFrom(ref.afterClosed())) {
      this.avisos.ok('Fichaje registrado');
      await this.buscar();
    }
  }

  async anularFichaje(f: Fichaje) {
    const motivo = await this.avisos.pedirMotivo({
      titulo: 'Anular fichaje',
      texto: `${f.tipo === 'entrada' ? 'Entrada' : 'Salida'} de ${f.usuarioNombre} el ${fechaHora(f.fecha)} en ${f.comunidadNombre}. El fichaje no se borra: queda marcado como anulado.`,
      aceptar: 'Anular',
    });
    if (!motivo) return;
    try {
      await this.fichajesSrv.anular(f.id, motivo);
      this.avisos.ok('Fichaje anulado');
      await this.buscar();
    } catch (e) {
      this.avisos.errorDe(e, 'No se pudo anular el fichaje.');
    }
  }

  async anularControl(c: ControlAgua) {
    const motivo = await this.avisos.pedirMotivo({
      titulo: 'Anular control de agua',
      texto: `Control de ${c.usuarioNombre} en ${c.comunidadNombre} del ${fechaHora(c.fecha)}. No se borra: queda marcado como anulado.`,
      aceptar: 'Anular',
    });
    if (!motivo) return;
    try {
      await this.controlesSrv.anular(c.id, motivo);
      this.avisos.ok('Control anulado');
      await this.buscar();
    } catch (e) {
      this.avisos.errorDe(e, 'No se pudo anular el control.');
    }
  }

  async exportar() {
    this.exportando.set(true);
    const { desde, hasta } = this.aplicados;
    const observaciones = (r: { origen?: string; registradoPor?: { nombre: string } | null; motivo?: string | null; anulado: { motivo: string; por: { nombre: string } } | null }) =>
      [
        r.origen === 'manual' ? `Registrado por ${r.registradoPor?.nombre}: ${r.motivo}` : '',
        r.anulado ? `Anulado por ${r.anulado.por.nombre}: ${r.anulado.motivo}` : '',
      ]
        .filter(Boolean)
        .join(' · ');
    const fichajes = [...this.fichajesFiltrados()].sort((a, b) => a.fecha.toMillis() - b.fecha.toMillis());
    const controles = [...this.controlesFiltrados()].sort((a, b) => a.fecha.toMillis() - b.fecha.toMillis());
    const hojas: Hoja[] = [
      {
        nombre: 'Fichajes',
        columnas: [
          { titulo: 'Trabajador', ancho: 28 },
          { titulo: 'Fecha y hora', ancho: 18, formato: FORMATO_FECHA_HORA },
          { titulo: 'Tipo', ancho: 10 },
          { titulo: 'Comunidad', ancho: 34 },
          { titulo: 'Distancia (m)', ancho: 13 },
          { titulo: 'Observaciones', ancho: 50 },
        ],
        filas: fichajes.map((f) => [f.usuarioNombre, f.fecha.toDate(), f.tipo === 'entrada' ? 'Entrada' : 'Salida', f.comunidadNombre, f.distanciaM, observaciones(f)]),
        atenuadas: fichajes.map((f, i) => (f.anulado ? i : -1)).filter((i) => i >= 0),
      },
      {
        nombre: 'Horas por día',
        columnas: [
          { titulo: 'Trabajador', ancho: 28 },
          { titulo: 'Día', ancho: 12, formato: FORMATO_FECHA },
          { titulo: 'Horas', ancho: 10, formato: '0.00' },
          { titulo: 'Incidencias', ancho: 26 },
        ],
        filas: this.resumen().flatMap((r) =>
          [...r.jornadas].reverse().map((j) => [r.nombre, j.dia, Math.round((j.minutos / 60) * 100) / 100, j.incidencias.join(', ')]),
        ),
      },
      {
        nombre: 'Control de agua',
        columnas: [
          { titulo: 'Trabajador', ancho: 28 },
          { titulo: 'Fecha y hora', ancho: 18, formato: FORMATO_FECHA_HORA },
          { titulo: 'Piscina', ancho: 34 },
          { titulo: 'Cloro libre', ancho: 11, formato: '0.0' },
          { titulo: 'pH', ancho: 8, formato: '0.0' },
          { titulo: 'Bañistas', ancho: 10 },
          { titulo: 'Rebosadero', ancho: 12 },
          { titulo: 'Agua depurada (m³)', ancho: 18 },
          { titulo: 'Foto', ancho: 8 },
          { titulo: 'Observaciones', ancho: 40 },
        ],
        filas: controles.map((c) => [
          c.usuarioNombre, c.fecha.toDate(), c.comunidadNombre, c.cloro, c.ph, c.banistas, c.rebosadero, c.aguaDepurada,
          c.fotoPath ? 'Sí' : 'No',
          [fueraDeRango(c.cloro, RANGO_CLORO) || fueraDeRango(c.ph, RANGO_PH) ? 'Fuera de rango' : '', observaciones(c)].filter(Boolean).join(' · '),
        ]),
        atenuadas: controles.map((c, i) => (c.anulado ? i : -1)).filter((i) => i >= 0),
      },
    ];
    try {
      await this.excel.exportar(`registros-${isoDia(desde!)}-a-${isoDia(hasta!)}`, hojas);
    } catch (e) {
      this.avisos.errorDe(e, 'No se pudo generar el Excel.');
    } finally {
      this.exportando.set(false);
    }
  }
}
