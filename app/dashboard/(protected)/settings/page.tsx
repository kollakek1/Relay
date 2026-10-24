import { getContext, getCurrentUser } from '@/shared/server/auth-context'
import { getOrganization } from '@/features/organization/server/service'
import { ROLE_LABEL, canManageMembers } from '@/shared/server/permissions'
import { PageHeader } from '@/shared/components/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { ProfileForm } from '@/features/user/components/profile-form'
import { OrganizationSettingsForm } from '@/features/organization/components/organization-settings-form'
import { ApiKeysPanel } from '@/features/api/components/api-keys-panel'
import { WebhooksPanel } from '@/features/webhooks/components/webhooks-panel'
import { AutomationsPanel } from '@/features/automation/components/automations-panel'
import { listApiKeys } from '@/features/api/server/keys'
import { listDeliveries, listWebhookEndpoints } from '@/features/webhooks/server/service'
import {
  getAutomationHealth,
  listAutomationRules,
  listAutomationRuns,
} from '@/features/automation/server/service'
import { getOutboxHealth } from '@/features/webhooks/server/delivery'
import { OperationsCard } from '@/shared/components/dashboard/operations-card'
import { formatDate } from '@/shared/lib/format'

export default async function SettingsPage() {
  const [user, ctx] = await Promise.all([getCurrentUser(), getContext()])
  const organization = ctx ? await getOrganization(ctx) : null
  const canManage = ctx ? canManageMembers(ctx.role) : false

  const [apiKeys, endpoints, deliveries, rules, automationRuns, automationHealth, outboxHealth] =
    ctx && canManage
      ? await Promise.all([
          listApiKeys(ctx),
          listWebhookEndpoints(ctx),
          listDeliveries(ctx, 20),
          listAutomationRules(ctx),
          listAutomationRuns(ctx, 20),
          getAutomationHealth(ctx),
          getOutboxHealth(ctx.organizationId),
        ])
      : [[], [], [], [], [], null, null]

  const failedDeliveries = deliveries.filter((delivery) => delivery.status === 'FAILED').length

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
        <CardContent className="space-y-6">
          {organization && (
            <OrganizationSettingsForm
              organization={{
                name: organization.name,
                description: organization.description,
                timezone: organization.timezone,
              }}
              canManage={ctx ? canManageMembers(ctx.role) : false}
            />
          )}
          <div className="grid gap-2 border-t pt-4 text-sm sm:grid-cols-3">
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
            Members are added via invitations. Roles and ownership are managed on the Team page.
            {organization ? ` Workspace created ${formatDate(organization.createdAt)}.` : ''}
          </p>
        </CardContent>
      </Card>

      {ctx && canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">            <ApiKeysPanel
              canManage={canManage}
              keys={apiKeys.map((key) => ({
                id: key.id,
                name: key.name,
                prefix: key.prefix,
                scopes: key.scopes,
                lastUsedAt: key.lastUsedAt,
                revokedAt: key.revokedAt,
                createdAt: key.createdAt,
              }))}
            />
            <WebhooksPanel
              canManage={canManage}
              endpoints={endpoints.map((endpoint) => ({
                id: endpoint.id,
                url: endpoint.url,
                events: endpoint.events,
                active: endpoint.active,
                failureCount: endpoint.failureCount,
                deliveries: endpoint._count.deliveries,
              }))}
              deliveries={deliveries.map((delivery) => ({
                id: delivery.id,
                event: delivery.event,
                status: delivery.status,
                attempts: delivery.attempts,
                responseCode: delivery.responseCode,
                error: delivery.error,
                createdAt: delivery.createdAt,
                endpointUrl: delivery.endpoint.url,
              }))}
            />
            <AutomationsPanel
              canManage={canManage}
              rules={rules.map((rule) => ({
                id: rule.id,
                name: rule.name,
                enabled: rule.enabled,
                trigger: rule.trigger,
                action: rule.action,
                lastRunAt: rule.lastRunAt,
                runs: rule._count.runs,
              }))}
              runs={automationRuns.map((automationRun) => ({
                id: automationRun.id,
                ruleName: automationRun.rule.name,
                status: automationRun.status,
                detail: automationRun.detail,
                createdAt: automationRun.createdAt,
              }))}
            />
          </CardContent>
        </Card>
      )}

      {ctx && canManage && automationHealth && outboxHealth && (
        <OperationsCard
          snapshot={{
            outboxPending: outboxHealth.pending,
            outboxFailed: outboxHealth.failed,
            deliveriesFailed: failedDeliveries,
            automationsFailed: automationHealth.failed,
            automationsDeadLettered: automationHealth.deadLettered,
          }}
        />
      )}
    </main>
  )
}
