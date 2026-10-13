import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  GeoPoint,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from '@angular/fire/firestore';

import { Comunidad } from '../models/modelos';
import { AuthService } from './auth.service';

export interface DatosComunidad {
  nombre: string;
  codigo: string;
  ubicacion: GeoPoint;
}

@Injectable({ providedIn: 'root' })
export class ComunidadesService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);

  private coleccion() {
    const { clienteId } = this.auth.requerirSesion();
    return collection(this.firestore, 'clientes', clienteId, 'comunidades');
  }

  /** Admin: todas las del cliente. Trabajador: solo las que tiene asignadas. */
  async misComunidades(): Promise<Comunidad[]> {
    const sesion = this.auth.requerirSesion();
    const q =
      sesion.rol === 'admin'
        ? query(this.coleccion())
        : query(this.coleccion(), where('asignados', 'array-contains', sesion.uid));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Comunidad)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  async crear(datos: DatosComunidad): Promise<void> {
    await addDoc(this.coleccion(), {
      ...datos,
      asignados: [],
      activa: true,
      createdAt: serverTimestamp(),
    });
  }

  async actualizar(id: string, datos: DatosComunidad): Promise<void> {
    await updateDoc(doc(this.coleccion(), id), { ...datos });
  }

  async eliminar(id: string): Promise<void> {
    await deleteDoc(doc(this.coleccion(), id));
  }
}
