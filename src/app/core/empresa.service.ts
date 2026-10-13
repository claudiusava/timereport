import { Injectable, computed, signal } from '@angular/core';
import { doc, getDoc } from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';

import { Empresa } from '../data/modelos';
import { guardar, leer } from './almacen';
import { db, storage } from './firebase';
import { COLOR_POR_DEFECTO, ModoTema, aplicarModo, aplicarTema } from './tema';

const LOGO_POR_DEFECTO = 'logo-timereport.svg';

/** Empresa activa: marca (logo, nombre, colores) y configuracion de fichaje. */
@Injectable({ providedIn: 'root' })
export class EmpresaService {
  /** Empresa recordada en este dispositivo (del enlace /#/c/{id} o del login). */
  readonly id = signal<string | null>(leer('empresa'));
  readonly empresa = signal<Empresa | null>(null);
  readonly logoUrl = signal(LOGO_POR_DEFECTO);
  readonly modo = signal<ModoTema>((leer('tema') as ModoTema) ?? 'sistema');

  readonly nombreApp = computed(() => this.empresa()?.branding.nombreApp || 'TimeReport');
  readonly esDemo = computed(() => this.empresa()?.demo === true);
  readonly config = computed(() => ({
    radioFichajeM: 1000,
    maxFichajesDia: 2,
    ...this.empresa()?.config,
  }));

  private peticion = 0;

  constructor() {
    aplicarModo(this.modo());
    aplicarTema(COLOR_POR_DEFECTO);
    const id = this.id();
    if (id) void this.cargar(id).catch(() => undefined);
  }

  /**
   * Carga la marca de una empresa. Devuelve false si no existe. Lanza si hay
   * un error de red (para no confundirlo con "no existe").
   */
  async cargar(id: string): Promise<boolean> {
    const clave = id.trim().toLowerCase();
    if (!/^[a-z0-9-]{2,40}$/.test(clave)) return false;
    const n = ++this.peticion;
    const snap = await getDoc(doc(db, 'clientes', clave));
    if (n !== this.peticion) return snap.exists(); // ya hay otra carga mas reciente
    if (!snap.exists()) return false;

    const empresa = { id: snap.id, ...snap.data() } as Empresa;
    this.empresa.set(empresa);
    this.id.set(clave);
    guardar('empresa', clave);
    aplicarTema(empresa.branding?.colorPrimario ?? COLOR_POR_DEFECTO);
    document.title = this.nombreApp();

    const logo = empresa.branding?.logoPath;
    let url = LOGO_POR_DEFECTO;
    if (logo) url = await getDownloadURL(ref(storage, logo)).catch(() => LOGO_POR_DEFECTO);
    if (n === this.peticion) this.logoUrl.set(url);
    return true;
  }

  recargar() {
    const id = this.id();
    return id ? this.cargar(id) : Promise.resolve(false);
  }

  olvidar() {
    this.peticion++;
    this.id.set(null);
    this.empresa.set(null);
    this.logoUrl.set(LOGO_POR_DEFECTO);
    guardar('empresa', null);
    aplicarTema(COLOR_POR_DEFECTO);
    document.title = 'TimeReport';
  }

  cambiarModo(modo: ModoTema) {
    this.modo.set(modo);
    guardar('tema', modo);
    aplicarModo(modo);
  }
}
