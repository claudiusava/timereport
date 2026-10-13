// Reglas de fichaje compartidas por la app y las Cloud Functions.
// Copia de functions/src/reglas.ts: si cambias una, cambia la otra (lo
// comprueba tests/unit/copias.test.ts).

export type TipoFichaje = 'entrada' | 'salida';

/**
 * Horas maximas entre una entrada y su salida. Pasado ese tiempo se entiende
 * que el trabajador olvido fichar la salida y lo siguiente es una entrada
 * nueva. Permite turnos que cruzan la medianoche (p. ej. 22:00 -> 06:00).
 */
export const MAX_HORAS_TURNO = 16;

/** Siguiente tipo de fichaje a partir del ultimo fichaje valido del trabajador. */
export function siguienteTipo(
  ultimo: { tipo: TipoFichaje; fecha: Date } | null,
  ahora: Date,
): TipoFichaje {
  if (!ultimo || ultimo.tipo === 'salida') return 'entrada';
  const horas = (ahora.getTime() - ultimo.fecha.getTime()) / 3600000;
  return horas < MAX_HORAS_TURNO ? 'salida' : 'entrada';
}

/** Distancia en metros entre dos puntos (formula de Haversine). */
export function distanciaM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
