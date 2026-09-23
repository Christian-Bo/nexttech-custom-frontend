import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = fileURLToPath(new URL('./', import.meta.url))

/**
 * Pruebas de lógica (sin navegador). Los alias `~/` y `@/` apuntan a la raíz como en Nuxt.
 *   npm test               -> corre todo una vez
 *   npm run test:coverage  -> además genera el reporte de cobertura en coverage/
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: /^~\//, replacement: root },
      { find: /^@\//, replacement: root }
    ]
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'utils/**/*.ts',
        'services/api/**/*.ts',
        'features/photo-studio/utils/**/*.ts',
        'features/tracking/services/**/*.ts'
      ]
    }
  }
})
