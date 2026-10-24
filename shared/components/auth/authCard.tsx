'use client'

import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { EyeClosedIcon, EyeIcon, Loader2Icon, LogInIcon, UserPlusIcon } from 'lucide-react'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  LoginFormData,
  RegisterFormData,
  loginSchema,
  registerSchema,
} from '@/features/auth/schemas/authSchema'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { toast } from 'sonner'

export function AuthCard() {
  const { login, register: registerUser } = useAuth()
  const [passwordHidden, setPasswordHidden] = useState(true)

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: true },
  })

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  })

  const onLogin = async (data: LoginFormData) => {
    const response = await login(data)
    if (!response.success) {
      toast.error(response.error || 'Unable to sign in', { position: 'top-right' })
      return
    }
    toast.success('Welcome back!', { position: 'top-right' })
  }

  const onRegister = async (data: RegisterFormData) => {
    const response = await registerUser(data)
    if (!response.success) {
      toast.error(response.error || 'Unable to create the account', { position: 'top-right' })
      return
    }
    toast.success('Account created', { position: 'top-right' })
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Welcome to Relay</CardTitle>
        <CardDescription>Sign in to your workspace or create a new account.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="login">
          <TabsList className="mb-4 w-full">
            <TabsTrigger value="login">Sign in</TabsTrigger>
            <TabsTrigger value="register">Create account</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  {...loginForm.register('email')}
                  aria-invalid={!!loginForm.formState.errors.email}
                  disabled={loginForm.formState.isSubmitting}
                />
                {loginForm.formState.errors.email && (
                  <p className="text-destructive text-sm">
                    {loginForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="login-password"
                    className="flex-1"
                    type={passwordHidden ? 'password' : 'text'}
                    autoComplete="current-password"
                    {...loginForm.register('password')}
                    aria-invalid={!!loginForm.formState.errors.password}
                    disabled={loginForm.formState.isSubmitting}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    type="button"
                    onClick={() => setPasswordHidden((prev) => !prev)}
                    disabled={loginForm.formState.isSubmitting}
                    aria-label={passwordHidden ? 'Show password' : 'Hide password'}
                  >
                    {passwordHidden ? <EyeIcon /> : <EyeClosedIcon />}
                  </Button>
                </div>
                {loginForm.formState.errors.password && (
                  <p className="text-destructive text-sm">
                    {loginForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2">
                <Label htmlFor="login-remember" className="cursor-pointer">
                  Remember me
                </Label>
                <Checkbox
                  id="login-remember"
                  defaultChecked
                  onCheckedChange={(checked) =>
                    loginForm.setValue('rememberMe', checked as boolean)
                  }
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={loginForm.formState.isSubmitting}
              >
                {loginForm.formState.isSubmitting ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <LogInIcon />
                )}
                Sign in
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="register-name">Name</Label>
                <Input
                  id="register-name"
                  autoComplete="name"
                  placeholder="Jane Doe"
                  {...registerForm.register('name')}
                  aria-invalid={!!registerForm.formState.errors.name}
                  disabled={registerForm.formState.isSubmitting}
                />
                {registerForm.formState.errors.name && (
                  <p className="text-destructive text-sm">
                    {registerForm.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-email">Email</Label>
                <Input
                  id="register-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  {...registerForm.register('email')}
                  aria-invalid={!!registerForm.formState.errors.email}
                  disabled={registerForm.formState.isSubmitting}
                />
                {registerForm.formState.errors.email && (
                  <p className="text-destructive text-sm">
                    {registerForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="register-password">Password</Label>
                  <Input
                    id="register-password"
                    type="password"
                    autoComplete="new-password"
                    {...registerForm.register('password')}
                    aria-invalid={!!registerForm.formState.errors.password}
                    disabled={registerForm.formState.isSubmitting}
                  />
                  {registerForm.formState.errors.password && (
                    <p className="text-destructive text-sm">
                      {registerForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-confirm">Confirm password</Label>
                  <Input
                    id="register-confirm"
                    type="password"
                    autoComplete="new-password"
                    {...registerForm.register('confirmPassword')}
                    aria-invalid={!!registerForm.formState.errors.confirmPassword}
                    disabled={registerForm.formState.isSubmitting}
                  />
                  {registerForm.formState.errors.confirmPassword && (
                    <p className="text-destructive text-sm">
                      {registerForm.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={registerForm.formState.isSubmitting}
              >
                {registerForm.formState.isSubmitting ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <UserPlusIcon />
                )}
                Create account
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
