import { inicioDelDia } from './fechas';
import { MAX_HORAS_TURNO, TipoFichaje } from './reglas';

/** Lo minimo que hace falta de un fichaje para calcular jornadas. */
export interface FichajeBase {
  id: string;
  uid: string;
  tipo: TipoFichaje;
  fecha: { toMillis(): number; toDate(): Date } | null;
  anulado?: unknown;
}

export interface Tramo<F extends FichajeBase = FichajeBase> {
  entrada: F | null;
  salida: F | null;
  /** Minutos trabajados (0 si al tramo le falta la entrada o la salida). */
  minutos: number;
  /** Entrada sin salida: puede estar en curso o ser un olvido. */
  abierto: boolean;
}

export interface Jornada<F extends FichajeBase = FichajeBase> {
  dia: Date;
  /** Todos los fichajes del dia (tambien los anulados), en orden. */
  fichajes: F[];
  tramos: Tramo<F>[];
  minutos: number;
  incidencias: string[];
}

/**
 * Agrupa los fichajes de UN trabajador en jornadas. Empareja cada entrada con
 * la salida siguiente aunque caiga al dia siguiente (turnos de noche) y
 * asigna el tramo al dia de la entrada. Los anulados se muestran pero no
 * cuentan.
 */
export function calcularJornadas<F extends FichajeBase>(fichajes: F[], ahora = new Date()): Jornada<F>[] {
  const ordenados = fichajes
    .filter((f) => f.fecha)
    .sort((a, b) => a.fecha!.toMillis() - b.fecha!.toMillis());
  const porDia = new Map<number, Jornada<F>>();
  const jornadaDe = (fecha: Date) => {
    const clave = inicioDelDia(fecha).getTime();
    let j = porDia.get(clave);
    if (!j) {
      j = { dia: new Date(clave), fichajes: [], tramos: [], minutos: 0, incidencias: [] };
      porDia.set(clave, j);
    }
    return j;
  };

  let abierta: F | null = null;
  const cerrarSinSalida = (entrada: F) => {
    const j = jornadaDe(entrada.fecha!.toDate());
    const horas = (ahora.getTime() - entrada.fecha!.toMillis()) / 3600000;
    j.tramos.push({ entrada, salida: null, minutos: 0, abierto: true });
    if (horas >= MAX_HORAS_TURNO) j.incidencias.push('Entrada sin salida');
  };

  for (const f of ordenados) {
    jornadaDe(f.fecha!.toDate()).fichajes.push(f);
    if (f.anulado) continue;
    if (f.tipo === 'entrada') {
      if (abierta) cerrarSinSalida(abierta);
      abierta = f;
    } else if (abierta && f.fecha!.toMillis() - abierta.fecha!.toMillis() < MAX_HORAS_TURNO * 3600000) {
      const minutos = (f.fecha!.toMillis() - abierta.fecha!.toMillis()) / 60000;
      const j = jornadaDe(abierta.fecha!.toDate());
      j.tramos.push({ entrada: abierta, salida: f, minutos, abierto: false });
      j.minutos += minutos;
      abierta = null;
    } else {
      if (abierta) cerrarSinSalida(abierta);
      abierta = null;
      const j = jornadaDe(f.fecha!.toDate());
      j.tramos.push({ entrada: null, salida: f, minutos: 0, abierto: false });
      j.incidencias.push('Salida sin entrada');
    }
  }
  if (abierta) cerrarSinSalida(abierta);

  return [...porDia.values()]
    .map((j) => ({ ...j, minutos: Math.round(j.minutos) }))
    .sort((a, b) => b.dia.getTime() - a.dia.getTime());
}

/** Agrupa fichajes de varios trabajadores por uid. */
export function porTrabajador<F extends FichajeBase>(fichajes: F[]): Map<string, F[]> {
  const mapa = new Map<string, F[]>();
  for (const f of fichajes) mapa.set(f.uid, [...(mapa.get(f.uid) ?? []), f]);
  return mapa;
}
