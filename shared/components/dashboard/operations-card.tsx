'use client'

import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { useAction } from '@/shared/hooks/useAction'
import { requeueFailedAutomationsAction } from '@/features/automation/actions'
import { requeueFailedDeliveriesAction } from '@/features/webhooks/actions'
import { useT } from '@/shared/i18n/provider'

export interface OperationsSnapshot {
  outboxPending: number
  outboxFailed: number
  deliveriesFailed: number
  automationsFailed: number
  automationsDeadLettered: number
}

/**
 * Admin diagnostics for the background pipeline. Read-only counters plus two
 * explicit, rate-limited recovery actions: requeue dead-lettered webhook
 * deliveries and failed automation runs. Nothing runs implicitly.
 */
export function OperationsCard({ snapshot }: { snapshot: OperationsSnapshot }) {
  const t = useT()
  const deliveries = useAction()
  const automations = useAction()

  const requeueDeliveries = () =>
    deliveries.run(requeueFailedDeliveriesAction, {
      success: t('app.requeuedDeliveries'),
    })

  const requeueAutomations = () =>
    automations.run(requeueFailedAutomationsAction, {
      success: t('app.requeuedAutomations'),
    })

  const stats: Array<{ label: string; value: number; alert?: boolean }> = [
    { label: t('app.outboxPending'), value: snapshot.outboxPending },
    { label: t('app.outboxFailed'), value: snapshot.outboxFailed, alert: snapshot.outboxFailed > 0 },
    {
      label: t('app.deliveriesFailed'),
      value: snapshot.deliveriesFailed,
      alert: snapshot.deliveriesFailed > 0,
    },
    {
      label: t('app.automationsFailed'),
      value: snapshot.automationsFailed,
      alert: snapshot.automationsFailed > 0,
    },
    {
      label: t('app.automationsDeadLettered'),
      value: snapshot.automationsDeadLettered,
      alert: snapshot.automationsDeadLettered > 0,
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('app.operationsTitle')}</CardTitle>
        <CardDescription>{t('app.operationsBody')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
          {stats.map((stat) => (
            <div key={stat.label} className="border-border rounded-lg border p-3">
              <dt className="text-muted-foreground text-xs">{stat.label}</dt>
              <dd
                className={
                  stat.alert ? 'text-destructive text-2xl font-semibold' : 'text-2xl font-semibold'
                }
              >
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={requeueDeliveries}
            disabled={deliveries.isPending || snapshot.deliveriesFailed === 0}
          >
            {t('app.requeueFailedDeliveries')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={requeueAutomations}
            disabled={automations.isPending || snapshot.automationsFailed === 0}
          >
            {t('app.requeueFailedAutomations')}
          </Button>
        </div>

        <p className="text-muted-foreground text-xs">{t('app.operationsNote')}</p>
      </CardContent>
    </Card>
  )
}
