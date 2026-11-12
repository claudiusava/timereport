import { entrar, expect, salir, test } from './comun';
import { EMPRESA, PASSWORD } from './datos';

test.describe('Acceso', () => {
  test('la portada lleva al acceso', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('PoolData');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  });

  test('con la contraseña equivocada no entra y lo explica', async ({ page }) => {
    await page.goto(`/#/c/${EMPRESA}`);
    await expect(page.getByText('Piscinas E2E')).toBeVisible();
    await page.getByLabel('Usuario').fill('maquinista');
    await page.getByLabel('Contraseña', { exact: true }).fill('no-es-esta');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`#/c/${EMPRESA}`));
  });

  test('un usuario desactivado no puede entrar', async ({ page }) => {
    await page.goto(`/#/c/${EMPRESA}`);
    await page.getByLabel('Usuario').fill('baja');
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).not.toHaveURL(/#\/app/);
  });

  test('desde el acceso general se entra con el código de empresa', async ({ page }) => {
    await page.goto('/#/acceso');
    await page.getByLabel('Código de empresa').fill(EMPRESA);
    await page.getByLabel('Usuario').fill('maquinista');
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page).toHaveURL(/#\/app\/fichaje/);
  });

  test('cada rol empieza en su pantalla y ve su menú', async ({ page }) => {
    await entrar(page, 'admin');
    await expect(page).toHaveURL(/#\/app\/panel/);
    const menu = page.locator('mat-sidenav');
    for (const seccion of ['Registros', 'Usuarios', 'Comunidades']) {
      await expect(menu.getByRole('link', { name: seccion, exact: true })).toBeVisible();
    }
    await salir(page);

    await entrar(page, 'socorrista');
    await expect(page).toHaveURL(/#\/app\/fichaje/);
    await expect(menu.getByRole('link', { name: 'Control de agua' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Registros' })).toHaveCount(0);
    await salir(page);

    await entrar(page, 'maquinista');
    await expect(page).toHaveURL(/#\/app\/fichaje/);
    await expect(menu.getByRole('link', { name: 'Control de agua' })).toHaveCount(0);
  });

  test('un trabajador no puede abrir pantallas de administración', async ({ page }) => {
    await entrar(page, 'maquinista');
    for (const ruta of ['registros', 'usuarios', 'comunidades', 'ajustes', 'panel', 'control-agua']) {
      await page.goto(`/#/app/${ruta}`);
      await expect(page).toHaveURL(/#\/app\/fichaje/);
    }
  });

  test('al cerrar sesión vuelve al acceso de su empresa', async ({ page }) => {
    await entrar(page, 'maquinista');
    await salir(page);
    await expect(page).toHaveURL(new RegExp(`#/c/${EMPRESA}`));
    await page.goto('/#/app/fichaje');
    await expect(page).toHaveURL(new RegExp(`#/c/${EMPRESA}`));
  });
});
