import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Todos los tests comparten los mismos emuladores: en serie.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
