import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { GeoPoint } from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';

import { Comunidad } from '../../models/modelos';
import { AvisosService } from '../../services/avisos.service';
import { ComunidadesService } from '../../services/comunidades.service';
import { ExcelService } from '../../services/excel.service';
import {
  deGeoPoint,
  enlaceMapa,
  formatearCoordenadas,
  obtenerPosicion,
  parsearCoordenadas,
} from '../../shared/geo';
import { aInputDate } from '../../shared/fechas';

interface Edicion {
  id: string | null;
  nombre: string;
  codigo: string;
  coordenadas: string;
}

@Component({
  selector: 'app-admin-comunidades',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-comunidades.component.html',
})
export class AdminComunidadesComponent implements OnInit {
  private readonly srv = inject(ComunidadesService);
  private readonly avisos = inject(AvisosService);
  private readonly excel = inject(ExcelService);

  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly comunidades = signal<Comunidad[]>([]);
  readonly busqueda = signal('');
  readonly edicion = signal<Edicion | null>(null);
  readonly errorEdicion = signal('');

  readonly filtradas = computed(() => {
    const q = normalizar(this.busqueda());
    if (!q) return this.comunidades();
    return this.comunidades().filter(
      (c) => normalizar(c.nombre).includes(q) || normalizar(c.codigo).includes(q),
    );
  });

  readonly coordenadas = (c: Comunidad) => formatearCoordenadas(deGeoPoint(c.ubicacion));
  readonly mapa = (c: Comunidad) => {
    const p = deGeoPoint(c.ubicacion);
    return p ? enlaceMapa(p) : null;
  };

  async ngOnInit() {
    await this.cargar();
  }

  nueva() {
    this.errorEdicion.set('');
    this.edicion.set({ id: null, nombre: '', codigo: '', coordenadas: '' });
  }

  editar(c: Comunidad) {
    this.errorEdicion.set('');
    this.edicion.set({
      id: c.id,
      nombre: c.nombre,
      codigo: c.codigo,
      coordenadas: this.coordenadas(c),
    });
  }

  async usarMiUbicacion(e: Edicion) {
    try {
      const pos = await obtenerPosicion();
      e.coordenadas = formatearCoordenadas({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });
    } catch (err) {
      this.errorEdicion.set(err instanceof Error ? err.message : 'No se pudo obtener la ubicación.');
    }
  }

  async guardar(e: Edicion) {
    this.errorEdicion.set('');
    const nombre = e.nombre.trim();
    const codigo = e.codigo.trim();
    const coords = parsearCoordenadas(e.coordenadas);
    if (!nombre || !codigo) {
      this.errorEdicion.set('El nombre y el código son obligatorios.');
      return;
    }
    if (!coords) {
      this.errorEdicion.set('Las coordenadas deben tener el formato "40.416775, -3.703790".');
      return;
    }
    const repetida = this.comunidades().find(
      (c) => c.id !== e.id && c.codigo.toLowerCase() === codigo.toLowerCase(),
    );
    if (repetida) {
      this.errorEdicion.set(`El código ${codigo} ya lo usa ${repetida.nombre}.`);
      return;
    }

    this.guardando.set(true);
    try {
      const datos = { nombre, codigo, ubicacion: new GeoPoint(coords.lat, coords.lng) };
      if (e.id) await this.srv.actualizar(e.id, datos);
      else await this.srv.crear(datos);
      this.avisos.ok(e.id ? 'Comunidad actualizada' : 'Comunidad creada');
      this.edicion.set(null);
      await this.cargar();
    } catch (err) {
      this.avisos.errorDe(err, 'No se pudo guardar la comunidad.');
    } finally {
      this.guardando.set(false);
    }
  }

  async eliminar(c: Comunidad) {
    const ok = await this.avisos.confirmar({
      titulo: 'Eliminar comunidad',
      texto: `¿Eliminar "${c.nombre}"? Los fichajes y controles ya registrados se conservan.`,
      aceptar: 'Eliminar',
      peligro: true,
    });
    if (!ok) return;
    try {
      await this.srv.eliminar(c.id);
      this.avisos.ok('Comunidad eliminada');
      await this.cargar();
    } catch (err) {
      this.avisos.errorDe(err, 'No se pudo eliminar la comunidad.');
    }
  }

  async exportar() {
    try {
      await this.excel.exportar(`comunidades-${aInputDate(new Date())}`, [
        {
          nombre: 'Comunidades',
          columnas: [
            { titulo: 'Nombre', ancho: 40 },
            { titulo: 'Código', ancho: 12 },
            { titulo: 'Coordenadas', ancho: 26 },
            { titulo: 'Trabajadores asignados', ancho: 22 },
          ],
          filas: this.filtradas().map((c) => [
            c.nombre,
            c.codigo,
            this.coordenadas(c),
            c.asignados?.length ?? 0,
          ]),
        },
      ]);
    } catch (err) {
      this.avisos.errorDe(err, 'No se pudo generar el Excel.');
    }
  }

  private async cargar() {
    this.cargando.set(true);
    try {
      this.comunidades.set(await this.srv.misComunidades());
    } catch (err) {
      this.avisos.errorDe(err, 'No se pudieron cargar las comunidades.');
    } finally {
      this.cargando.set(false);
    }
  }
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}
