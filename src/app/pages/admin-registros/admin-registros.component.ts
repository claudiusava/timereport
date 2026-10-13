import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ControlAgua, Imputacion, Usuario } from '../../models/modelos';
import { AvisosService } from '../../services/avisos.service';
import { ControlesAguaService } from '../../services/controles-agua.service';
import { ExcelService, Hoja } from '../../services/excel.service';
import { ImputacionesService } from '../../services/imputaciones.service';
import { UsuariosService } from '../../services/usuarios.service';
import { FotoControlComponent } from '../../components/foto-control.component';
import { aInputDate, deInputDate, fechaHora, sumarDias } from '../../shared/fechas';
import { agruparPorDia } from '../../shared/jornada';

type Pestana = 'fichajes' | 'controles';

const FORMATO_FECHA_HORA = 'dd/mm/yyyy hh:mm';
const FORMATO_FECHA = 'dd/mm/yyyy';

@Component({
  selector: 'app-admin-registros',
  standalone: true,
  imports: [FormsModule, FotoControlComponent],
  templateUrl: './admin-registros.component.html',
  styleUrl: './admin-registros.component.scss',
})
export class AdminRegistrosComponent implements OnInit {
  private readonly imputacionesSrv = inject(ImputacionesService);
  private readonly controlesSrv = inject(ControlesAguaService);
  private readonly usuariosSrv = inject(UsuariosService);
  private readonly excel = inject(ExcelService);
  private readonly avisos = inject(AvisosService);

  readonly fechaHora = fechaHora;

  readonly pestana = signal<Pestana>('fichajes');
  readonly cargando = signal(false);
  readonly exportando = signal(false);
  readonly usuarios = signal<Usuario[]>([]);
  readonly imputaciones = signal<Imputacion[]>([]);
  readonly controles = signal<ControlAgua[]>([]);
  /** Filtro aplicado en la ultima busqueda (para el nombre del Excel). */
  private aplicado = { desde: '', hasta: '' };

  desde = aInputDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  hasta = aInputDate(new Date());
  uid = '';

  readonly total = computed(() =>
    this.pestana() === 'fichajes' ? this.imputaciones().length : this.controles().length,
  );

  async ngOnInit() {
    try {
      this.usuarios.set(await this.usuariosSrv.listar());
    } catch (e) {
      this.avisos.errorDe(e, 'No se pudieron cargar los usuarios.');
    }
    await this.buscar();
  }

  async buscar() {
    const desde = deInputDate(this.desde);
    const hasta = deInputDate(this.hasta);
    if (!desde || !hasta || desde > hasta) {
      this.avisos.error('Revisa las fechas.');
      return;
    }
    const filtro = { desde, hasta: sumarDias(hasta, 1), uid: this.uid || undefined };
    this.cargando.set(true);
    try {
      const [imputaciones, controles] = await Promise.all([
        this.imputacionesSrv.registros(filtro),
        this.controlesSrv.registros(filtro),
      ]);
      this.imputaciones.set(imputaciones);
      this.controles.set(controles);
      this.aplicado = { desde: this.desde, hasta: this.hasta };
    } catch (e) {
      this.avisos.errorDe(e, 'No se pudieron cargar los registros.');
    } finally {
      this.cargando.set(false);
    }
  }

  async eliminarFichaje(i: Imputacion) {
    const ok = await this.avisos.confirmar({
      titulo: 'Eliminar fichaje',
      texto: `¿Eliminar la ${i.tipo} de ${i.usuarioNombre} del ${fechaHora(i.fecha)}?`,
      aceptar: 'Eliminar',
      peligro: true,
    });
    if (!ok) return;
    try {
      await this.imputacionesSrv.eliminar(i.id);
      this.imputaciones.update((l) => l.filter((x) => x.id !== i.id));
      this.avisos.ok('Fichaje eliminado');
    } catch (e) {
      this.avisos.errorDe(e, 'No se pudo eliminar el fichaje.');
    }
  }

