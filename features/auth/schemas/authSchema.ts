import { z } from 'zod'

export const loginSchema = z.object({
  email: z.email('Некорректный email'),
  password: z.string().min(8, 'Минимум 8 символов'),
  rememberMe: z.boolean().optional(),
})

export type LoginFormData = z.infer<typeof loginSchema>
