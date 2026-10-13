import { Injectable, signal } from '@angular/core';

export interface Aviso {
  id: number;
  tipo: 'ok' | 'error';
  texto: string;
}

export interface Confirmacion {
  titulo: string;
  texto: string;
  aceptar: string;
  peligro: boolean;
  responder: (ok: boolean) => void;
}

/** Mensajes flotantes y dialogos de confirmacion (los pinta AppComponent). */
@Injectable({ providedIn: 'root' })
export class AvisosService {
  readonly avisos = signal<Aviso[]>([]);
  readonly confirmacion = signal<Confirmacion | null>(null);
  private siguienteId = 1;

  ok(texto: string) {
    this.mostrar('ok', texto);
  }

  error(texto: string) {
    this.mostrar('error', texto);
  }

  /** Muestra el mensaje de un error capturado (o uno generico). */
  errorDe(e: unknown, porDefecto = 'Ha ocurrido un error.') {
    console.error(e);
    const mensaje = e instanceof Error && e.message ? e.message : porDefecto;
    this.error(traducirErrorFirebase(e) ?? mensaje);
  }

  confirmar(opciones: {
    titulo: string;
    texto: string;
    aceptar?: string;
    peligro?: boolean;
  }): Promise<boolean> {
    return new Promise((resolve) => {
      this.confirmacion.set({
        titulo: opciones.titulo,
        texto: opciones.texto,
        aceptar: opciones.aceptar ?? 'Aceptar',
        peligro: opciones.peligro ?? false,
        responder: (ok) => {
          this.confirmacion.set(null);
          resolve(ok);
        },
      });
    });
  }

  quitar(id: number) {
    this.avisos.update((lista) => lista.filter((a) => a.id !== id));
  }

  private mostrar(tipo: Aviso['tipo'], texto: string) {
    const id = this.siguienteId++;
    this.avisos.update((lista) => [...lista, { id, tipo, texto }]);
    setTimeout(() => this.quitar(id), tipo === 'error' ? 7000 : 3500);
  }
}

function traducirErrorFirebase(e: unknown): string | null {
  const code = (e as { code?: string }).code;
  switch (code) {
    case 'permission-denied':
    case 'storage/unauthorized':
      return 'No tienes permiso para hacer esto.';
    case 'unavailable':
    case 'storage/retry-limit-exceeded':
      return 'Sin conexión. Comprueba tu conexión a internet.';
    default:
      return null;
  }
}
