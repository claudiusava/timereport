// Genera los iconos PNG de la app instalable (public/iconos/*.png) dibujando
// el mismo reloj que public/logo-timereport.svg. Sin dependencias: PNG a mano.
//
//   node scripts/iconos-pwa.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const FONDO = [0x00, 0x65, 0x8f];
const BLANCO = [255, 255, 255];

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function bloque(tipo, datos) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(datos.length);
  const td = Buffer.concat([Buffer.from(tipo), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function distSegmento(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

function icono(tam, mascara) {
  const filas = [];
  const esc = tam / 64;
  // En los iconos "maskable" el dibujo ocupa el 80 % central.
  const zoom = mascara ? 0.8 : 1;
  for (let y = 0; y < tam; y++) {
    const fila = [0];
    for (let x = 0; x < tam; x++) {
      const u = ((x + 0.5) / esc - 32) / zoom + 32;
      const v = ((y + 0.5) / esc - 32) / zoom + 32;
      const r = 14;
      const dentro = mascara || (Math.abs(u - 32) < 32 - r || Math.abs(v - 32) < 32 - r || Math.hypot(Math.abs(u - 32) - (32 - r), Math.abs(v - 32) - (32 - r)) < r);
      const aro = Math.abs(Math.hypot(u - 32, v - 32) - 19) < 2.5;
      const agujas = distSegmento(u, v, 32, 20, 32, 33) < 2.5 || distSegmento(u, v, 32, 33, 40, 39) < 2.5;
      const color = aro || agujas ? BLANCO : FONDO;
      fila.push(...color, dentro ? 255 : 0);
    }
    filas.push(Buffer.from(fila));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(tam, 0);
  ihdr.writeUInt32BE(tam, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloque('IHDR', ihdr),
    bloque('IDAT', deflateSync(Buffer.concat(filas))),
    bloque('IEND', Buffer.alloc(0)),
  ]);
}

writeFileSync('public/iconos/icono-192.png', icono(192, false));
writeFileSync('public/iconos/icono-512.png', icono(512, false));
writeFileSync('public/iconos/icono-mascara-512.png', icono(512, true));
console.log('Iconos PWA generados en public/iconos/');
