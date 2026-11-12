import { type Page } from '@playwright/test';

import { aviso, entrar, expect, test } from './comun';

async function sinScrollHorizontal(page: Page) {
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(ancho, 'la página no debe desbordar a lo ancho').toBeLessThanOrEqual(1);
}

test.describe('En el móvil', () => {
  test('un maquinista ficha con la barra inferior', async ({ page }) => {
    await entrar(page, 'movil');
    const barra = page.getByRole('navigation', { name: 'Secciones' });
    await expect(barra).toBeVisible();
    await sinScrollHorizontal(page);

    await page.getByRole('button', { name: 'Fichar entrada' }).click();
    await aviso(page, 'Entrada registrada');
    await page.getByRole('button', { name: 'Fichar salida' }).click();
    await aviso(page, 'Salida registrada');

    await barra.getByRole('link', { name: /historial/i }).click();
    await expect(page.getByRole('heading', { name: 'Mi historial' })).toBeVisible();
    await sinScrollHorizontal(page);
  });

  test('el socorrista ve el formulario del agua entero', async ({ page }) => {
    await entrar(page, 'socorrista');
    await page.goto('/#/app/control-agua');
    await expect(page.getByRole('button', { name: 'Guardar control' })).toBeVisible();
    await sinScrollHorizontal(page);
  });

  test('las pantallas del administrador no desbordan', async ({ page }) => {
    await entrar(page, 'admin');
    for (const ruta of ['panel', 'registros', 'usuarios', 'comunidades', 'ajustes']) {
      await page.goto(`/#/app/${ruta}`);
      await expect(page.locator('main h1').first()).toBeVisible();
      await sinScrollHorizontal(page);
    }
    // En el movil los registros son tarjetas, no una tabla.
    await page.goto('/#/app/registros');
    await expect(page.locator('table.mat-mdc-table')).toHaveCount(0);
  });
});
