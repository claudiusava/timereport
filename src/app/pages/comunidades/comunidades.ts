import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';

import { AvisosService } from '../../core/avisos.service';
import { mensajeDeError } from '../../core/errores';
import { ComunidadesService } from '../../data/comunidades.service';
import { ExcelService } from '../../data/excel.service';
import { Comunidad, Usuario } from '../../data/modelos';
import { UsuariosService } from '../../data/usuarios.service';
import { isoDia } from '../../shared/fechas';
import { deGeoPoint, enlaceMapa, formatearCoordenadas } from '../../shared/geo';
import { EstadoVacio } from '../../ui/estado-vacio';
import { DialogoComunidad } from './dialogo-comunidad';

const normalizar = (t: string) => (t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

@Component({
  selector: 'app-comunidades',
  imports: [MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatMenuModule, MatProgressSpinnerModule, EstadoVacio],
  templateUrl: './comunidades.html',
  styleUrl: './comunidades.scss',
})
export class Comunidades implements OnInit {
  private readonly comunidadesSrv = inject(ComunidadesService);
  private readonly usuariosSrv = inject(UsuariosService);
  private readonly excel = inject(ExcelService);
  private readonly avisos = inject(AvisosService);
  private readonly dialog = inject(MatDialog);

  readonly cargando = signal(true);
  readonly error = signal('');
  readonly comunidades = signal<Comunidad[]>([]);
  readonly usuarios = signal<Map<string, Usuario>>(new Map());
  readonly busqueda = signal('');

  readonly filtradas = computed(() => {
    const q = normalizar(this.busqueda());
    return q ? this.comunidades().filter((c) => normalizar(`${c.nombre} ${c.codigo}`).includes(q)) : this.comunidades();
  });

  readonly mapa = (c: Comunidad) => {
    const p = deGeoPoint(c.ubicacion);
    return p ? enlaceMapa(p) : null;
  };

  ngOnInit() {
    void this.cargar();
  }

  trabajadores(c: Comunidad): string {
    return (c.asignados ?? [])
      .map((uid) => this.usuarios().get(uid))
      .filter((u): u is Usuario => !!u && u.activo)
      .map((u) => u.nombre.split(' ')[0])
      .join(', ');
  }

  async cargar() {
    this.cargando.set(true);
    this.error.set('');
    try {
      const [comunidades, usuarios] = await Promise.all([this.comunidadesSrv.listar(), this.usuariosSrv.listar()]);
      this.comunidades.set(comunidades);
      this.usuarios.set(new Map(usuarios.map((u) => [u.uid, u])));
    } catch (e) {
      this.error.set(mensajeDeError(e, 'No se pudieron cargar las comunidades.'));
    } finally {
      this.cargando.set(false);
    }
  }

  async abrir(comunidad: Comunidad | null) {
    const ref = this.dialog.open(DialogoComunidad, { data: { comunidad, todas: this.comunidades() }, width: '520px', disableClose: true, panelClass: 'dialogo-adaptable' });
    if (await firstValueFrom(ref.afterClosed())) {
      this.avisos.ok(comunidad ? 'Comunidad actualizada' : 'Comunidad creada');
      await this.cargar();
    }
  }

  async eliminar(c: Comunidad) {
    const ok = await this.avisos.confirmar({
      titulo: 'Eliminar comunidad',
      texto: `¿Eliminar "${c.nombre}"? Los fichajes y controles ya registrados se conservan con su nombre. Si solo quieres que no se pueda fichar en ella, desactívala.`,
      aceptar: 'Eliminar',
      peligro: true,
    });
    if (!ok) return;
    try {
      await this.comunidadesSrv.eliminar(c.id);
      this.avisos.ok('Comunidad eliminada');
      await this.cargar();
    } catch (e) {
      this.avisos.errorDe(e, 'No se pudo eliminar la comunidad.');
    }
  }

  async exportar() {
    try {
      await this.excel.exportar(`comunidades-${isoDia(new Date())}`, [
        {
          nombre: 'Comunidades',
          columnas: [
            { titulo: 'Nombre', ancho: 38 },
            { titulo: 'Código', ancho: 12 },
            { titulo: 'Ubicación', ancho: 26 },
            { titulo: 'Estado', ancho: 10 },
            { titulo: 'Trabajadores asignados', ancho: 50 },
          ],
          filas: this.filtradas().map((c) => [
            c.nombre,
            c.codigo,
            formatearCoordenadas(deGeoPoint(c.ubicacion)),
            c.activa ? 'Activa' : 'Inactiva',
            (c.asignados ?? []).map((uid) => this.usuarios().get(uid)?.nombre).filter(Boolean).join(', '),
          ]),
        },
      ]);
    } catch (e) {
      this.avisos.errorDe(e, 'No se pudo generar el Excel.');
    }
  }
}
