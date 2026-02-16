import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { devtools } from 'zustand/middleware'
import { authClient } from '@/shared/lib/auth-client'
import { Role } from '@/features/permission/types/permissionTypes'
import { User } from '../../../prisma/generated/prisma/client'

export interface UserWithPermissions extends Omit<User, 'role'> {
  role: Role
  permissions: {
    id: string
    name: string
  }[]
}

export interface UpdateProfileData {
  name?: string
  image?: string
  bio?: string
}

export interface UserState {
  user: User | null
  isLoading: boolean
  error: string | null

  setUser: (user: User | null) => void
  updateProfile: (data: UpdateProfileData) => Promise<void>
  clearUser: () => void
  clearError: () => void
}

export const useUserStore = create<UserState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        isLoading: false,
        error: null,

        setUser: (user) => {
          set({ user, error: null })
        },

        updateProfile: async (data) => {
          set({ isLoading: true, error: null })

          try {
            const { data: updatedUser, error } = await authClient.updateUser(data)

            if (error) {
              throw new Error(error.message || 'Failed to update profile')
            }

            if (updatedUser) {
              set((state) => ({
                user: state.user ? { ...state.user, ...updatedUser } : null,
                isLoading: false,
              }))
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Update failed'
            set({ error: message, isLoading: false })
            throw error
          }
        },

        clearUser: () => {
          set({
            user: null,
            error: null,
            isLoading: false,
          })
        },

        clearError: () => {
          set({ error: null })
        },
      }),
      {
        name: 'user-storage',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          user: state.user,
        }),
      }
    ),
    { name: 'UserStore' }
  )
)

export const selectUser = (state: UserState) => state.user
export const selectUserRole = (state: UserState) => state.user?.role
export const selectIsLoading = (state: UserState) => state.isLoading
export const selectError = (state: UserState) => state.error
