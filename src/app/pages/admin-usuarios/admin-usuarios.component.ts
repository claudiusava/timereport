import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Comunidad, ROLES, Rol, Usuario, etiquetaRol } from '../../models/modelos';
import { AuthService } from '../../services/auth.service';
import { AvisosService } from '../../services/avisos.service';
import { ComunidadesService } from '../../services/comunidades.service';
import { UsuariosService } from '../../services/usuarios.service';

interface Edicion {
  uid: string | null;
  nombre: string;
  usuario: string;
  password: string;
  rol: Rol;
  comunidades: Set<string>;
}

const PASSWORD_MINIMA = 6;

@Component({
  selector: 'app-admin-usuarios',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-usuarios.component.html',
  styleUrl: './admin-usuarios.component.scss',
})
export class AdminUsuariosComponent implements OnInit {
  private readonly srv = inject(UsuariosService);
  private readonly comunidadesSrv = inject(ComunidadesService);
  private readonly avisos = inject(AvisosService);
  private readonly auth = inject(AuthService);

  readonly roles = ROLES;
  readonly etiquetaRol = etiquetaRol;
  readonly passwordMinima = PASSWORD_MINIMA;

  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly usuarios = signal<Usuario[]>([]);
  readonly comunidades = signal<Comunidad[]>([]);
  readonly busqueda = signal('');
  readonly verInactivos = signal(false);
  readonly edicion = signal<Edicion | null>(null);
  readonly busquedaComunidad = signal('');
  readonly cambioPassword = signal<{ usuario: Usuario; password: string } | null>(null);
  readonly errorDialogo = signal('');

  readonly miUid = computed(() => this.auth.sesion()?.uid);

  readonly filtrados = computed(() => {
    const q = normalizar(this.busqueda());
    return this.usuarios().filter(
      (u) =>
        (this.verInactivos() || u.activo) &&
        (!q || normalizar(u.nombre).includes(q) || normalizar(u.username).includes(q)),
    );
  });

  readonly comunidadesFiltradas = computed(() => {
    const q = normalizar(this.busquedaComunidad());
    return q
      ? this.comunidades().filter((c) => normalizar(`${c.nombre} ${c.codigo}`).includes(q))
      : this.comunidades();
  });

  async ngOnInit() {
    await this.cargar();
  }

  numComunidades(u: Usuario): number {
    return this.comunidades().filter((c) => c.asignados?.includes(u.uid)).length;
  }

  nuevo() {
    this.abrir({
      uid: null,
      nombre: '',
      usuario: '',
      password: '',
      rol: 'maquinista',
      comunidades: new Set(),
    });
  }

  editar(u: Usuario) {
    this.abrir({
      uid: u.uid,
      nombre: u.nombre,
      usuario: u.username || u.email,
      password: '',
      rol: u.rol,
      comunidades: new Set(
        this.comunidades()
          .filter((c) => c.asignados?.includes(u.uid))
          .map((c) => c.id),
      ),
    });
  }

  alternarComunidad(e: Edicion, id: string, marcada: boolean) {
    if (marcada) e.comunidades.add(id);
    else e.comunidades.delete(id);
  }

  marcarTodas(e: Edicion, marcar: boolean) {
    for (const c of this.comunidadesFiltradas()) {
      if (marcar) e.comunidades.add(c.id);
      else e.comunidades.delete(c.id);
    }
  }

  async guardar(e: Edicion) {
    this.errorDialogo.set('');
    const nombre = e.nombre.trim();
    const usuario = e.usuario.trim();
    if (!nombre || !usuario) {
      this.errorDialogo.set('El nombre y el usuario son obligatorios.');
      return;
    }
    if (!e.uid && e.password.length < PASSWORD_MINIMA) {
      this.errorDialogo.set(`La contraseña debe tener al menos ${PASSWORD_MINIMA} caracteres.`);
      return;
    }
    // Los administradores ven todas las comunidades; no hace falta asignarlas.
    const comunidades = e.rol === 'admin' ? [] : [...e.comunidades];

    this.guardando.set(true);
    try {
      if (e.uid) {
        await this.srv.actualizar({ uid: e.uid, nombre, usuario, rol: e.rol, comunidades });
      } else {
        await this.srv.crear({ nombre, usuario, password: e.password, rol: e.rol, comunidades });
      }
      this.avisos.ok(e.uid ? 'Usuario actualizado' : 'Usuario creado');
      this.edicion.set(null);
      await this.cargar();
    } catch (err) {
      this.errorDialogo.set(err instanceof Error ? err.message : 'No se pudo guardar el usuario.');
    } finally {
      this.guardando.set(false);
    }
  }

  async cambiarEstado(u: Usuario) {
    const desactivar = u.activo;
    const ok = await this.avisos.confirmar({
      titulo: desactivar ? 'Desactivar usuario' : 'Reactivar usuario',
      texto: desactivar
        ? `${u.nombre} no podrá entrar en la aplicación. Sus fichajes y controles se conservan.`
        : `${u.nombre} podrá volver a entrar con su contraseña.`,
      aceptar: desactivar ? 'Desactivar' : 'Reactivar',
      peligro: desactivar,
    });
    if (!ok) return;
    try {
      await this.srv.cambiarEstado(u.uid, !u.activo);
      this.avisos.ok(desactivar ? 'Usuario desactivado' : 'Usuario reactivado');
      await this.cargar();
    } catch (err) {
      this.avisos.errorDe(err);
    }
  }

  abrirCambioPassword(u: Usuario) {
    this.errorDialogo.set('');
    this.cambioPassword.set({ usuario: u, password: '' });
  }

  async guardarPassword(datos: { usuario: Usuario; password: string }) {
    if (datos.password.length < PASSWORD_MINIMA) {
      this.errorDialogo.set(`La contraseña debe tener al menos ${PASSWORD_MINIMA} caracteres.`);
      return;
    }
    this.guardando.set(true);
    try {
      await this.srv.restablecerPassword(datos.usuario.uid, datos.password);
      this.avisos.ok('Contraseña cambiada');
      this.cambioPassword.set(null);
    } catch (err) {
      this.errorDialogo.set(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña.');
    } finally {
      this.guardando.set(false);
    }
  }

  private abrir(e: Edicion) {
    this.errorDialogo.set('');
    this.busquedaComunidad.set('');
    this.edicion.set(e);
  }

  private async cargar() {
    this.cargando.set(true);
    try {
      const [usuarios, comunidades] = await Promise.all([
        this.srv.listar(),
        this.comunidadesSrv.misComunidades(),
      ]);
      this.usuarios.set(usuarios);
      this.comunidades.set(comunidades);
    } catch (err) {
      this.avisos.errorDe(err, 'No se pudieron cargar los usuarios.');
    } finally {
      this.cargando.set(false);
    }
  }
}

function normalizar(texto: string): string {
  return (texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}
