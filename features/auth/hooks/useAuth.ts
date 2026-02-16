'use client'
import { useEffect } from 'react'
import { LoginFormData } from '@/features/auth/schemas/authSchema'
import { authClient } from '@/shared/lib/auth-client'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { useUserStore } from '@/features/user/stores/useUserStore'
import { useSessionStore } from '@/features/auth/stores/useSessionsStore'
import { User } from '@/prisma/generated/prisma/client'

export const useAuth = () => {
  const router = useRouter()

  const { isAuthenticated, isLoading, isInitialized, error } = useAuthStore()
  const { setAuthenticated, setLoading, setInitialized, setError } = useAuthStore()
  const { user, setUser, clearUser } = useUserStore()
  const { session, setSession, clearSession } = useSessionStore()

  useEffect(() => {
    const initialize = async () => {
      if (isInitialized) return

      setLoading(true)

      try {
        const { data } = await authClient.getSession()

        if (data?.session && data?.user) {
          setUser(data.user as User)
          setSession(data.session)
          setAuthenticated(true)
        } else {
          clearUser()
          clearSession()
          setAuthenticated(false)
        }
      } catch (error) {
        console.error('Auth check error:', error)
        clearUser()
        clearSession()
        setAuthenticated(false)
        setError('Auth check failed')
      } finally {
        setLoading(false)
        setInitialized(true)
      }
    }

    initialize()
  }, [
    isInitialized,
    setLoading,
    setUser,
    setSession,
    setAuthenticated,
    clearUser,
    clearSession,
    setError,
    setInitialized,
  ])

  const login = async (credentials: LoginFormData) => {
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await authClient.signIn.email({
        email: credentials.email,
        password: credentials.password,
        rememberMe: credentials.rememberMe ?? false,
      })

      if (error) {
        throw new Error(error.message || 'Login failed')
      }

      if (data) {
        const sessionResponse = await authClient.getSession()

        if (sessionResponse.data?.session && sessionResponse.data?.user) {
          setUser(sessionResponse.data.user as User)
          setSession(sessionResponse.data.session)
          setAuthenticated(true)
          setLoading(false)

          router.push('/dashboard')
          return { success: true }
        }
      }

      throw new Error('Login failed')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed'
      setError(errorMessage)
      setLoading(false)
      return { success: false, error: errorMessage }
    }
  }

  return {
    user,
    session,
    isAuthenticated,
    isLoading,
    isInitialized,
    error,

    login,
  }
}
