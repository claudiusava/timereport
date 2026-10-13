export interface Coordenadas {
  lat: number;
  lng: number;
}

export interface Posicion extends Coordenadas {
  /** Radio de incertidumbre en metros que da el navegador. */
  precision: number;
}

export function obtenerPosicion(): Promise<Posicion> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Este navegador no permite obtener la ubicación.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, precision: pos.coords.accuracy }),
      (err) => {
        const mensajes: Record<number, string> = {
          1: 'Necesitamos tu ubicación para fichar. Permite el acceso a la ubicación en el navegador.',
          2: 'No se pudo obtener tu ubicación. Comprueba que el GPS está activado.',
          3: 'La ubicación está tardando demasiado. Vuelve a intentarlo.',
        };
        reject(new Error(mensajes[err.code] ?? 'No se pudo obtener tu ubicación.'));
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    );
  });
}

/** Acepta "40.123, -3.456" (el formato que copia Google Maps). */
export function parsearCoordenadas(texto: string): Coordenadas | null {
  const m = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(texto);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export function formatearCoordenadas(c: Coordenadas | null | undefined): string {
  return c ? `${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}` : '';
}

export function enlaceMapa(c: Coordenadas): string {
  return `https://www.google.com/maps?q=${c.lat},${c.lng}`;
}

export function deGeoPoint(
  g: { latitude: number; longitude: number } | null | undefined,
): Coordenadas | null {
  return g ? { lat: g.latitude, lng: g.longitude } : null;
}

export function formatearDistancia(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  const km = Math.round(m / 100) / 10;
  return `${Number.isInteger(km) ? km : km.toFixed(1).replace('.', ',')} km`;
}
