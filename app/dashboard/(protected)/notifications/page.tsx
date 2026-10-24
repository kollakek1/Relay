import { requireContext } from '@/shared/server/auth-context'
import { listNotifications } from '@/features/notification/server/service'
import { PageHeader } from '@/shared/components/page-header'
import { NotificationsList } from '@/features/notification/components/notifications-list'

export default async function NotificationsPage() {
  const ctx = await requireContext()
  const notifications = await listNotifications(ctx)

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8 lg:p-10">
      <PageHeader title="Notifications" description="Updates about the tasks you care about." />
      <NotificationsList notifications={notifications} />
    </main>
  )
}
