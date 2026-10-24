'use client'

import { useRouter } from 'next/navigation'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { useAction } from '@/shared/hooks/useAction'
import { createFromTemplateAction } from '@/features/workflow/actions'
import { Loader2Icon, SparklesIcon, WorkflowIcon } from 'lucide-react'

export interface TemplateCard {
  id: string
  name: string
  description: string | null
  category: string | null
  builtIn: boolean
  steps: number
}

export function TemplatesView({ templates, canManage }: { templates: TemplateCard[]; canManage: boolean }) {
  const router = useRouter()
  const { isPending, run } = useAction()

  const use = (template: TemplateCard) =>
    run(() => createFromTemplateAction({ templateId: template.id }), {
      success: `Created “${template.name}”`,
      onSuccess: (data) => router.push(`/dashboard/workflows/${data.id}`),
    })

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {templates.map((template) => (
        <Card key={template.id} className="flex flex-col">
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <CardTitle className="text-base">{template.name}</CardTitle>
            <Badge variant={template.builtIn ? 'secondary' : 'outline'} className="shrink-0">
              {template.builtIn ? (
                <>
                  <SparklesIcon /> Built-in
                </>
              ) : (
                (template.category ?? 'Custom')
              )}
            </Badge>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-between gap-4">
            <p className="text-muted-foreground text-sm">
              {template.description ?? 'No description.'}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1 text-xs">
                <WorkflowIcon className="size-3.5" />
                {template.steps} step{template.steps === 1 ? '' : 's'}
              </span>
              {canManage && (
                <Button size="sm" disabled={isPending} onClick={() => use(template)}>
                  {isPending && <Loader2Icon className="animate-spin" />}
                  Use template
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
