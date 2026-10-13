import { Injectable, inject } from '@angular/core';
import {
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
} from 'firebase/firestore';

import { AuthService } from '../core/auth.service';
import { db } from '../core/firebase';
import { Comunidad } from './modelos';

export interface DatosComunidad {
  nombre: string;
  codigo: string;
  ubicacion: GeoPoint;
  activa: boolean;
}

@Injectable({ providedIn: 'root' })
export class ComunidadesService {
  private readonly auth = inject(AuthService);

  private coleccion() {
    return collection(db, 'clientes', this.auth.requerirSesion().clienteId, 'comunidades');
  }

  /** Admin: todas. Trabajador: solo las asignadas. Ordenadas por nombre. */
  async listar(): Promise<Comunidad[]> {
    const s = this.auth.requerirSesion();
    const q = s.rol === 'admin' ? query(this.coleccion()) : query(this.coleccion(), where('asignados', 'array-contains', s.uid));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, activa: true, ...d.data() }) as Comunidad)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  async crear(datos: DatosComunidad) {
    await addDoc(this.coleccion(), { ...datos, asignados: [], createdAt: serverTimestamp() });
  }

  async actualizar(id: string, datos: DatosComunidad) {
    await updateDoc(doc(this.coleccion(), id), { ...datos });
  }

  async eliminar(id: string) {
    await deleteDoc(doc(this.coleccion(), id));
  }
}
