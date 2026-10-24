import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from './prisma'

const secret = process.env.BETTER_AUTH_SECRET

if (!secret && process.env.NODE_ENV === 'production') {
  // Fail fast rather than letting Better Auth derive a weak, non-rotatable secret.
  throw new Error('BETTER_AUTH_SECRET must be set in production')
}

export const auth = betterAuth({
  baseURL: process.env.BASE_URL,
  secret,
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'USER',
        input: false,
      },
    },
  },
  advanced: {
    cookiePrefix: 'relay',
  },
})
