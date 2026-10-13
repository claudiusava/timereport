import { Injectable, inject } from '@angular/core';
import {
  QueryConstraint,
  Timestamp,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { getBlob, ref, uploadBytes } from 'firebase/storage';

import { AuthService } from '../core/auth.service';
import { db, llamar, storage } from '../core/firebase';
import { comprimirImagen } from '../shared/imagen';
import { FiltroFechas, MAX_REGISTROS } from './fichajes.service';
import { Comunidad, ControlAgua } from './modelos';

export interface DatosControlAgua {
  comunidad: Comunidad;
  cloro: number;
  ph: number;
  banistas: number;
  rebosadero: number;
  aguaDepurada: number;
}

/** La foto no se pudo subir: el control ya esta guardado y se puede reintentar. */
export class FotoPendiente extends Error {
  constructor(readonly fotoPath: string, readonly foto: Blob) {
    super('El control se ha guardado, pero la foto no se ha podido subir.');
  }
}

@Injectable({ providedIn: 'root' })
export class ControlesAguaService {
  private readonly auth = inject(AuthService);
  private readonly fotos = new Map<string, Promise<string>>();

  private coleccion() {
    return collection(db, 'clientes', this.auth.requerirSesion().clienteId, 'controlesAgua');
  }

  mios(desde: Date): Promise<ControlAgua[]> {
    const { uid } = this.auth.requerirSesion();
    return this.consultar([where('uid', '==', uid), where('fecha', '>=', Timestamp.fromDate(desde)), orderBy('fecha', 'desc'), limit(500)]);
  }

  async registros(filtro: FiltroFechas): Promise<{ datos: ControlAgua[]; truncado: boolean }> {
    const datos = await this.consultar([
      ...(filtro.uid ? [where('uid', '==', filtro.uid)] : []),
      where('fecha', '>=', Timestamp.fromDate(filtro.desde)),
      where('fecha', '<', Timestamp.fromDate(filtro.hasta)),
      orderBy('fecha', 'desc'),
      limit(MAX_REGISTROS),
    ]);
    return { datos, truncado: datos.length >= MAX_REGISTROS };
  }

  /**
   * Crea el control (con la hora del servidor) y despues sube la foto a la
   * ruta reservada. Si la subida falla, lanza FotoPendiente para reintentar.
   */
  async crear(datos: DatosControlAgua, archivo: File): Promise<void> {
    const sesion = this.auth.requerirSesion();
    const foto = await comprimirImagen(archivo);
    const docRef = doc(this.coleccion());
    const fotoPath = `clientes/${sesion.clienteId}/controlesAgua/${sesion.uid}/${docRef.id}.jpg`;
    await setDoc(docRef, {
      uid: sesion.uid,
      usuarioNombre: sesion.nombre,
      comunidadId: datos.comunidad.id,
      comunidadNombre: datos.comunidad.nombre,
      cloro: datos.cloro,
      ph: datos.ph,
      banistas: datos.banistas,
      rebosadero: datos.rebosadero,
      aguaDepurada: datos.aguaDepurada,
      fotoPath,
      fecha: serverTimestamp(),
      anulado: null,
    });
    await this.subirFoto(fotoPath, foto);
  }

  async subirFoto(fotoPath: string, foto: Blob) {
    try {
      await uploadBytes(ref(storage, fotoPath), foto, { contentType: 'image/jpeg' });
    } catch (e) {
      console.error(e);
      throw new FotoPendiente(fotoPath, foto);
    }
  }

  /**
   * URL local (blob:) de una foto. Se descarga con getBlob, que pasa por las
   * reglas de Storage, en lugar de usar enlaces de descarga permanentes.
   */
  urlFoto(path: string): Promise<string> {
    let url = this.fotos.get(path);
    if (!url) {
      url = getBlob(ref(storage, path)).then((b) => URL.createObjectURL(b));
      url.catch(() => this.fotos.delete(path));
      this.fotos.set(path, url);
    }
    return url;
  }

  anular(id: string, motivo: string) {
    return llamar('anularRegistro', { coleccion: 'controlesAgua', id, motivo });
  }

  private async consultar(condiciones: QueryConstraint[]): Promise<ControlAgua[]> {
    const snap = await getDocs(query(this.coleccion(), ...condiciones));
    return snap.docs.map((d) => ({ id: d.id, anulado: null, ...d.data() }) as ControlAgua);
  }
}
