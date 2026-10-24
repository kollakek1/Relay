import { getContext, getCurrentUser } from '@/shared/server/auth-context'
import { getOrganization } from '@/features/organization/server/service'
import { ROLE_LABEL } from '@/shared/server/permissions'
import { PageHeader } from '@/shared/components/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { ProfileForm } from '@/features/user/components/profile-form'
import { formatDate } from '@/shared/lib/format'

export default async function SettingsPage() {
  const [user, ctx] = await Promise.all([getCurrentUser(), getContext()])
  const organization = ctx ? await getOrganization(ctx) : null

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8 lg:p-10">
      <PageHeader title="Settings" description="Manage your profile and workspace." />

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {user && <ProfileForm initialName={user.name} />}
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Email</p>
              <p className="font-medium">{user?.email ?? '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">User ID</p>
              <p className="font-mono text-xs">{user?.id ?? '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground">Name</p>
              <p className="font-medium">{organization?.name ?? '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Slug</p>
              <p className="font-mono text-xs">{organization?.slug ?? '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Members</p>
              <p className="font-medium">{organization?._count.memberships ?? 0}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Workflows</p>
              <p className="font-medium">{organization?._count.workflows ?? 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Access level</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              Your role determines what you can do in this workspace.
            </p>
            <Badge>{ctx ? ROLE_LABEL[ctx.role] : '—'}</Badge>
          </div>
          <p className="text-muted-foreground text-xs">
            Members are created by signing up. Roles are managed on the Team page. Joined{' '}
            {organization ? formatDate(organization.createdAt) : '—'}.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
