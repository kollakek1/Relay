'use client'

import React from 'react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { Card, CardContent, CardHeader } from '../../../shared/components/ui/card'
import { Inbox, CheckCircle2, Clock, Users, ArrowRight, Loader2 } from 'lucide-react'
import Link from 'next/link'

const DashboardPage = () => {
  const { user, isLoading, isInitialized } = useAuth()

  if (!isInitialized || isLoading) {
    return (
      <div className="flex h-[80vh] w-full items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    )
  }

  // TODO: Заменить на реальные данные из API/Prisma
  const stats = {
    myTasks: 3,
    pendingClaim: 7,
    completedToday: 2,
    teamProgress: 14,
  }

  const myTasks = [
    { id: '1', title: 'Design System Update', stage: 'In Progress', priority: 'high' },
    { id: '2', title: 'API Documentation', stage: 'Review', priority: 'medium' },
    { id: '3', title: 'Fix Auth Bug', stage: 'In Progress', priority: 'high' },
  ]

  const recentActivity = [
    { id: '1', text: 'You moved "Design System Update" to In Progress', time: '5 min ago' },
    { id: '2', text: 'Anna claimed "Homepage Redesign"', time: '12 min ago' },
    { id: '3', text: 'New task "Mobile App" was created', time: '1 hour ago' },
    { id: '4', text: 'Ivan completed "Database Migration"', time: '2 hours ago' },
  ]

  return (
    <main className="mx-auto w-full space-y-10 px-6 py-10 lg:p-8">
      <header className="space-y-1">
        <h1 className="text-foreground text-3xl font-bold tracking-tight lg:text-4xl">
          Welcome back, {user?.name?.split(' ')[0] || 'User'}
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s what&apos;s happening with your tasks today.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<Inbox className="h-5 w-5" />}
          label="My Tasks"
          value={stats.myTasks}
          color="text-primary"
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="Pending Claim"
          value={stats.pendingClaim}
          color="text-orange-500"
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Completed Today"
          value={stats.completedToday}
          color="text-emerald-500"
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Team This Week"
          value={stats.teamProgress}
          color="text-violet-500"
        />
      </section>

      <div className="flex gap-8">
        <Card className="border-border bg-card flex-2 rounded-xl border">
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-foreground text-lg font-semibold">My Tasks</h2>
            <Link
              href="/dashboard/tasks"
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors"
            >
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </CardHeader>

          <CardContent className="space-y-3">
            {myTasks.map((task) => (
              <div
                key={task.id}
                className="border-border bg-background hover:bg-muted/50 flex items-center justify-between rounded-lg border p-4 transition-colors"
              >
                <div className="space-y-1">
                  <p className="text-foreground font-medium">{task.title}</p>
                  <p className="text-muted-foreground text-sm">{task.stage}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium uppercase ${
                    task.priority === 'high'
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-muted text-muted-foreground'
                  } `}
                >
                  {task.priority}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="max-h-min flex-1">
          <CardHeader className="text-foreground text-lg font-semibold">Recent Activity</CardHeader>

          <CardContent className="space-y-4">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex gap-3">
                <div className="bg-primary mt-1.5 h-2 w-2 shrink-0 rounded-full" />
                <div className="space-y-1">
                  <p className="text-foreground text-sm">{activity.text}</p>
                  <p className="text-muted-foreground text-xs">{activity.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

const StatCard = ({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: number
  color: string
}) => {
  return (
    <Card>
      <CardContent>
        <div className={`mb-2 flex items-center gap-2 ${color}`}>
          {icon}
          <p className="text-muted-foreground text-sm">{label}</p>
        </div>
        <p className="text-foreground text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  )
}

export default DashboardPage
