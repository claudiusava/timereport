import { aviso, elegir, entrar, expect, ir, salir, test } from './comun';
import { COMUNIDADES, USUARIOS } from './datos';

const { veterano } = USUARIOS;

test.describe('Administración', () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page, 'admin');
  });

  test('el panel carga sin errores', async ({ page }) => {
    await expect(page).toHaveURL(/#\/app\/panel/);
    await expect(page.locator('main h1').first()).toBeVisible();
  });

  test('registros: ve la jornada de ayer y sus horas', async ({ page }) => {
    await ir(page, 'Registros');
    await elegir(page, 'Trabajador', veterano.nombre);
    const filas = page.locator('tr.mat-mdc-row');
    await expect(filas).toHaveCount(2);
    await expect(filas.first()).toContainText(COMUNIDADES.robles.nombre);

    await page.getByRole('tab', { name: /Horas/ }).click();
    await expect(page.locator('tr.mat-mdc-row').first()).toContainText('7,0 h');
  });

  test('fichaje manual y anulación quedan registrados con su motivo', async ({ page }) => {
    await ir(page, 'Registros');

    await page.getByRole('button', { name: 'Fichaje manual' }).click();
    const dialogo = page.getByRole('dialog');
    await elegir(page, 'Trabajador', veterano.nombre, dialogo);
    await elegir(page, 'Comunidad', COMUNIDADES.robles.nombre, dialogo);
    await dialogo.getByRole('radio', { name: 'Entrada' }).click();
    await dialogo.getByLabel('Hora').fill('07:30');
    await dialogo.getByLabel('Motivo').fill('Olvidó fichar al llegar; prueba e2e.');
    await dialogo.getByRole('button', { name: 'Registrar' }).click();
    await expect(dialogo).toBeHidden();

    await elegir(page, 'Trabajador', veterano.nombre);
    const manual = page.locator('tr.mat-mdc-row', { hasText: 'Olvidó fichar al llegar' });
    await expect(manual).toContainText('Manual');
    await expect(manual).toContainText(USUARIOS.admin.nombre);

    // Anular: pide motivo y el fichaje no se borra, queda marcado.
    await manual.getByRole('button', { name: /Anular fichaje/ }).click();
    const motivo = page.getByRole('dialog');
    await motivo.getByRole('button', { name: 'Anular' }).click();
    await expect(motivo.getByText('Explica el motivo')).toBeVisible();
    await motivo.getByLabel('Motivo').fill('Era una prueba automática.');
    await motivo.getByRole('button', { name: 'Anular' }).click();
    await aviso(page, 'Fichaje anulado');
    const anulado = page.locator('tr.mat-mdc-row', { hasText: 'Era una prueba automática.' });
    await expect(anulado).toContainText('Anulado');
    await expect(anulado).toContainText('07:30');
    await expect(anulado.getByRole('button', { name: /Anular/ })).toHaveCount(0);

    // "Ver anulados" viene activado; al quitarlo deja solo los validos.
    await page.getByRole('switch', { name: 'Ver anulados' }).click();
    await expect(anulado).toHaveCount(0);
    await expect(page.locator('tr.mat-mdc-row')).toHaveCount(2);
  });

  test('registros: exportar descarga un Excel', async ({ page }) => {
    await ir(page, 'Registros');
    const descarga = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar a Excel' }).click();
    expect((await descarga).suggestedFilename()).toMatch(/\.xlsx$/);
  });

  test('alta de un trabajador que después entra y ficha', async ({ page }) => {
    await ir(page, 'Usuarios');
    await page.getByRole('button', { name: 'Nuevo usuario' }).click();
    const dialogo = page.getByRole('dialog');
    await dialogo.getByLabel('Nombre completo').fill('Nuria Nueva');
    await dialogo.getByLabel('Nombre de usuario').fill('nnueva');
    await dialogo.getByLabel('Contraseña inicial').fill('nueva-clave-123');
    await dialogo.getByRole('radio', { name: /Maquinista/ }).check();
    await dialogo.getByRole('option', { name: new RegExp(COMUNIDADES.pinos.nombre) }).click();
    await dialogo.getByRole('button', { name: 'Guardar' }).click();
    await expect(dialogo).toBeHidden();
    await expect(page.locator('article.usuario', { hasText: 'Nuria Nueva' })).toContainText('1 comunidades');

    // Nombre de usuario repetido: lo rechaza.
    await page.getByRole('button', { name: 'Nuevo usuario' }).click();
    await dialogo.getByLabel('Nombre completo').fill('Otra Nuria');
    await dialogo.getByLabel('Nombre de usuario').fill('nnueva');
    await dialogo.getByLabel('Contraseña inicial').fill('otra-clave-123');
    await dialogo.getByRole('button', { name: 'Guardar' }).click();
    await expect(dialogo.getByRole('alert')).toBeVisible();
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();

    await salir(page);
    await entrar(page, 'nnueva', 'nueva-clave-123');
    await expect(page).toHaveURL(/#\/app\/fichaje/);
    await page.getByRole('button', { name: 'Fichar entrada' }).click();
    await aviso(page, `Entrada registrada en ${COMUNIDADES.pinos.nombre}`);
  });

  test('las pantallas de gestión cargan', async ({ page }) => {
    for (const [enlace, titulo] of [
      ['Comunidades', 'Comunidades'],
      ['Ajustes', /Ajustes/],
      ['Usuarios', 'Usuarios'],
    ] as const) {
      await ir(page, enlace);
      await expect(page.locator('main h1').first()).toHaveText(titulo);
    }
    await expect(page.locator('article.usuario')).not.toHaveCount(0);
  });
});
