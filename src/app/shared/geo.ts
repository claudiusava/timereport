export interface Coordenadas {
  lat: number;
  lng: number;
}

/** Distancia en metros entre dos puntos (formula de Haversine). */
export function distanciaM(a: Coordenadas, b: Coordenadas): number {
  const R = 6371000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function obtenerPosicion(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Este navegador no permite obtener la ubicación.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (err) => {
      const mensajes: Record<number, string> = {
        1: 'Necesitamos tu ubicación para fichar. Permite el acceso a la ubicación en el navegador.',
        2: 'No se pudo obtener tu ubicación. Comprueba que el GPS está activado.',
        3: 'La ubicación está tardando demasiado. Vuelve a intentarlo.',
      };
      reject(new Error(mensajes[err.code] ?? 'No se pudo obtener tu ubicación.'));
    }, {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 20000,
    });
  });
}

/** Acepta "40.123, -3.456" (el formato que se usaba en la app anterior). */
export function parsearCoordenadas(texto: string): Coordenadas | null {
  const m = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(texto);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
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
