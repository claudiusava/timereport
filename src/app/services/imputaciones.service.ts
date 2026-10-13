import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  QueryConstraint,
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from '@angular/fire/firestore';

import { Comunidad, Imputacion, TipoFichaje } from '../models/modelos';
import { AuthService } from './auth.service';

export interface FiltroRegistros {
  desde: Date;
  /** Exclusivo. */
  hasta: Date;
  uid?: string;
}

@Injectable({ providedIn: 'root' })
export class ImputacionesService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);

  private coleccion() {
    const { clienteId } = this.auth.requerirSesion();
    return collection(this.firestore, 'clientes', clienteId, 'imputaciones');
  }

  /** Fichajes propios desde una fecha, del mas reciente al mas antiguo. */
  async mios(desde: Date, max = 200): Promise<Imputacion[]> {
    const { uid } = this.auth.requerirSesion();
    return this.consultar([
      where('uid', '==', uid),
      where('fecha', '>=', Timestamp.fromDate(desde)),
      orderBy('fecha', 'desc'),
      limit(max),
    ]);
  }

  /** Solo admin: fichajes de todo el cliente en un rango. */
  async registros(filtro: FiltroRegistros): Promise<Imputacion[]> {
    const condiciones: QueryConstraint[] = [];
    if (filtro.uid) condiciones.push(where('uid', '==', filtro.uid));
    condiciones.push(
      where('fecha', '>=', Timestamp.fromDate(filtro.desde)),
      where('fecha', '<', Timestamp.fromDate(filtro.hasta)),
      orderBy('fecha', 'desc'),
    );
    return this.consultar(condiciones);
  }

  /** La fecha la pone el servidor (la regla exige fecha == request.time). */
  async fichar(comunidad: Comunidad, tipo: TipoFichaje): Promise<void> {
    const sesion = this.auth.requerirSesion();
    await addDoc(this.coleccion(), {
      uid: sesion.uid,
      usuarioNombre: sesion.nombre,
      comunidadId: comunidad.id,
      comunidadNombre: comunidad.nombre,
      tipo,
      fecha: serverTimestamp(),
    });
  }

  async eliminar(id: string): Promise<void> {
    await deleteDoc(doc(this.coleccion(), id));
  }

  private async consultar(condiciones: QueryConstraint[]): Promise<Imputacion[]> {
    const snap = await getDocs(query(this.coleccion(), ...condiciones));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Imputacion);
  }
}
