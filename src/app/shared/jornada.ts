import { Imputacion } from '../models/modelos';
import { inicioDelDia } from './fechas';

export interface DiaFichajes {
  dia: Date;
  /** Fichajes del dia en orden cronologico. */
  fichajes: Imputacion[];
  /** Minutos entre cada entrada y su salida. */
  minutos: number;
  /** Hay una entrada sin su salida. */
  abierto: boolean;
}

/**
 * Agrupa fichajes por dia (del mas reciente al mas antiguo) y suma el tiempo
 * de cada pareja entrada -> salida.
 */
export function agruparPorDia(imputaciones: Imputacion[]): DiaFichajes[] {
  const porDia = new Map<number, Imputacion[]>();
  for (const imp of imputaciones) {
    if (!imp.fecha) continue;
    const clave = inicioDelDia(imp.fecha.toDate()).getTime();
    const lista = porDia.get(clave) ?? [];
    lista.push(imp);
    porDia.set(clave, lista);
  }

  return [...porDia.entries()]
    .sort(([a], [b]) => b - a)
    .map(([clave, lista]) => {
      const fichajes = [...lista].sort(
        (a, b) => a.fecha.toMillis() - b.fecha.toMillis(),
      );
      let minutos = 0;
      let entrada: Date | null = null;
      for (const f of fichajes) {
        if (f.tipo === 'entrada') {
          entrada = f.fecha.toDate();
        } else if (entrada) {
          minutos += (f.fecha.toMillis() - entrada.getTime()) / 60000;
          entrada = null;
        }
      }
      return { dia: new Date(clave), fichajes, minutos: Math.round(minutos), abierto: !!entrada };
    });
}

export function formatearMinutos(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${h} h ${String(m).padStart(2, '0')} min`;
}
