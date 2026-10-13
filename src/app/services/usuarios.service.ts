import { Injectable, inject } from '@angular/core';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';

import { Rol, Usuario } from '../models/modelos';
import { AuthService } from './auth.service';

// Estas formas coinciden con las de functions/src/usuarios.ts.
export interface DatosNuevoUsuario {
  nombre: string;
  /** Nombre de usuario o email real. */
  usuario: string;
  password: string;
  rol: Rol;
  comunidades: string[];
}

export interface DatosEdicionUsuario {
  uid: string;
  nombre: string;
  usuario: string;
  rol: Rol;
  comunidades: string[];
}

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly firestore = inject(Firestore);
  private readonly functions = inject(Functions);
  private readonly auth = inject(AuthService);

  /** Solo admin. */
  async listar(): Promise<Usuario[]> {
    const { clienteId } = this.auth.requerirSesion();
    const snap = await getDocs(
      collection(this.firestore, 'clientes', clienteId, 'usuarios'),
    );
    return snap.docs
      .map((d) => ({ uid: d.id, ...d.data() }) as Usuario)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  crear(datos: DatosNuevoUsuario) {
    return this.llamar('crearUsuario', datos);
  }

  actualizar(datos: DatosEdicionUsuario) {
    return this.llamar('actualizarUsuario', datos);
  }

  cambiarEstado(uid: string, activo: boolean) {
    return this.llamar('cambiarEstadoUsuario', { uid, activo });
  }

  restablecerPassword(uid: string, password: string) {
    return this.llamar('restablecerPassword', { uid, password });
  }

  private async llamar(nombre: string, datos: unknown): Promise<void> {
    try {
      await httpsCallable(this.functions, nombre)(datos);
    } catch (e) {
      // Las Functions lanzan HttpsError con mensajes ya pensados para el usuario.
      const mensaje = (e as { message?: string }).message;
      throw new Error(mensaje || 'No se pudo completar la operación.');
    }
  }
}
