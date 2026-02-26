import { defineConfig } from 'prisma/config'
import './envConfig.ts'

export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx --env-file=.env prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL!,
  },
})
