'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import type { OrgRole, WorkflowStatus } from '@/prisma/generated/prisma/enums'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog'
import { useAction } from '@/shared/hooks/useAction'
import { formatDateTime } from '@/shared/lib/format'
import {
  deleteWorkflowAction,
  publishWorkflowAction,
  runInstanceAction,
  saveWorkflowAction,
} from '@/features/workflow/actions'
import {
  ChevronDownIcon,
  ChevronUpIcon,
  Loader2Icon,
  PlayIcon,
  PlusIcon,
  RocketIcon,
  SaveIcon,
  Trash2Icon,
} from 'lucide-react'

export interface BuilderStep {
  name: string
  description: string
  assigneeRole: OrgRole | null
  dueInDays: number | null
}

export interface BuilderWorkflow {
  id: string
  name: string
  description: string | null
  status: WorkflowStatus
  steps: BuilderStep[]
  versions: { id: string; version: number; publishedAt: Date | string }[]
  instanceCount: number
}

const NO_ROLE = 'ANY'

export function WorkflowBuilder({
  workflow,
  canManage,
  canRun,
}: {
  workflow: BuilderWorkflow
  canManage: boolean
  canRun: boolean
}) {
  const router = useRouter()
  const { isPending, run } = useAction()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    getValues,
    formState: { errors },
  } = useForm<{ name: string; description: string; steps: BuilderStep[] }>({
    defaultValues: {
      name: workflow.name,
      description: workflow.description ?? '',
      steps: workflow.steps.length
        ? workflow.steps
        : [{ name: '', description: '', assigneeRole: null, dueInDays: null }],
    },
  })

  const { fields, append, remove, move } = useFieldArray({ control, name: 'steps' })

  const buildPayload = () => {
    const values = getValues()
    return {
      workflowId: workflow.id,
      name: values.name,
      description: values.description,
      steps: values.steps.map((step) => ({
        name: step.name,
        description: step.description,
        assigneeRole: step.assigneeRole ?? null,
        dueInDays: step.dueInDays === null || Number.isNaN(step.dueInDays) ? null : step.dueInDays,
      })),
    }
  }

  const save = () =>
    run(() => saveWorkflowAction(buildPayload()), {
      success: 'Draft saved',
      onSuccess: () => router.refresh(),
    })

  const publish = () =>
    run(
      async () => {
        const saved = await saveWorkflowAction(buildPayload())
        if (!saved.ok) return saved
        return publishWorkflowAction({ workflowId: workflow.id })
      },
      { success: 'Workflow published', onSuccess: () => router.refresh() }
    )

  const startInstance = () =>
    run(() => runInstanceAction({ workflowId: workflow.id }), {
      success: 'Process instance started',
      onSuccess: () => router.push('/dashboard/instances'),
    })

  const removeWorkflow = () => {
    setConfirmDelete(false)
    run(() => deleteWorkflowAction({ workflowId: workflow.id }), {
      success: 'Workflow deleted',
      onSuccess: () => router.push('/dashboard/workflows'),
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <form onSubmit={handleSubmit(save)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="builder-name">Name</Label>
              <Input id="builder-name" disabled={!canManage} {...register('name')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="builder-description">Description</Label>
              <Textarea id="builder-description" disabled={!canManage} {...register('description')} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Steps</CardTitle>
            {canManage && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ name: '', description: '', assigneeRole: null, dueInDays: null })}
              >
                <PlusIcon />
                Add step
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {errors.steps?.root && (
              <p className="text-destructive text-sm">{errors.steps.root.message}</p>
            )}
            {fields.map((field, index) => (
              <div key={field.id} className="border-border bg-background/60 space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs font-semibold uppercase">
                    Step {index + 1}
                  </span>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        disabled={index === 0}
                        onClick={() => move(index, index - 1)}
                        aria-label="Move step up"
                      >
                        <ChevronUpIcon />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        disabled={index === fields.length - 1}
                        onClick={() => move(index, index + 1)}
                        aria-label="Move step down"
                      >
                        <ChevronDownIcon />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        disabled={fields.length === 1}
                        onClick={() => remove(index)}
                        aria-label="Remove step"
                      >
                        <Trash2Icon className="text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor={`step-name-${index}`}>Step name</Label>
                    <Input
                      id={`step-name-${index}`}
                      disabled={!canManage}
                      {...register(`steps.${index}.name` as const)}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor={`step-desc-${index}`}>Description</Label>
                    <Textarea
                      id={`step-desc-${index}`}
                      disabled={!canManage}
                      {...register(`steps.${index}.description` as const)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Required role to claim</Label>
                    <Controller
                      control={control}
                      name={`steps.${index}.assigneeRole` as const}
                      render={({ field: controllerField }) => (
                        <Select
                          value={controllerField.value ?? NO_ROLE}
                          onValueChange={(value) =>
                            controllerField.onChange(value === NO_ROLE ? null : (value as OrgRole))
                          }
                          disabled={!canManage}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_ROLE}>Anyone</SelectItem>
                            <SelectItem value="MEMBER">Member+</SelectItem>
                            <SelectItem value="ADMIN">Admin+</SelectItem>
                            <SelectItem value="OWNER">Owner</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`step-due-${index}`}>Due in (days)</Label>
                    <Input
                      id={`step-due-${index}`}
                      type="number"
                      min={0}
                      max={365}
                      disabled={!canManage}
                      placeholder="No due date"
                      {...register(`steps.${index}.dueInDays` as const, {
                        setValueAs: (value) =>
                          value === '' || value === null || value === undefined
                            ? null
                            : Number(value),
                      })}
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" variant="outline" disabled={isPending}>
              {isPending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
              Save draft
            </Button>
            <Button type="button" onClick={publish} disabled={isPending}>
              <RocketIcon />
              Publish
            </Button>
          </div>
        )}
      </form>

      <aside className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Current</span>
              <Badge variant={workflow.status === 'PUBLISHED' ? 'default' : 'outline'}>
                {workflow.status}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Runs</span>
              <span className="text-sm font-medium">{workflow.instanceCount}</span>
            </div>
            {canRun && (
              <Button
                type="button"
                className="w-full"
                onClick={startInstance}
                disabled={isPending || workflow.status !== 'PUBLISHED'}
              >
                <PlayIcon />
                Start instance
              </Button>
            )}
            {workflow.status !== 'PUBLISHED' && (
              <p className="text-muted-foreground text-xs">
                Publish the workflow before starting instances.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Versions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {workflow.versions.length === 0 ? (
              <p className="text-muted-foreground text-sm">No published versions yet.</p>
            ) : (
              workflow.versions.map((version) => (
                <div key={version.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">v{version.version}</span>
                  <span className="text-muted-foreground">{formatDateTime(version.publishedAt)}</span>
                </div>
              ))
            )}
            <p className="text-muted-foreground text-xs">
              Published versions are immutable. Running instances keep their version even when you
              edit the draft.
            </p>
          </CardContent>
        </Card>

        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>Danger zone</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                onClick={() => setConfirmDelete(true)}
                disabled={workflow.instanceCount > 0}
              >
                <Trash2Icon />
                Delete workflow
              </Button>
              {workflow.instanceCount > 0 && (
                <p className="text-muted-foreground mt-2 text-xs">
                  Workflows with runs cannot be deleted.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </aside>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this workflow?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the workflow, its versions and steps. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={removeWorkflow}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
