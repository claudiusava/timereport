import { type Locator, type Page, expect, test as base } from '@playwright/test';
import jpeg from 'jpeg-js';

import { EMPRESA, PASSWORD } from './datos';

/**
 * Cada prueba falla si la app escribe errores en la consola o lanza
 * excepciones sin capturar, aunque la pantalla parezca correcta.
 */
export const test = base.extend<{ erroresConsola: string[] }>({
  erroresConsola: [
    async ({ page }, usar) => {
      const errores: string[] = [];
      page.on('pageerror', (e) => errores.push(e.message));
      page.on('console', (m) => {
        // 400/409: el servidor rechaza algo a proposito (contraseña mal, usuario
        // repetido...); la prueba comprueba que la app lo explica en pantalla.
        if (m.type() === 'error' && !/status of (400|409)/.test(m.text())) errores.push(m.text());
      });
      await usar(errores);
      // Los fallos esperados (contraseña mal, permiso denegado...) los
      // muestra la app en pantalla; en consola no deberia haber nada.
      expect(errores, 'errores en la consola del navegador').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

export async function entrar(page: Page, usuario: string, password = PASSWORD) {
  await page.goto(`/#/c/${EMPRESA}`);
  await page.getByLabel('Usuario').fill(usuario);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/#\/app\//);
}

/** Abre una seccion desde el menu lateral. */
export async function ir(page: Page, seccion: string) {
  await page.locator('mat-sidenav').getByRole('link', { name: seccion, exact: true }).click();
}

export async function salir(page: Page) {
  await page.getByRole('button', { name: 'Menú de usuario' }).click();
  await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();
}

/** Abre un mat-select por su etiqueta (dentro de `dentro`) y elige una opcion. */
export async function elegir(page: Page, etiqueta: string, opcion: string | RegExp, dentro: Page | Locator = page) {
  await dentro.getByRole('combobox', { name: etiqueta }).click();
  await page.getByRole('option', { name: opcion }).click();
}

export async function aviso(page: Page, texto: string | RegExp) {
  await expect(page.locator('mat-snack-bar-container', { hasText: texto })).toBeVisible();
}

/** Foto pequeña, para el analizador. */
export const FOTO = {
  name: 'analizador.jpg',
  mimeType: 'image/jpeg',
  buffer: jpeg.encode({ data: Buffer.alloc(32 * 24 * 4, 0x80), width: 32, height: 24 }, 80).data,
};
