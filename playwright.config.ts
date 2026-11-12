import { defineConfig, devices } from '@playwright/test';

import { CERCA } from './tests/e2e/datos';

// Pruebas de extremo a extremo: un navegador usa la app como lo haria una
// persona, contra los emuladores (nunca contra datos reales). Se lanzan con
// `npm run test:e2e`, que arranca los emuladores y siembra la empresa "e2e".

const PUERTO = 4300;

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/preparar.ts',
  // Todas las pruebas comparten la misma empresa: una detras de otra.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'tmp/e2e-informe' }]],
  outputDir: 'tmp/e2e-resultados',
  use: {
    baseURL: `http://127.0.0.1:${PUERTO}`,
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    geolocation: CERCA,
    permissions: ['geolocation'],
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] }, testIgnore: /movil/ },
    { name: 'movil', use: { ...devices['Pixel 7'] }, testMatch: /movil/ },
  ],
  webServer: {
    command: `npx ng serve --port ${PUERTO} --host 127.0.0.1`,
    url: `http://127.0.0.1:${PUERTO}`,
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
  },
});
