const LADO_MAXIMO = 1600;
const CALIDAD = 0.8;

/**
 * Reduce la foto de la camara (a menudo 4-12 MB) a un JPEG de como mucho
 * 1600 px de lado, que suele quedar en 200-500 KB. Asi la subida es rapida
 * con datos moviles y no se pasa del limite de 5 MB de storage.rules.
 */
export async function comprimirImagen(archivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo, {
    imageOrientation: 'from-image',
  });
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo procesar la foto');
  ctx.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo procesar la foto'))),
      'image/jpeg',
      CALIDAD,
    ),
  );
}
