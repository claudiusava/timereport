import { Injectable, inject } from '@angular/core';
import { collection, getDocs } from 'firebase/firestore';

import { AuthService } from '../core/auth.service';
import { db, llamar } from '../core/firebase';
import { Rol, Usuario } from './modelos';

export interface DatosUsuario {
  nombre: string;
  usuario: string;
  rol: Rol;
  comunidades: string[];
}

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly auth = inject(AuthService);

  /** Solo admin. */
  async listar(): Promise<Usuario[]> {
    const snap = await getDocs(collection(db, 'clientes', this.auth.requerirSesion().clienteId, 'usuarios'));
    return snap.docs
      .map((d) => ({ uid: d.id, ...d.data() }) as Usuario)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  crear(datos: DatosUsuario & { password: string }) {
    return llamar<{ uid: string }>('crearUsuario', datos);
  }

  actualizar(uid: string, datos: DatosUsuario) {
    return llamar('actualizarUsuario', { uid, ...datos });
  }

  cambiarEstado(uid: string, activo: boolean) {
    return llamar('cambiarEstadoUsuario', { uid, activo });
  }

  restablecerPassword(uid: string, password: string) {
    return llamar('restablecerPassword', { uid, password });
  }
}
