import { Injectable, computed, inject, signal } from '@angular/core';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { Storage, getDownloadURL, ref } from '@angular/fire/storage';

import { Cliente, ConfigCliente } from '../models/modelos';

const CLAVE_CLIENTE = 'timereport.cliente';

const MARCA_POR_DEFECTO = {
  nombreApp: 'TimeReport',
  colorPrimario: '#0e7490',
  colorSecundario: '#164e63',
};

export const CONFIG_POR_DEFECTO: ConfigCliente = {
  radioFichajeM: 1000,
  maxFichajesDia: 2,
};

@Injectable({ providedIn: 'root' })
export class BrandingService {
  private readonly firestore = inject(Firestore);
  private readonly storage = inject(Storage);

  /** Empresa recordada en este dispositivo (del enlace /#/c/{id} o del login). */
  readonly clienteId = signal<string | null>(leerClienteGuardado());
  readonly cliente = signal<Cliente | null>(null);
  readonly logoUrl = signal<string>('logo-timereport.svg');

  readonly nombreApp = computed(
    () => this.cliente()?.branding.nombreApp || MARCA_POR_DEFECTO.nombreApp,
  );
  readonly config = computed<ConfigCliente>(() => ({
    ...CONFIG_POR_DEFECTO,
    ...this.cliente()?.config,
  }));

  constructor() {
    const id = this.clienteId();
    if (id) void this.cargar(id);
    else this.aplicarColores();
  }

  /** Carga la marca de un cliente. Devuelve false si no existe. */
  async cargar(clienteId: string): Promise<boolean> {
    const id = clienteId.trim().toLowerCase();
    if (!/^[a-z0-9-]{2,40}$/.test(id)) return false;
    let snap;
    try {
      snap = await getDoc(doc(this.firestore, 'clientes', id));
    } catch (e) {
      console.error('No se pudo cargar la empresa', e);
      return false;
    }
    if (!snap.exists()) return false;

    const cliente = { id: snap.id, ...snap.data() } as Cliente;
    this.cliente.set(cliente);
    this.clienteId.set(id);
    guardarCliente(id);
    this.aplicarColores();

    const logoPath = cliente.branding?.logoPath;
    if (logoPath) {
      try {
        this.logoUrl.set(await getDownloadURL(ref(this.storage, logoPath)));
      } catch (e) {
        console.warn('No se pudo cargar el logo', e);
      }
    } else {
      this.logoUrl.set('logo-timereport.svg');
    }
    return true;
  }

  olvidarCliente() {
    this.clienteId.set(null);
    this.cliente.set(null);
    this.logoUrl.set('logo-timereport.svg');
    guardarCliente(null);
    this.aplicarColores();
  }

  private aplicarColores() {
    const b = this.cliente()?.branding;
    const primario = esColor(b?.colorPrimario)
      ? b!.colorPrimario
      : MARCA_POR_DEFECTO.colorPrimario;
    const secundario = esColor(b?.colorSecundario)
      ? b!.colorSecundario
      : MARCA_POR_DEFECTO.colorSecundario;
    const raiz = document.documentElement.style;
    raiz.setProperty('--color-primario', primario);
    raiz.setProperty('--color-secundario', secundario);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', primario);
    document.title = this.nombreApp();
  }
}

function esColor(valor: string | undefined): valor is string {
  return !!valor && /^#[0-9a-fA-F]{6}$/.test(valor);
}

// localStorage puede no estar disponible (modo privado de algunos moviles).
function leerClienteGuardado(): string | null {
  try {
    return localStorage.getItem(CLAVE_CLIENTE);
  } catch {
    return null;
  }
}

function guardarCliente(id: string | null) {
  try {
    if (id) localStorage.setItem(CLAVE_CLIENTE, id);
    else localStorage.removeItem(CLAVE_CLIENTE);
  } catch {
    // Sin persistencia: habra que volver a escribir la empresa.
  }
}
