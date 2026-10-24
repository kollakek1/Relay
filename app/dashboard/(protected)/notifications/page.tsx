import { requireContext } from '@/shared/server/auth-context'
import { listNotifications } from '@/features/notification/server/service'
import { PageHeader } from '@/shared/components/page-header'
import { NotificationsList } from '@/features/notification/components/notifications-list'
import { getTranslator } from '@/shared/i18n/server'

export default async function NotificationsPage() {
  const ctx = await requireContext()
  const { t } = await getTranslator()
  const notifications = await listNotifications(ctx)

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8 lg:p-10">
      <PageHeader
        title={t('pages.notificationsTitle')}
        description={t('pages.notificationsDescription')}
      />
      <NotificationsList notifications={notifications} />
    </main>
  )
}
