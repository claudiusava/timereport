import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';

import { EmpresaService } from '../../core/empresa.service';
import { mensajeDeError } from '../../core/errores';
import { ControlesAguaService } from '../../data/controles-agua.service';
import { FichajesService } from '../../data/fichajes.service';
import { ControlAgua, Fichaje, RANGO_CLORO, RANGO_PH, Usuario, fueraDeRango } from '../../data/modelos';
import { UsuariosService } from '../../data/usuarios.service';
import { diaLargo, duracion, fechaHora, hora, inicioDelDia, sumarDias } from '../../shared/fechas';
import { calcularJornadas, porTrabajador } from '../../shared/jornada';
import { MAX_HORAS_TURNO } from '../../shared/reglas';
import { EstadoVacio } from '../../ui/estado-vacio';
import { FotoControl } from '../../ui/foto-control';

type Estado = 'trabajando' | 'terminado' | 'sin-fichar';

interface FilaEquipo {
  usuario: Usuario;
  estado: Estado;
  ultimo: Fichaje | null;
  minutosHoy: number;
}

@Component({
  selector: 'app-panel',
  imports: [RouterLink, MatButtonModule, MatIconModule, MatProgressSpinnerModule, EstadoVacio, FotoControl],
  templateUrl: './panel.html',
  styleUrl: './panel.scss',
})
export class Panel implements OnInit {
  private readonly usuariosSrv = inject(UsuariosService);
  private readonly fichajesSrv = inject(FichajesService);
  private readonly controlesSrv = inject(ControlesAguaService);
  readonly empresa = inject(EmpresaService);

  readonly cargando = signal(true);
  readonly error = signal('');
  readonly usuarios = signal<Usuario[]>([]);
  readonly fichajes = signal<Fichaje[]>([]);
  readonly controles = signal<ControlAgua[]>([]);
  readonly ahora = signal(new Date());

  readonly hoy = diaLargo(new Date());
  readonly hora = hora;
  readonly fechaHora = fechaHora;
  readonly duracion = duracion;
  readonly rangoCloro = RANGO_CLORO;
  readonly rangoPh = RANGO_PH;
  readonly fueraDeRango = fueraDeRango;

  readonly equipo = computed<FilaEquipo[]>(() => {
    const inicioHoy = inicioDelDia(this.ahora()).getTime();
    const porUid = porTrabajador(this.fichajes());
    return this.usuarios()
      .filter((u) => u.activo)
      .map((usuario) => {
        const suyos = porUid.get(usuario.uid) ?? [];
        const validos = suyos.filter((f) => !f.anulado && f.fecha).sort((a, b) => b.fecha.toMillis() - a.fecha.toMillis());
        const ultimo = validos[0] ?? null;
        const abierto = ultimo?.tipo === 'entrada' && this.ahora().getTime() - ultimo.fecha.toMillis() < MAX_HORAS_TURNO * 3600000;
        const jornadaHoy = calcularJornadas(suyos, this.ahora()).find((j) => j.dia.getTime() === inicioHoy);
        const enCurso = abierto ? (this.ahora().getTime() - ultimo!.fecha.toMillis()) / 60000 : 0;
        const fichoHoy = validos.some((f) => f.fecha.toMillis() >= inicioHoy);
        const estado: Estado = abierto ? 'trabajando' : fichoHoy ? 'terminado' : 'sin-fichar';
        return { usuario, estado, ultimo, minutosHoy: (jornadaHoy?.minutos ?? 0) + enCurso };
      })
      .sort((a, b) => ['trabajando', 'terminado', 'sin-fichar'].indexOf(a.estado) - ['trabajando', 'terminado', 'sin-fichar'].indexOf(b.estado) || a.usuario.nombre.localeCompare(b.usuario.nombre, 'es'));
  });

  readonly trabajando = computed(() => this.equipo().filter((f) => f.estado === 'trabajando').length);
  readonly fichadoHoy = computed(() => this.equipo().filter((f) => f.estado !== 'sin-fichar').length);
  readonly controlesFuera = computed(() =>
    this.controles().filter((c) => !c.anulado && (fueraDeRango(c.cloro, RANGO_CLORO) || fueraDeRango(c.ph, RANGO_PH))),
  );

  /** Entradas de los ultimos dias sin su salida (mas de 12 h): posibles olvidos. */
  readonly olvidos = computed(() => {
    const limite = this.ahora().getTime() - 12 * 3600000;
    const resultado: Fichaje[] = [];
    for (const suyos of porTrabajador(this.fichajes()).values()) {
      for (const jornada of calcularJornadas(suyos, this.ahora())) {
        for (const tramo of jornada.tramos) {
          if (tramo.abierto && tramo.entrada && tramo.entrada.fecha.toMillis() < limite) resultado.push(tramo.entrada);
        }
      }
    }
    return resultado.sort((a, b) => b.fecha.toMillis() - a.fecha.toMillis());
  });

  ngOnInit() {
    void this.cargar();
  }

  async cargar() {
    this.cargando.set(true);
    this.error.set('');
    this.ahora.set(new Date());
    try {
      const hoy = inicioDelDia();
      const manana = sumarDias(hoy, 1);
      // Dos dias hacia atras para detectar turnos de noche y salidas olvidadas.
      const [usuarios, fichajes, controles] = await Promise.all([
        this.usuariosSrv.listar(),
        this.fichajesSrv.registros({ desde: sumarDias(hoy, -2), hasta: manana }),
        this.controlesSrv.registros({ desde: hoy, hasta: manana }),
      ]);
      this.usuarios.set(usuarios);
      this.fichajes.set(fichajes.datos);
      this.controles.set(controles.datos);
    } catch (e) {
      this.error.set(mensajeDeError(e, 'No se pudo cargar el panel.'));
    } finally {
      this.cargando.set(false);
    }
  }
}
