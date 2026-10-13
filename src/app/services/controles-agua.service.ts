import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  QueryConstraint,
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from '@angular/fire/firestore';
import {
  Storage,
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from '@angular/fire/storage';

import { Comunidad, ControlAgua } from '../models/modelos';
import { comprimirImagen } from '../shared/imagen';
import { AuthService } from './auth.service';
import { FiltroRegistros } from './imputaciones.service';

export interface DatosControlAgua {
  comunidad: Comunidad;
  cloro: number;
  ph: number;
  banistas: number;
  rebosadero: number;
  aguaDepurada: number;
  foto: File;
}

@Injectable({ providedIn: 'root' })
export class ControlesAguaService {
  private readonly firestore = inject(Firestore);
  private readonly storage = inject(Storage);
  private readonly auth = inject(AuthService);
  private readonly urls = new Map<string, Promise<string>>();

  private coleccion() {
    const { clienteId } = this.auth.requerirSesion();
    return collection(this.firestore, 'clientes', clienteId, 'controlesAgua');
  }

  async mios(desde: Date, max = 100): Promise<ControlAgua[]> {
    const { uid } = this.auth.requerirSesion();
    return this.consultar([
      where('uid', '==', uid),
      where('fecha', '>=', Timestamp.fromDate(desde)),
      orderBy('fecha', 'desc'),
      limit(max),
    ]);
  }

  /** Solo admin. */
  async registros(filtro: FiltroRegistros): Promise<ControlAgua[]> {
    const condiciones: QueryConstraint[] = [];
    if (filtro.uid) condiciones.push(where('uid', '==', filtro.uid));
    condiciones.push(
      where('fecha', '>=', Timestamp.fromDate(filtro.desde)),
      where('fecha', '<', Timestamp.fromDate(filtro.hasta)),
      orderBy('fecha', 'desc'),
    );
    return this.consultar(condiciones);
  }

  /**
   * Sube primero la foto (con el id del futuro documento en la ruta) y despues
   * crea el documento que la referencia.
   */
  async crear(datos: DatosControlAgua): Promise<void> {
    const sesion = this.auth.requerirSesion();
    const docRef = doc(this.coleccion());
    const fotoPath = `clientes/${sesion.clienteId}/controlesAgua/${sesion.uid}/${docRef.id}.jpg`;

    const foto = await comprimirImagen(datos.foto);
    await uploadBytes(ref(this.storage, fotoPath), foto, {
      contentType: 'image/jpeg',
    });

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
    });
  }

  urlFoto(path: string): Promise<string> {
    let url = this.urls.get(path);
    if (!url) {
      url = getDownloadURL(ref(this.storage, path));
      url.catch(() => this.urls.delete(path));
      this.urls.set(path, url);
    }
    return url;
  }

  /** Solo admin: borra el registro y su foto. */
  async eliminar(control: ControlAgua): Promise<void> {
    await deleteDoc(doc(this.coleccion(), control.id));
    if (control.fotoPath) {
      try {
        await deleteObject(ref(this.storage, control.fotoPath));
      } catch (e) {
        if ((e as { code?: string }).code !== 'storage/object-not-found') {
          console.warn('No se pudo borrar la foto', e);
        }
      }
    }
  }

  private async consultar(condiciones: QueryConstraint[]): Promise<ControlAgua[]> {
    const snap = await getDocs(query(this.coleccion(), ...condiciones));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ControlAgua);
  }
}
