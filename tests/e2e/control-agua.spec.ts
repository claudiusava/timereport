import { FOTO, aviso, elegir, entrar, expect, test } from './comun';
import { COMUNIDADES } from './datos';

test.describe('Control del agua de un socorrista', () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page, 'socorrista');
    await page.locator('mat-sidenav').getByRole('link', { name: 'Control de agua' }).click();
    await expect(page.getByRole('heading', { name: 'Control del agua' })).toBeVisible();
  });

  test('sin rellenar avisa de lo que falta', async ({ page }) => {
    await page.getByRole('button', { name: 'Guardar control' }).click();
    await expect(page.getByRole('alert')).toContainText('Revisa los campos marcados en rojo');
    await expect(page.getByText('Elige un valor').first()).toBeVisible();
  });

  test('avisa de valores fuera de rango y pide la foto', async ({ page }) => {
    await expect(page.getByRole('combobox', { name: 'Piscina / comunidad' })).toContainText(COMUNIDADES.pinos.nombre);

    // Los valores fuera de rango llevan la señal de advertencia en el desplegable.
    await page.getByRole('combobox', { name: /Cloro libre/ }).click();
    await expect(page.getByRole('option', { name: /3,0/ }).locator('.fuera-rango')).toBeVisible();
    await expect(page.getByRole('option', { name: /1,0/ }).locator('.fuera-rango')).toHaveCount(0);
    await page.getByRole('option', { name: /3,0/ }).click();
    await expect(page.getByText('Fuera del rango recomendado')).toBeVisible();

    await elegir(page, 'pH', /^7,4/);
    await page.getByLabel('Bañistas').fill('12');
    await page.getByLabel('Nivel de rebosadero').fill('3');
    await page.getByLabel('Agua depurada').fill('25.5');

    await page.getByRole('button', { name: 'Guardar control' }).click();
    await expect(page.getByRole('alert')).toContainText('Haz una foto del control');

    await page.locator('input[type=file]').setInputFiles(FOTO);
    await expect(page.getByAltText('Vista previa de la foto')).toBeVisible();
    await page.getByRole('button', { name: 'Guardar control' }).click();
    await aviso(page, 'Control guardado');

    // Se limpia el formulario, pero se mantiene la piscina.
    await expect(page.getByLabel('Bañistas')).toHaveValue('');
    await expect(page.getByRole('combobox', { name: 'Piscina / comunidad' })).toContainText(COMUNIDADES.pinos.nombre);

    const ultimo = page.locator('ul.lista li').first();
    await expect(ultimo).toContainText(COMUNIDADES.pinos.nombre);
    await expect(ultimo).toContainText('12 bañistas');
    await expect(ultimo.locator('.chip.alerta')).toHaveText('Cl 3,0');
    await expect(ultimo).toContainText('pH 7,4');
  });

  test('un número de bañistas no válido no se guarda', async ({ page }) => {
    await page.getByLabel('Bañistas').fill('-2');
    await page.getByLabel('Bañistas').blur();
    await expect(page.getByText('Número entero (0 o más)')).toBeVisible();
  });
});
