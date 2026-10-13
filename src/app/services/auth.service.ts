import { Injectable, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  Auth,
  User,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut,
} from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { filter, firstValueFrom } from 'rxjs';

import { Claims, Rol } from '../models/modelos';
import { emailDeLogin } from '../shared/email-usuario';

export interface Sesion {
  uid: string;
  clienteId: string;
  rol: Rol;
  nombre: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);

  /** undefined mientras Firebase restaura la sesion al arrancar. */
  private readonly _sesion = signal<Sesion | null | undefined>(undefined);
  readonly sesion = this._sesion.asReadonly();
  readonly esAdmin = computed(() => this._sesion()?.rol === 'admin');
  readonly puedeControlAgua = computed(() => {
    const rol = this._sesion()?.rol;
    return rol === 'admin' || rol === 'socorrista';
  });

  private readonly sesion$ = toObservable(this._sesion);

  constructor() {
    // onIdTokenChanged (y no onAuthStateChanged) para enterarse tambien de
    // los cambios de claims cuando se refresca el token.
    onIdTokenChanged(this.auth, (user) => {
      void this.actualizarSesion(user);
    });
  }

  /** Espera a que se sepa si hay sesion o no (para los guards). */
  sesionResuelta(): Promise<Sesion | null> {
    return firstValueFrom(
      this.sesion$.pipe(filter((s): s is Sesion | null => s !== undefined)),
    );
  }

  /** Devuelve la sesion o lanza si no hay (para los servicios de datos). */
  requerirSesion(): Sesion {
    const sesion = this._sesion();
    if (!sesion) throw new Error('No hay sesion iniciada');
    return sesion;
  }

  async login(usuario: string, password: string, clienteId: string | null) {
    if (!usuario.includes('@') && !clienteId) {
      throw new Error('Indica el codigo de tu empresa.');
    }
    let email: string;
    try {
      email = emailDeLogin(usuario, clienteId ?? '');
    } catch {
      throw new Error('Usuario o contraseña incorrectos.');
    }
    try {
      const cred = await signInWithEmailAndPassword(this.auth, email, password);
      await this.actualizarSesion(cred.user, true);
    } catch (e) {
      throw new Error(mensajeErrorAuth(e));
    }
    const sesion = this._sesion();
    if (!sesion) {
      await signOut(this.auth);
      throw new Error('Tu usuario no tiene empresa asignada. Avisa al administrador.');
    }
    return sesion;
  }

  logout() {
    return signOut(this.auth);
  }

  private async actualizarSesion(user: User | null, forzarRefresco = false) {
    if (!user) {
      this._sesion.set(null);
      return;
    }
    try {
      const token = await user.getIdTokenResult(forzarRefresco);
      const claims = token.claims as Partial<Claims>;
      if (!claims.clienteId || !claims.rol) {
        this._sesion.set(null);
        return;
      }
      const perfil = await getDoc(
        doc(this.firestore, 'clientes', claims.clienteId, 'usuarios', user.uid),
      );
      this._sesion.set({
        uid: user.uid,
        clienteId: claims.clienteId,
        rol: claims.rol,
        nombre: (perfil.data()?.['nombre'] as string | undefined) ?? '',
      });
    } catch (e) {
      console.error('No se pudo cargar la sesion', e);
      this._sesion.set(null);
    }
  }
}

function mensajeErrorAuth(e: unknown): string {
  const code = (e as { code?: string }).code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/invalid-email':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Usuario o contraseña incorrectos.';
    case 'auth/user-disabled':
      return 'Tu usuario está desactivado. Avisa al administrador.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Espera unos minutos y vuelve a probar.';
    case 'auth/network-request-failed':
      return 'Sin conexión. Comprueba tu conexión a internet.';
    default:
      return 'No se pudo iniciar sesión. Inténtalo de nuevo.';
  }
}