  async eliminarControl(c: ControlAgua) {
    const ok = await this.avisos.confirmar({
      titulo: 'Eliminar control de agua',
      texto: `¿Eliminar el control de ${c.usuarioNombre} en ${c.comunidadNombre} del ${fechaHora(c.fecha)}? También se borrará la foto.`,
      aceptar: 'Eliminar',
      peligro: true,
    });
    if (!ok) return;
    try {
      await this.controlesSrv.eliminar(c);
      this.controles.update((l) => l.filter((x) => x.id !== c.id));
      this.avisos.ok('Control eliminado');
    } catch (e) {
      this.avisos.errorDe(e, 'No se pudo eliminar el control.');
    }
  }

  async exportar() {
    this.exportando.set(true);
    try {
      const hojas: Hoja[] =
        this.pestana() === 'fichajes' ? this.hojasFichajes() : [this.hojaControles()];
      const prefijo = this.pestana() === 'fichajes' ? 'fichajes' : 'controles-agua';
      await this.excel.exportar(
        `${prefijo}-${this.aplicado.desde}-a-${this.aplicado.hasta}`,
        hojas,
      );
    } catch (e) {
      this.avisos.errorDe(e, 'No se pudo generar el Excel.');
    } finally {
      this.exportando.set(false);
    }
  }

  private hojasFichajes(): Hoja[] {
    const fichajes: Hoja = {
      nombre: 'Fichajes',
      columnas: [
        { titulo: 'Trabajador', ancho: 30 },
        { titulo: 'Fecha y hora', ancho: 18, formato: FORMATO_FECHA_HORA },
        { titulo: 'Tipo', ancho: 10 },
        { titulo: 'Comunidad', ancho: 40 },
      ],
      filas: this.imputaciones().map((i) => [
        i.usuarioNombre,
        i.fecha.toDate(),
        i.tipo === 'entrada' ? 'ENTRADA' : 'SALIDA',
        i.comunidadNombre,
      ]),
    };

    // Horas por trabajador y dia, emparejando cada entrada con su salida.
    const porUsuario = new Map<string, Imputacion[]>();
    for (const i of this.imputaciones()) {
      porUsuario.set(i.uid, [...(porUsuario.get(i.uid) ?? []), i]);
    }
    const filasResumen: (string | number | Date)[][] = [];
    for (const lista of porUsuario.values()) {
      for (const dia of agruparPorDia(lista)) {
        filasResumen.push([
          lista[0].usuarioNombre,
          dia.dia,
          Math.round((dia.minutos / 60) * 100) / 100,
          dia.abierto ? 'Falta una salida' : '',
        ]);
      }
    }
    filasResumen.sort(
      (a, b) =>
        String(a[0]).localeCompare(String(b[0]), 'es') ||
        (a[1] as Date).getTime() - (b[1] as Date).getTime(),
    );
    const resumen: Hoja = {
      nombre: 'Horas por día',
      columnas: [
        { titulo: 'Trabajador', ancho: 30 },
        { titulo: 'Día', ancho: 12, formato: FORMATO_FECHA },
        { titulo: 'Horas', ancho: 10, formato: '0.00' },
        { titulo: 'Observaciones', ancho: 20 },
      ],
      filas: filasResumen,
    };
    return [fichajes, resumen];
  }

  private hojaControles(): Hoja {
    return {
      nombre: 'Control de agua',
      columnas: [
        { titulo: 'Trabajador', ancho: 30 },
        { titulo: 'Fecha y hora', ancho: 18, formato: FORMATO_FECHA_HORA },
        { titulo: 'Piscina', ancho: 40 },
        { titulo: 'Cloro libre', ancho: 11, formato: '0.0' },
        { titulo: 'pH', ancho: 8, formato: '0.0' },
        { titulo: 'Bañistas', ancho: 10 },
        { titulo: 'Rebosadero', ancho: 12 },
        { titulo: 'Agua depurada (m³)', ancho: 18 },
        { titulo: 'Foto', ancho: 8 },
      ],
      filas: this.controles().map((c) => [
        c.usuarioNombre,
        c.fecha.toDate(),
        c.comunidadNombre,
        c.cloro,
        c.ph,
        c.banistas,
        c.rebosadero,
        c.aguaDepurada,
        c.fotoPath ? 'Sí' : 'No',
      ]),
    };
  }
}
