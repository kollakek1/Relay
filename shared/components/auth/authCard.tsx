'use client'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { EyeClosedIcon, EyeIcon, Loader2Icon, LogInIcon } from 'lucide-react'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { LoginFormData, loginSchema } from '@/features/auth/schemas/authSchema'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { toast } from 'sonner'

export function AuthCard() {
  const { login } = useAuth()
  const [passwordHidden, setPasswordHidden] = useState<boolean>(true)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: true,
    },
  })

  const onSubmit = async (data: LoginFormData) => {
    const response = await login(data)

    if (!response.success) {
      toast.error(response.error || 'Ошибка входа', { position: 'top-right' })
      return
    }

    toast.success('Добро пожаловать!', { position: 'top-right' })
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Login to your account</CardTitle>
        <CardDescription>Enter your email below to login to your account</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                type="email"
                placeholder="m@example.com"
                {...register('email')}
                aria-invalid={!!errors.email}
                disabled={isSubmitting}
              />
              {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center">
                <Label htmlFor="password">Password</Label>
              </div>
              <div className="flex items-center">
                <Input
                  className="flex-1 rounded-r-none"
                  type={passwordHidden ? 'password' : 'text'}
                  {...register('password')}
                  aria-invalid={!!errors.password}
                  disabled={isSubmitting}
                />
                <Button
                  className="rounded-l-none hover:scale-100 active:scale-100"
                  variant={'outline'}
                  size={'icon'}
                  type={'button'}
                  onClick={() => setPasswordHidden((prev) => !prev)}
                  disabled={isSubmitting}
                  aria-label={passwordHidden ? 'Показать пароль' : 'Скрыть пароль'}
                >
                  {passwordHidden ? <EyeIcon /> : <EyeClosedIcon />}
                </Button>
              </div>
              {errors.password && (
                <p className="text-destructive text-sm">{errors.password.message}</p>
              )}
            </div>

            <div className="flex w-full items-center justify-end gap-2">
              <p>Запомнить меня</p>
              <Checkbox
                onCheckedChange={(checked) => {
                  setValue('rememberMe', checked as boolean)
                }}
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="mt-4">
          <Button type="submit" size={'lg'} className="w-full" disabled={isSubmitting}>
            Login
            {isSubmitting ? <Loader2Icon className="animate-spin" /> : <LogInIcon />}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
