'use client'
import { useState, useEffect, useCallback } from 'react'
import { AuthState } from '../types/authTypes'
import { LoginFormData } from '../schemas/authSchema'
import { authClient } from '@/shared/lib/auth-client'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '../stores/useAuthStore'
import { useUserStore } from '../../user/stores/useUserStore'
import { useSessionStore } from '../stores/useSessionsStore'

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
          setUser(data.user)
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
  }, [isInitialized])

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
          setUser(sessionResponse.data.user)
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
