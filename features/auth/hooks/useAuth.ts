'use client'
import { useState, useEffect, useCallback } from 'react'
import { AuthState } from '../types/authTypes'
import { LoginFormData } from '../schemas/authSchema'
import { authClient } from '@/shared/lib/auth-client'
import { useRouter } from 'next/navigation'

export const useAuth = () => {
  const router = useRouter()
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  })

  useEffect(() => {
    const checkAuth = async () => {
      try {
        setAuthState((prev) => ({ ...prev, isLoading: true, error: null }))

        const { data } = await authClient.getSession()

        if (data?.session && data?.user) {
          setAuthState({
            user: data.user,
            session: data.session,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })
        } else {
          setAuthState({
            user: null,
            session: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          })
        }
      } catch (error) {
        console.error('Auth check error:', error)
        setAuthState({
          user: null,
          session: null,
          isAuthenticated: false,
          isLoading: false,
          error: 'Ошибка проверки авторизации',
        })
      }
    }

    checkAuth()
  }, [])

  const login = useCallback(
    async (credentials: LoginFormData) => {
      try {
        setAuthState((prev) => ({ ...prev, isLoading: true, error: null }))

        const { data, error } = await authClient.signIn.email({
          email: credentials.email,
          password: credentials.password,
          rememberMe: credentials.rememberMe ?? false,
        })

        if (error) {
          throw new Error(error.message || 'Ошибка входа')
        }

        if (data) {
          const sessionResponse = await authClient.getSession()

          if (sessionResponse.data?.session) {
            setAuthState({
              user: sessionResponse.data.user,
              session: sessionResponse.data.session,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            })

            router.push('/dashboard')
            return { success: true, data: { user: data, session: sessionResponse.data.session } }
          }

          setAuthState({
            user: data.user,
            session: null,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })

          router.push('/dashboard')
          return { success: true, data: { user: data } }
        }

        throw new Error('Не удалось войти')
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Ошибка входа'
        setAuthState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }))
        return { success: false, error: errorMessage }
      }
    },
    [router]
  )

  return {
    // Стейты
    user: authState.user,
    session: authState.session,
    isLoading: authState.isLoading,
    isAuthenticated: authState.isAuthenticated,
    error: authState.error,

    //Акшены
    login,
  }
}
