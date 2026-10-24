import { notFound } from 'next/navigation'
import { requireContext } from '@/shared/server/auth-context'
import { canManageWorkflows } from '@/shared/server/permissions'
import { getTask } from '@/features/task/server/service'
import { listMembers } from '@/features/organization/server/service'
import { AppError } from '@/shared/server/errors'
import { PageHeader } from '@/shared/components/page-header'
import { TaskDetail } from '@/features/task/components/task-detail'
import { normalizeFields } from '@/features/workflow/server/engine'

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext()
  const { id } = await params

  let task
  try {
    task = await getTask(ctx, id)
  } catch (error) {
    if (error instanceof AppError && error.code === 'NOT_FOUND') notFound()
    throw error
  }

  const members = await listMembers(ctx)

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 lg:p-10">
      <PageHeader title={task.name} description="Task details, history and comments." />
      <TaskDetail
        task={{
          id: task.id,
          name: task.name,
          description: task.description,
          status: task.status,
          priority: task.priority,
          dueAt: task.dueAt,
          assigneeId: task.assigneeId,
          createdAt: task.createdAt,
          completedAt: task.completedAt,
          requiredRole: task.requiredRole,
          kind: task.kind,
          fields: normalizeFields(task.fields),
          formValues: (task.formValues as Record<string, unknown> | null) ?? null,
          instance: {
            id: task.instance.id,
            workflow: task.instance.workflow,
            version: task.instance.version,
            startedBy: { name: task.instance.startedBy.name },
          },
          createdBy: { name: task.createdBy.name },
        }}
        comments={task.comments.map((comment) => ({
          id: comment.id,
          body: comment.body,
          createdAt: comment.createdAt,
          author: { id: comment.author.id, name: comment.author.name },
        }))}
        activities={task.activities.map((activity) => ({
          id: activity.id,
          type: activity.type,
          fromValue: activity.fromValue,
          toValue: activity.toValue,
          createdAt: activity.createdAt,
          actor: activity.actor,
        }))}
        members={members.map((member) => ({
          userId: member.userId,
          user: { id: member.user.id, name: member.user.name },
        }))}
        currentUserId={ctx.userId}
        canManage={canManageWorkflows(ctx.role)}
      />
    </main>
  )
}
