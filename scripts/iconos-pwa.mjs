// Genera los iconos PNG de la app instalable (public/iconos/*.png) a partir de
// public/logo-pooldata.svg, dibujándolo con el Chromium de Playwright.
//
//   node scripts/iconos-pwa.mjs
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const svg = readFileSync('public/logo-pooldata.svg', 'utf8');
// Para el icono "maskable": fondo a sangre y el dibujo en el 80 % central.
const fondo = svg.match(/<rect[^>]*fill="([^"]+)"/)[1];
const mascara = svg
  .replace(/<rect[^>]*\/>/, `<rect width="64" height="64" fill="${fondo}"/><g transform="translate(6.4 6.4) scale(0.8)">`)
  .replace('</svg>', '</g></svg>');

const navegador = await chromium.launch();
const pagina = await navegador.newPage();
for (const [archivo, tam, contenido] of [
  ['icono-192.png', 192, svg],
  ['icono-512.png', 512, svg],
  ['icono-mascara-512.png', 512, mascara],
]) {
  await pagina.setViewportSize({ width: tam, height: tam });
  await pagina.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${tam}px;height:${tam}px}</style>${contenido}`,
  );
  await pagina.screenshot({ path: `public/iconos/${archivo}`, omitBackground: true });
}
await navegador.close();
console.log('Iconos PWA generados en public/iconos/');
