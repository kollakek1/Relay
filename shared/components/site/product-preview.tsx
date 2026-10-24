import { CheckCircle2Icon, CircleIcon, ClockIcon, GitBranchIcon, InboxIcon } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { getTranslator } from '@/shared/i18n/server'

/**
 * An illustrative, code-rendered preview of the Relay interface.
 *
 * It is deliberately *not* a screenshot and not fake data pretending to be a
 * customer: it shows the real concepts (steps with kinds, statuses, the shared
 * pool, an approval decision) so the product preview stays honest and stays in
 * sync with the design system.
 */
export async function ProductPreview() {
  const { t } = await getTranslator()

  const steps = [
    { order: 1, name: 'Draft', kind: 'TASK' as const, status: t('status.DONE') },
    { order: 2, name: 'Legal review', kind: 'APPROVAL' as const, status: t('status.PENDING') },
    { order: 3, name: 'Publish', kind: 'TASK' as const, status: t('status.BLOCKED') },
  ]

  const tasks = [
    { name: 'Draft the announcement', status: 'IN_PROGRESS' as const, priority: 'MEDIUM' as const },
    { name: 'Approve the contract', status: 'PENDING' as const, priority: 'HIGH' as const },
    { name: 'Publish to the site', status: 'BLOCKED' as const, priority: 'LOW' as const },
  ]

  return (
    <figure className="mx-auto max-w-5xl">
      <div className="border-border bg-card/60 overflow-hidden rounded-xl border shadow-sm">
        {/* Window chrome — decorative. */}
        <div className="border-border bg-muted/40 flex items-center gap-2 border-b px-4 py-2.5" aria-hidden="true">
          <span className="bg-border size-2.5 rounded-full" />
          <span className="bg-border size-2.5 rounded-full" />
          <span className="bg-border size-2.5 rounded-full" />
          <span className="text-muted-foreground ml-2 text-xs">{t('landing.previewTitle')}</span>
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-[1.1fr_1fr]">
          {/* Workflow steps */}
          <section className="border-border bg-background/60 rounded-lg border p-4">
            <header className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <GitBranchIcon className="text-primary size-4" aria-hidden="true" />
                Onboarding
              </h3>
              <Badge variant="outline">{t('status.PUBLISHED')}</Badge>
            </header>
            <ol className="space-y-2">
              {steps.map((step) => (
                <li
                  key={step.order}
                  className="border-border bg-card flex items-center gap-3 rounded-md border px-3 py-2"
                >
                  <span className="text-muted-foreground w-4 text-xs" aria-hidden="true">
                    {step.order}
                  </span>
                  <span className="flex-1 text-sm">{step.name}</span>
                  <Badge variant="secondary">{t(`status.${step.kind}`)}</Badge>
                  <span className="text-muted-foreground text-xs">{step.status}</span>
                </li>
              ))}
            </ol>
          </section>

          <div className="space-y-4">
            {/* Task pool */}
            <section className="border-border bg-background/60 rounded-lg border p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <InboxIcon className="text-primary size-4" aria-hidden="true" />
                {t('app.taskPool')}
              </h3>
              <ul className="space-y-2">
                {tasks.map((task) => (
                  <li key={task.name} className="flex items-center gap-2 text-sm">
                    {task.status === 'IN_PROGRESS' ? (
                      <ClockIcon className="text-primary size-4 shrink-0" aria-hidden="true" />
                    ) : task.status === 'BLOCKED' ? (
                      <CircleIcon className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <CheckCircle2Icon className="text-primary size-4 shrink-0" aria-hidden="true" />
                    )}
                    <span className="flex-1 truncate">{task.name}</span>
                    <Badge variant="outline">{t(`status.${task.priority}`)}</Badge>
                    <span className="text-muted-foreground text-xs">{t(`status.${task.status}`)}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Approval */}
            <section className="border-border bg-background/60 rounded-lg border p-4">
              <h3 className="mb-2 text-sm font-semibold">{t('status.APPROVAL')}</h3>
              <p className="text-muted-foreground text-sm">
                Legal review · {t('status.CHANGES_REQUESTED')}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {t('docs.workflowsLead')}
              </p>
            </section>
          </div>
        </div>
      </div>
      <figcaption className="text-muted-foreground mt-3 text-center text-xs">
        {t('landing.previewCaption')}
      </figcaption>
    </figure>
  )
}
