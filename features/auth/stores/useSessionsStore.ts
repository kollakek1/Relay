import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { devtools } from 'zustand/middleware'
import type { Session } from 'better-auth/client'

interface SessionState {
  session: Session | null

  setSession: (session: Session | null) => void
  clearSession: () => void
}

export const useSessionStore = create<SessionState>()(
  devtools(
    persist(
      (set) => ({
        session: null,

        setSession: (session) => {
          set({ session })
        },

        clearSession: () => {
          set({ session: null })
        },
      }),
      {
        name: 'session-storage',
        storage: createJSONStorage(() => sessionStorage),
      }
    ),
    { name: 'SessionStore' }
  )
)
