import { Injectable, inject } from '@angular/core';
import {
  QueryConstraint,
  Timestamp,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';

import { AuthService } from '../core/auth.service';
import { db, llamar } from '../core/firebase';
import { Posicion } from '../shared/geo';
import { siguienteTipo } from '../shared/reglas';
import { Fichaje, TipoFichaje } from './modelos';

export interface FiltroFechas {
  desde: Date;
  /** Exclusivo. */
  hasta: Date;
  uid?: string;
}

/** Tope de documentos por consulta del admin, para no traer años de golpe. */
export const MAX_REGISTROS = 3000;

@Injectable({ providedIn: 'root' })
export class FichajesService {
  private readonly auth = inject(AuthService);

  private coleccion() {
    return collection(db, 'clientes', this.auth.requerirSesion().clienteId, 'imputaciones');
  }

  /** Fichajes propios en un rango, del mas reciente al mas antiguo. */
  mios(desde: Date, hasta?: Date): Promise<Fichaje[]> {
    const { uid } = this.auth.requerirSesion();
    return this.consultar([
      where('uid', '==', uid),
      where('fecha', '>=', Timestamp.fromDate(desde)),
      ...(hasta ? [where('fecha', '<', Timestamp.fromDate(hasta))] : []),
      orderBy('fecha', 'desc'),
      limit(MAX_REGISTROS),
    ]);
  }

  /** Lo que le toca fichar ahora al usuario (la Cloud Function lo vuelve a comprobar). */
  async siguienteTipo(): Promise<{ tipo: TipoFichaje; ultimo: Fichaje | null }> {
    const { uid } = this.auth.requerirSesion();
    const recientes = await this.consultar([where('uid', '==', uid), orderBy('fecha', 'desc'), limit(20)]);
    const ultimo = recientes.find((f) => !f.anulado && f.fecha) ?? null;
    return {
      tipo: siguienteTipo(ultimo ? { tipo: ultimo.tipo, fecha: ultimo.fecha.toDate() } : null, new Date()),
      ultimo,
    };
  }

  fichar(comunidadId: string, tipo: TipoFichaje, posicion: Posicion) {
    return llamar<{ id: string; tipo: TipoFichaje; fecha: string }>('fichar', { comunidadId, tipo, posicion });
  }

  /** Solo admin. Devuelve tambien si se ha llegado al tope. */
  async registros(filtro: FiltroFechas): Promise<{ datos: Fichaje[]; truncado: boolean }> {
    const datos = await this.consultar([
      ...(filtro.uid ? [where('uid', '==', filtro.uid)] : []),
      where('fecha', '>=', Timestamp.fromDate(filtro.desde)),
      where('fecha', '<', Timestamp.fromDate(filtro.hasta)),
      orderBy('fecha', 'desc'),
      limit(MAX_REGISTROS),
    ]);
    return { datos, truncado: datos.length >= MAX_REGISTROS };
  }

  registrarManual(datos: { uid: string; comunidadId: string; tipo: TipoFichaje; fecha: Date; motivo: string }) {
    return llamar('registrarFichajeManual', { ...datos, fecha: datos.fecha.toISOString() });
  }

  anular(id: string, motivo: string) {
    return llamar('anularRegistro', { coleccion: 'imputaciones', id, motivo });
  }

  private async consultar(condiciones: QueryConstraint[]): Promise<Fichaje[]> {
    const snap = await getDocs(query(this.coleccion(), ...condiciones));
    return snap.docs.map((d) => ({ id: d.id, anulado: null, origen: 'app', ...d.data() }) as Fichaje);
  }
}
