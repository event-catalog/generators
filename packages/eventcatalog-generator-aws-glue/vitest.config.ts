/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['../../configs/vitest/setup.ts'],
    deps: {
      inline: ['@eventcatalog/sdk'],
    },
  },
});
