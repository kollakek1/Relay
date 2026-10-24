'use client'

import { useRouter } from 'next/navigation'
import type { NotificationType } from '@/prisma/generated/prisma/enums'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { EmptyState } from '@/shared/components/empty-state'
import { useAction } from '@/shared/hooks/useAction'
import { formatRelativeTime } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import { markNotificationsReadAction } from '@/features/notification/actions'
import { useT } from '@/shared/i18n/provider'
import {
  BellIcon,
  CheckCheckIcon,
  CheckCircle2Icon,
  HandIcon,
  MessageSquareIcon,
  RocketIcon,
  UserIcon,
  MailIcon,
  ClockIcon,
  AlertTriangleIcon,
  UserCheckIcon,
  ZapIcon,
} from 'lucide-react'

export interface NotificationView {
  id: string
  type: NotificationType
  title: string
  body: string | null
  link: string | null
  readAt: Date | string | null
  createdAt: Date | string
}

const TYPE_ICON: Record<NotificationType, typeof BellIcon> = {
  TASK_ASSIGNED: UserIcon,
  TASK_CLAIMED: HandIcon,
  TASK_COMPLETED: CheckCircle2Icon,
  TASK_COMMENTED: MessageSquareIcon,
  WORKFLOW_PUBLISHED: RocketIcon,
  INSTANCE_STARTED: RocketIcon,
  ORG_INVITATION: MailIcon,
  TASK_DUE_SOON: ClockIcon,
  TASK_OVERDUE: AlertTriangleIcon,
  APPROVAL_REQUESTED: UserCheckIcon,
  APPROVAL_DECIDED: CheckCheckIcon,
  AUTOMATION_NOTIFICATION: ZapIcon,
}

export function NotificationsList({ notifications }: { notifications: NotificationView[] }) {
  const router = useRouter()
  const t = useT()
  const { isPending, run } = useAction()

  const unread = notifications.filter((item) => !item.readAt).length

  const markAll = () =>
    run(() => markNotificationsReadAction({}), {
      success: t('notifications.markedAllRead'),
      onSuccess: () => router.refresh(),
    })

  const openNotification = (notification: NotificationView) => {
    run(() => markNotificationsReadAction({ ids: [notification.id] }), {
      onSuccess: () => {
        router.refresh()
        if (notification.link) router.push(notification.link)
      },
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {unread > 0 ? t('notifications.unreadCount', { count: unread }) : t('notifications.allCaughtUp')}
        </p>
        <Button variant="outline" size="sm" onClick={markAll} disabled={isPending || unread === 0}>
          <CheckCheckIcon />
          {t('notifications.markAllRead')}
        </Button>
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon={BellIcon}
          title={t('notifications.emptyTitle')}
          description={t('notifications.emptyBody')}
        />
      ) : (
        <div className="border-border bg-card divide-border divide-y overflow-hidden rounded-xl border">
          {notifications.map((notification) => {
            const Icon = TYPE_ICON[notification.type]
            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => openNotification(notification)}
                className={cn(
                  'hover:bg-muted/50 flex w-full items-start gap-3 p-4 text-left transition-colors',
                  !notification.readAt && 'bg-primary/5'
                )}
              >
                <div className="bg-muted text-muted-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {notification.title}
                    {!notification.readAt && (
                      <Badge className="h-1.5 w-1.5 p-0" aria-label={t('notifications.unread')} />
                    )}
                  </p>
                  {notification.body && (
                    <p className="text-muted-foreground text-sm">{notification.body}</p>
                  )}
                  <p className="text-muted-foreground mt-1 text-xs">
                    {formatRelativeTime(notification.createdAt)}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
