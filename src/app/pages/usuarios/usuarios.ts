import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../core/auth.service';
import { AvisosService } from '../../core/avisos.service';
import { EmpresaService } from '../../core/empresa.service';
import { mensajeDeError } from '../../core/errores';
import { ComunidadesService } from '../../data/comunidades.service';
import { Comunidad, Usuario, etiquetaRol } from '../../data/modelos';
import { UsuariosService } from '../../data/usuarios.service';
import { EstadoVacio } from '../../ui/estado-vacio';
import { DialogoPassword } from './dialogo-password';
import { DialogoUsuario } from './dialogo-usuario';

const normalizar = (t: string) => (t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

@Component({
  selector: 'app-usuarios',
  imports: [
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatMenuModule, MatSlideToggleModule,
    MatProgressSpinnerModule, EstadoVacio,
  ],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.scss',
})
export class Usuarios implements OnInit {
  private readonly usuariosSrv = inject(UsuariosService);
  private readonly comunidadesSrv = inject(ComunidadesService);
  private readonly avisos = inject(AvisosService);
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(AuthService);
  readonly empresa = inject(EmpresaService);
  readonly etiquetaRol = etiquetaRol;

  readonly cargando = signal(true);
  readonly error = signal('');
  readonly usuarios = signal<Usuario[]>([]);
  readonly comunidades = signal<Comunidad[]>([]);
  readonly busqueda = signal('');
  readonly verInactivos = signal(false);
  readonly miUid = computed(() => this.auth.sesion()?.uid);

  readonly filtrados = computed(() => {
    const q = normalizar(this.busqueda());
    return this.usuarios().filter(
      (u) => (this.verInactivos() || u.activo) && (!q || normalizar(u.nombre).includes(q) || normalizar(u.username).includes(q)),
    );
  });
  readonly inactivos = computed(() => this.usuarios().filter((u) => !u.activo).length);

  ngOnInit() {
    void this.cargar();
  }

  asignadas(u: Usuario) {
    return this.comunidades().filter((c) => c.asignados?.includes(u.uid));
  }

  async cargar() {
    this.cargando.set(true);
    this.error.set('');
    try {
      const [usuarios, comunidades] = await Promise.all([this.usuariosSrv.listar(), this.comunidadesSrv.listar()]);
      this.usuarios.set(usuarios);
      this.comunidades.set(comunidades);
    } catch (e) {
      this.error.set(mensajeDeError(e, 'No se pudieron cargar los usuarios.'));
    } finally {
      this.cargando.set(false);
    }
  }

  async abrir(usuario: Usuario | null) {
    const ref = this.dialog.open(DialogoUsuario, {
      data: {
        usuario,
        comunidades: this.comunidades(),
        asignadas: usuario ? this.asignadas(usuario).map((c) => c.id) : [],
        esUnoMismo: usuario?.uid === this.miUid(),
      },
      width: '560px',
      maxHeight: '92vh',
      disableClose: true,
    });
    if (await firstValueFrom(ref.afterClosed())) {
      this.avisos.ok(usuario ? 'Usuario actualizado' : 'Usuario creado');
      await this.cargar();
    }
  }

  async cambiarPassword(usuario: Usuario) {
    const ref = this.dialog.open(DialogoPassword, { data: usuario, width: '440px' });
    if (await firstValueFrom(ref.afterClosed())) this.avisos.ok('Contraseña cambiada');
  }

  async cambiarEstado(usuario: Usuario) {
    const desactivar = usuario.activo;
    const ok = await this.avisos.confirmar({
      titulo: desactivar ? 'Desactivar usuario' : 'Reactivar usuario',
      texto: desactivar
        ? `${usuario.nombre} no podrá entrar en la app y se cerrarán sus sesiones. Sus fichajes y controles se conservan.`
        : `${usuario.nombre} podrá volver a entrar con su contraseña.`,
      aceptar: desactivar ? 'Desactivar' : 'Reactivar',
      peligro: desactivar,
    });
    if (!ok) return;
    try {
      await this.usuariosSrv.cambiarEstado(usuario.uid, !usuario.activo);
      this.avisos.ok(desactivar ? 'Usuario desactivado' : 'Usuario reactivado');
      await this.cargar();
    } catch (e) {
      this.avisos.errorDe(e);
    }
  }
}
