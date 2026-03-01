'use client'

import { useAuth } from '@/features/auth/hooks/useAuth'
import { User as UserIcon, Shield, Mail, Calendar, Loader2 } from 'lucide-react'

const SettingsPage = () => {
  const { user, isLoading, isInitialized } = useAuth()

  if (!isInitialized || isLoading) {
    return (
      <div className="flex h-[80vh] w-full items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-10 px-6 py-10 lg:p-10">
      <header className="space-y-1">
        <h1 className="text-foreground text-4xl font-bold tracking-tight lg:text-5xl">Settings</h1>
        <p className="text-muted-foreground text-lg">
          Manage your account settings and preferences.
        </p>
      </header>

      <div className="grid gap-8">
        <section className="border-border bg-card rounded-xl border p-6 shadow-sm">
          <div className="border-border text-foreground mb-6 flex items-center space-x-3 border-b pb-4">
            <UserIcon className="text-primary h-5 w-5" />
            <h2 className="text-xl font-semibold">Profile</h2>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-muted-foreground text-sm font-medium">Full Name</label>
              <div className="border-input bg-background text-foreground flex h-10 w-full rounded-md border px-3 py-2 text-sm">
                {user?.name || 'Not set'}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-muted-foreground text-sm font-medium">Email Address</label>
              <div className="relative">
                <Mail className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                <div className="border-input bg-muted/50 text-muted-foreground flex h-10 w-full items-center rounded-md border px-10 py-2 text-sm">
                  {user?.email}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-border bg-card rounded-xl border p-6 shadow-sm">
          <div className="border-border text-foreground mb-6 flex items-center space-x-3 border-b pb-4">
            <Shield className="text-primary h-5 w-5" />
            <h2 className="text-xl font-semibold">Access Level</h2>
          </div>

          <div className="border-border bg-muted/30 flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <p className="text-foreground font-medium">Current Role</p>
              <p className="text-muted-foreground text-sm">
                Determines your permissions within the Relay engine.
              </p>
            </div>
            <div className="border-primary/20 bg-primary/10 text-primary rounded-full border px-4 py-1 text-xs font-bold tracking-widest uppercase">
              {user?.role}
            </div>
          </div>
        </section>

        <section className="border-border bg-card rounded-xl border p-6 shadow-sm">
          <div className="border-border text-foreground mb-6 flex items-center space-x-3 border-b pb-4">
            <Calendar className="text-primary h-5 w-5" />
            <h2 className="text-xl font-semibold">Account Details</h2>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">User ID</span>
              <span className="text-foreground font-mono">{user?.id}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Joined on</span>
              <span className="text-foreground">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
              </span>
            </div>
          </div>
        </section>
      </div>

      <footer className="pt-6 text-center md:text-left">
        <p className="text-muted-foreground text-xs italic">Relay v1.0.0 &copy; 2026</p>
      </footer>
    </main>
  )
}

export default SettingsPage
