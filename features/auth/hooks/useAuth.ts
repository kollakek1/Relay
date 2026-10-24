'use client'

import { useEffect } from 'react'
import { LoginFormData, RegisterFormData } from '@/features/auth/schemas/authSchema'
import { authClient } from '@/shared/lib/auth-client'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { useUserStore } from '@/features/user/stores/useUserStore'
import { useSessionStore } from '@/features/auth/stores/useSessionsStore'
import { User } from '@/prisma/generated/prisma/client'
import { bootstrapOrganizationAction } from '@/features/organization/actions'

export const useAuth = () => {
  const router = useRouter()

  const { isAuthenticated, isLoading, isInitialized, error } = useAuthStore()
  const { setAuthenticated, setLoading, setInitialized, setError, reset } = useAuthStore()
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
      const { error } = await authClient.signIn.email({
        email: credentials.email,
        password: credentials.password,
        rememberMe: credentials.rememberMe ?? false,
      })

      if (error) throw new Error(error.message || 'Login failed')

      const sessionResponse = await authClient.getSession()

      if (sessionResponse.data?.session && sessionResponse.data?.user) {
        setUser(sessionResponse.data.user as User)
        setSession(sessionResponse.data.session)
        setAuthenticated(true)
        setLoading(false)
        router.push('/dashboard')
        router.refresh()
        return { success: true as const }
      }

      throw new Error('Login failed')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed'
      setError(errorMessage)
      setLoading(false)
      return { success: false as const, error: errorMessage }
    }
  }

  const register = async (credentials: RegisterFormData) => {
    setLoading(true)
    setError(null)

    try {
      const { error } = await authClient.signUp.email({
        name: credentials.name,
        email: credentials.email,
        password: credentials.password,
      })

      if (error) throw new Error(error.message || 'Registration failed')

      // Create the user's first workspace (they become its OWNER).
      const bootstrapped = await bootstrapOrganizationAction({
        name: `${credentials.name}'s Workspace`,
      })
      if (!bootstrapped.ok) {
        console.warn('Workspace bootstrap deferred:', bootstrapped.error)
      }

      const sessionResponse = await authClient.getSession()
      if (sessionResponse.data?.user) {
        setUser(sessionResponse.data.user as User)
        setSession(sessionResponse.data.session)
        setAuthenticated(true)
      }
      setLoading(false)
      router.push('/dashboard')
      router.refresh()
      return { success: true as const }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed'
      setError(errorMessage)
      setLoading(false)
      return { success: false as const, error: errorMessage }
    }
  }

  const logout = async () => {
    setLoading(true)
    try {
      await authClient.signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    } finally {
      clearUser()
      clearSession()
      reset()
      router.push('/dashboard/auth')
      router.refresh()
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
    register,
    logout,
  }
}
