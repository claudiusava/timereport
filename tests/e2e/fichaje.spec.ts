import { aviso, entrar, expect, test } from './comun';
import { CERCA, COMUNIDADES, LEJOS } from './datos';

test.describe('Fichaje de un maquinista', () => {
  test('lejos de la comunidad no deja fichar', async ({ page, context }) => {
    await context.setGeolocation(LEJOS);
    await entrar(page, 'maquinista');
    await expect(page.getByText('Todavía no has fichado hoy')).toBeVisible();
    await page.getByRole('button', { name: 'Fichar entrada' }).click();
    await expect(page.getByRole('alert')).toContainText(`de ${COMUNIDADES.pinos.nombre}`);
    await expect(page.getByText('Sin fichajes hoy.')).toBeVisible();
  });

  test('jornada completa: entrada, salida y límite diario', async ({ page, context }) => {
    await context.setGeolocation(CERCA);
    await entrar(page, 'maquinista');

    // Solo tiene una comunidad: viene elegida.
    await expect(page.getByRole('combobox', { name: 'Comunidad' })).toContainText(COMUNIDADES.pinos.nombre);

    await page.getByRole('button', { name: 'Fichar entrada' }).click();
    await aviso(page, `Entrada registrada en ${COMUNIDADES.pinos.nombre}`);
    await expect(page.getByText(/Trabajando desde las \d\d:\d\d/)).toBeVisible();

    // Al recargar sigue sabiendo que esta trabajando.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Fichar salida' })).toBeVisible();

    await page.getByRole('button', { name: 'Fichar salida' }).click();
    await aviso(page, 'Salida registrada');
    await expect(page.locator('.linea-tiempo li')).toHaveCount(2);

    // Segundo tramo (jornada partida) y ya no deja mas (maxFichajesDia = 2).
    await page.getByRole('button', { name: 'Fichar entrada' }).click();
    await aviso(page, 'Entrada registrada');
    await page.getByRole('button', { name: 'Fichar salida' }).click();
    await aviso(page, 'Salida registrada');
    await expect(page.getByText('Has completado los fichajes de hoy')).toBeVisible();
    await expect(page.getByRole('button', { name: /Fichar/ })).toHaveCount(0);
    await expect(page.locator('.linea-tiempo li')).toHaveCount(4);
  });

  test('el historial muestra los fichajes de hoy', async ({ page }) => {
    await entrar(page, 'maquinista');
    await page.getByRole('link', { name: 'Mi historial' }).first().click();
    await expect(page.getByRole('heading', { name: 'Mi historial' })).toBeVisible();
    await expect(page.locator('article.dia').first().locator('li')).toHaveCount(4);
    await expect(page.getByText('trabajadas')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Exportar a Excel' })).toBeEnabled();
  });

  test('exportar el historial descarga un Excel', async ({ page }) => {
    await entrar(page, 'maquinista');
    await page.goto('/#/app/historial');
    const descarga = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar a Excel' }).click();
    expect((await descarga).suggestedFilename()).toMatch(/\.xlsx$/);
  });
});
