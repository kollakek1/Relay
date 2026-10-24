import { requireContext } from '@/shared/server/auth-context'
import { canManageWorkflows } from '@/shared/server/permissions'
import { listTemplates } from '@/features/workflow/server/templates'
import { normalizeSnapshot } from '@/features/workflow/server/engine'
import { PageHeader } from '@/shared/components/page-header'
import { TemplatesView, type TemplateCard } from '@/features/workflow/components/templates-view'

export default async function TemplatesPage() {
  const ctx = await requireContext()
  const { builtIn, saved } = await listTemplates(ctx)

  const templates: TemplateCard[] = [
    ...builtIn.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      builtIn: true,
      steps: template.steps.length,
    })),
    ...saved.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      builtIn: false,
      steps: normalizeSnapshot(template.steps ?? []).steps.length,
    })),
  ]

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 lg:p-10">
      <PageHeader
        title="Templates"
        description="Start from a ready-made process. Using a template creates an editable draft you own."
      />
      <TemplatesView templates={templates} canManage={canManageWorkflows(ctx.role)} />
    </main>
  )
}
