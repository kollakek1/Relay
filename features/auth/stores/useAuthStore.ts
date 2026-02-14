import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  isInitialized: boolean
  error: string | null

  setAuthenticated: (value: boolean) => void
  setLoading: (value: boolean) => void
  setInitialized: (value: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,
      error: null,

      setAuthenticated: (value) => set({ isAuthenticated: value }),
      setLoading: (value) => set({ isLoading: value }),
      setInitialized: (value) => set({ isInitialized: value }),
      setError: (error) => set({ error }),
      reset: () =>
        set({
          isAuthenticated: false,
          isLoading: false,
          isInitialized: false,
          error: null,
        }),
    }),
    { name: 'AuthStore' }
  )
)
