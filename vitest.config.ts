import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globals: false,
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts', 'server/**/*.ts'],
      exclude: ['src/**/*.tsx', 'src/main.ts', 'src/vite-env.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
