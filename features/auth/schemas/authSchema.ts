import { z } from 'zod'
import type { TFunction } from '@/shared/i18n/translate'

export const loginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  rememberMe: z.boolean().optional(),
})

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
    email: z.email('Enter a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

/**
 * Localized variants for client forms. The exported schemas above stay in
 * English so server actions keep stable, English validation messages; client
 * components build these instead.
 */
export function createLoginSchema(t: TFunction) {
  return z.object({
    email: z.email(t('validation.email')),
    password: z.string().min(8, t('validation.passwordMin')),
    rememberMe: z.boolean().optional(),
  })
}

export function createRegisterSchema(t: TFunction) {
  return z
    .object({
      name: z.string().trim().min(2, t('validation.nameMin')).max(80),
      email: z.email(t('validation.email')),
      password: z.string().min(8, t('validation.passwordMin')).max(128),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('validation.passwordsMismatch'),
      path: ['confirmPassword'],
    })
}

export type LoginFormData = z.infer<typeof loginSchema>
export type RegisterFormData = z.infer<typeof registerSchema>
