import { requireContext } from '@/shared/server/auth-context'
import { canManageMembers, isOwner } from '@/shared/server/permissions'
import { getOrganization, listMembers } from '@/features/organization/server/service'
import { listInvitations } from '@/features/organization/server/invitations'
import { PageHeader } from '@/shared/components/page-header'
import { MembersTable } from '@/features/organization/components/members-table'
import { InvitationsPanel } from '@/features/organization/components/invitations-panel'
import { getTranslator } from '@/shared/i18n/server'

export default async function TeamPage() {
  const ctx = await requireContext()
  const { t } = await getTranslator()
  const canManage = canManageMembers(ctx.role)

  const [organization, members, invitations] = await Promise.all([
    getOrganization(ctx),
    listMembers(ctx),
    canManage ? listInvitations(ctx) : Promise.resolve([]),
  ])

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 lg:p-10">
      <PageHeader
        title={t('pages.teamTitle')}
        description={t('pages.teamDescription', { workspace: organization.name })}
      />
      <MembersTable
        members={members}
        canManage={canManage}
        currentUserId={ctx.userId}
        currentRole={ctx.role}
      />
      <InvitationsPanel
        invitations={invitations}
        canManage={canManage}
        canInviteOwner={isOwner(ctx.role)}
      />
    </main>
  )
}
