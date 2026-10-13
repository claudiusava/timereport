import { Injectable, computed, inject, signal } from '@angular/core';
import {
  EmailAuthProvider,
  User,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from 'firebase/auth';
import { Unsubscribe, doc, onSnapshot } from 'firebase/firestore';

import { Rol } from '../data/modelos';
import { emailDeLogin } from '../shared/email-usuario';
import { mensajeDeError } from './errores';
import { EmpresaService } from './empresa.service';
import { auth, db } from './firebase';

export interface Sesion {
  uid: string;
  clienteId: string;
  rol: Rol;
  nombre: string;
  username: string;
}

/**
 * Sesion del usuario. El rol y el estado salen del perfil en Firestore (que
 * se escucha en tiempo real): si el admin lo desactiva o le cambia el rol,
 * la app reacciona al momento.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly empresa = inject(EmpresaService);

  /** undefined mientras se resuelve la sesion al arrancar. */
  private readonly _sesion = signal<Sesion | null | undefined>(undefined);
  readonly sesion = this._sesion.asReadonly();
  /** Mensaje para el login cuando se cierra la sesion por un motivo concreto. */
  readonly motivoCierre = signal('');

  readonly esAdmin = computed(() => this._sesion()?.rol === 'admin');
  readonly puedeControlAgua = computed(() => ['admin', 'socorrista'].includes(this._sesion()?.rol ?? ''));

  private dejarDeEscuchar?: Unsubscribe;
  private uidActual: string | null = null;
  private esperando: ((s: Sesion | null) => void)[] = [];

  constructor() {
    onAuthStateChanged(auth, (user) => void this.alCambiarUsuario(user));
  }

  /** Espera a que se sepa si hay sesion (para los guards). */
  sesionResuelta(): Promise<Sesion | null> {
    const s = this._sesion();
    return s !== undefined ? Promise.resolve(s) : new Promise((r) => this.esperando.push(r));
  }

  requerirSesion(): Sesion {
    const s = this._sesion();
    if (!s) throw new Error('Tu sesión ha caducado. Vuelve a entrar.');
    return s;
  }

  async login(usuario: string, password: string, clienteId: string): Promise<Sesion> {
    this.motivoCierre.set('');
    let email: string;
    try {
      email = emailDeLogin(usuario, clienteId);
    } catch {
      throw new Error('Usuario o contraseña incorrectos.');
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      throw new Error(mensajeDeError(e, 'No se pudo iniciar sesión.'));
    }
    // Si ya habia sesion con este mismo usuario, Firebase no avisa de ningun
    // cambio: se reutiliza en lugar de esperar.
    const actual = this._sesion();
    const sesion = actual && actual.uid === auth.currentUser?.uid ? actual : await this.siguienteResolucion();
    if (!sesion) throw new Error(this.motivoCierre() || 'No se pudo iniciar sesión.');
    return sesion;
  }

  async logout(motivo = '') {
    this.motivoCierre.set(motivo);
    await signOut(auth);
  }

  async cambiarPassword(actual: string, nueva: string) {
    const user = auth.currentUser;
    if (!user?.email) throw new Error('Tu sesión ha caducado. Vuelve a entrar.');
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, actual));
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        throw new Error('La contraseña actual no es correcta.');
      }
      throw new Error(mensajeDeError(e));
    }
    await updatePassword(user, nueva);
  }

  private siguienteResolucion(): Promise<Sesion | null> {
    return new Promise((r) => this.esperando.push(r));
  }

  private resolver(s: Sesion | null) {
    this._sesion.set(s);
    const pendientes = this.esperando;
    this.esperando = [];
    pendientes.forEach((r) => r(s));
  }

  private async alCambiarUsuario(user: User | null) {
    this.dejarDeEscuchar?.();
    this.dejarDeEscuchar = undefined;

    // Si en otra pestaña entra otro usuario, se recarga para no mezclar
    // datos del usuario anterior que esten en memoria.
    if (this.uidActual && user && user.uid !== this.uidActual) {
      location.reload();
      return;
    }
    this.uidActual = user?.uid ?? null;
    if (!user) {
      this.resolver(null);
      return;
    }

    let clienteId: string | undefined;
    try {
      clienteId = (await user.getIdTokenResult()).claims['clienteId'] as string | undefined;
    } catch {
      // Sin red al arrancar: no se cierra la sesion, se reintenta en unos segundos.
      setTimeout(() => {
        if (auth.currentUser?.uid === user.uid) void this.alCambiarUsuario(user);
      }, 3000);
      return;
    }
    if (!clienteId) {
      this.motivoCierre.set('Tu usuario no tiene empresa asignada. Avisa al administrador.');
      await signOut(auth);
      return;
    }
    if (this.empresa.empresa()?.id !== clienteId) void this.empresa.cargar(clienteId).catch(() => undefined);

    this.dejarDeEscuchar = onSnapshot(
      doc(db, 'clientes', clienteId, 'usuarios', user.uid),
      async (snap) => {
        const perfil = snap.data();
        if (!snap.exists() || perfil?.['activo'] !== true) {
          if (snap.metadata.fromCache && !snap.exists()) return; // sin red: esperar al servidor
          await this.logout('Tu usuario está desactivado. Avisa al administrador.');
          return;
        }
        const rol = perfil['rol'] as Rol;
        const token = await user.getIdTokenResult().catch(() => null);
        // Si el rol ha cambiado, se refresca el token para que las reglas
        // (que tambien miran el claim) lo reconozcan.
        if (token && token.claims['rol'] !== rol) await user.getIdToken(true).catch(() => undefined);
        this.resolver({
          uid: user.uid,
          clienteId: clienteId!,
          rol,
          nombre: perfil['nombre'] as string,
          username: perfil['username'] as string,
        });
      },
      async (error) => {
        console.error('No se pudo leer el perfil', error);
        if ((error as { code?: string }).code === 'permission-denied') {
          await this.logout('Tu sesión ya no es válida. Vuelve a entrar.');
        }
      },
    );
  }
}
