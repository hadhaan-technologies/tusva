import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'node', include: ['supabase/tests/**/*.test.ts', 'supabase/functions/**/*.integration.test.ts'] },
})
