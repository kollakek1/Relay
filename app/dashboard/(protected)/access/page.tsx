import { requireAreaAccess } from '@/shared/server/auth-context'
import { can } from '@/shared/server/permissions'
import { listGrantablePermissions, listMembers } from '@/features/organization/server/service'
import { PageHeader } from '@/shared/components/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { MemberPermissionsPanel } from '@/features/organization/components/member-permissions-panel'
import { getTranslator } from '@/shared/i18n/server'
import type { MessageKey } from '@/shared/i18n/translate'

export default async function AccessPage() {
  const ctx = await requireAreaAccess('access')
  const { t } = await getTranslator()
  const canManage = can(ctx, 'member.manage')
  const members = canManage ? await listMembers(ctx) : []
  const grantable = listGrantablePermissions(ctx)

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 lg:p-10">
      <PageHeader title={t('access.title')} description={t('access.description')} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('access.yourPermissions')}</CardTitle>
          <Badge>{t(`status.${ctx.role}` as MessageKey)}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">{t('access.yourPermissionsBody')}</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {(ctx.permissions ?? []).map((permission) => (
              <li key={permission} className="flex items-center gap-2 text-sm">
                <span className="bg-primary size-1.5 shrink-0 rounded-full" aria-hidden />
                {t(`permissions.${permission}` as MessageKey)}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-xs">{t('access.readOnlyNote')}</p>
        </CardContent>
      </Card>

      {canManage && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{t('access.manageTitle')}</h2>
            <p className="text-muted-foreground text-sm">{t('access.manageBody')}</p>
          </div>
          <MemberPermissionsPanel
            members={members.map((member) => ({
              membershipId: member.id,
              userId: member.userId,
              name: member.user.name,
              email: member.user.email,
              role: member.role,
              grantedPermissions: member.grantedPermissions,
            }))}
            actorPermissions={grantable}
            currentUserId={ctx.userId}
          />
        </section>
      )}
    </main>
  )
}
