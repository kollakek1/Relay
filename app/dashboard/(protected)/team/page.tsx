import { requireContext } from '@/shared/server/auth-context'
import { canManageMembers } from '@/shared/server/permissions'
import { getOrganization, listMembers } from '@/features/organization/server/service'
import { PageHeader } from '@/shared/components/page-header'
import { MembersTable } from '@/features/organization/components/members-table'

export default async function TeamPage() {
  const ctx = await requireContext()
  const [organization, members] = await Promise.all([getOrganization(ctx), listMembers(ctx)])

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 lg:p-10">
      <PageHeader
        title="Team"
        description={`People with access to ${organization.name}.`}
      />
      <MembersTable
        members={members}
        canManage={canManageMembers(ctx.role)}
        currentUserId={ctx.userId}
      />
    </main>
  )
}
