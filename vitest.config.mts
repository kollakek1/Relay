import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 120_000,
    hookTimeout: 60_000,
    // Integration tests share a single Postgres test database; running files
    // serially avoids cross-test contention on the pool.
    fileParallelism: false,
    pool: 'forks',
    // The test database is a *remote* managed Postgres instance. Under a long
    // serial run, occasional "unable to start/commit a transaction" latency
    // spikes occur that are unrelated to the code under test. A single retry
    // absorbs that infrastructure noise; real logic failures fail consistently.
    retry: 1,
  },
})
