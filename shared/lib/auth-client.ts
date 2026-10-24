import { createAuthClient } from 'better-auth/react'

/**
 * The auth client talks to the same origin as the page, so no base URL is
 * configured here — Better Auth derives it from `window.location`. This keeps a
 * single deployment working on localhost and in production without a
 * build-time public env var.
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BASE_URL,
})

export const { signIn, signUp, useSession, signOut } = authClient
