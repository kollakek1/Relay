'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Controller, useFieldArray, useForm, type Control, type UseFormRegister } from 'react-hook-form'
import type { OrgRole, StepKind, WorkflowStatus } from '@/prisma/generated/prisma/enums'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Checkbox } from '@/shared/components/ui/checkbox'
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
import type { ConditionOp, FormFieldType } from '@/features/workflow/server/engine'
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

const NO_ROLE = 'ANY'

interface BuilderFormField {
  key: string
  label: string
  type: FormFieldType
  required: boolean
  optionsText: string
}
interface BuilderCondition {
  field: string
  op: ConditionOp
  valueText: string
}
interface BuilderFormStep {
  name: string
  description: string
  assigneeRole: OrgRole | null
  dueInDays: number | null
  kind: StepKind
  fields: BuilderFormField[]
  condition: BuilderCondition
}
interface BuilderForm {
  name: string
  description: string
  steps: BuilderFormStep[]
}

export interface BuilderWorkflow {
  id: string
  name: string
  description: string | null
  status: WorkflowStatus
  steps: Array<{
    name: string
    description: string
    assigneeRole: OrgRole | null
    dueInDays: number | null
    kind: StepKind
    fields: BuilderFormField[]
    condition: BuilderCondition
  }>
  versions: { id: string; version: number; publishedAt: Date | string }[]
  instanceCount: number
}

const FIELD_TYPES: FormFieldType[] = ['text', 'textarea', 'number', 'date', 'select', 'checkbox']
const OPS: ConditionOp[] = ['eq', 'neq', 'gt', 'lt', 'contains', 'isTrue', 'isFalse']

const emptyStep = (): BuilderFormStep => ({
  name: '',
  description: '',
  assigneeRole: null,
  dueInDays: null,
  kind: 'TASK',
  fields: [],
  condition: { field: '', op: 'eq', valueText: '' },
})

const emptyField = (): BuilderFormField => ({
  key: '',
  label: '',
  type: 'text',
  required: false,
  optionsText: '',
})

function coerceConditionValue(op: ConditionOp, valueText: string): string | number | boolean | undefined {
  if (op === 'isTrue' || op === 'isFalse') return undefined
  if (op === 'gt' || op === 'lt') return valueText === '' ? 0 : Number(valueText)
  return valueText
}

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
  } = useForm<BuilderForm>({
    defaultValues: {
      name: workflow.name,
      description: workflow.description ?? '',
      steps: workflow.steps.length ? workflow.steps : [emptyStep()],
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
        kind: step.kind,
        fields: step.fields
          .filter((field) => field.key.trim() && field.label.trim())
          .map((field) => ({
            key: field.key.trim(),
            label: field.label.trim(),
            type: field.type,
            required: field.required,
            options:
              field.type === 'select'
                ? field.optionsText
                    .split(',')
                    .map((option) => option.trim())
                    .filter(Boolean)
                : undefined,
          })),
        condition: step.condition.field.trim()
          ? {
              field: step.condition.field.trim(),
              op: step.condition.op,
              value: coerceConditionValue(step.condition.op, step.condition.valueText),
            }
          : null,
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
              <Input id="builder-name" autoComplete="off" disabled={!canManage} {...register('name')} />
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
              <Button type="button" variant="outline" size="sm" onClick={() => append(emptyStep())}>
                <PlusIcon />
                Add step
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="border-border bg-background/60 space-y-4 rounded-lg border p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs font-semibold uppercase">
                    Step {index + 1}
                  </span>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <Button type="button" variant="ghost" size="icon-xs" disabled={index === 0} onClick={() => move(index, index - 1)} aria-label="Move step up">
                        <ChevronUpIcon />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-xs" disabled={index === fields.length - 1} onClick={() => move(index, index + 1)} aria-label="Move step down">
                        <ChevronDownIcon />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-xs" disabled={fields.length === 1} onClick={() => remove(index)} aria-label="Remove step">
                        <Trash2Icon className="text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor={`step-name-${index}`}>Step name</Label>
                    <Input id={`step-name-${index}`} disabled={!canManage} {...register(`steps.${index}.name`)} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor={`step-desc-${index}`}>Description</Label>
                    <Textarea id={`step-desc-${index}`} disabled={!canManage} {...register(`steps.${index}.description`)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`step-kind-${index}`}>Step type</Label>
                    <Controller
                      control={control}
                      name={`steps.${index}.kind`}
                      render={({ field: cf }) => (
                        <Select value={cf.value} onValueChange={(v) => cf.onChange(v as StepKind)} disabled={!canManage}>
                          <SelectTrigger id={`step-kind-${index}`} className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="TASK">Task</SelectItem>
                            <SelectItem value="APPROVAL">Approval</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`step-role-${index}`}>Required role to claim</Label>
                    <Controller
                      control={control}
                      name={`steps.${index}.assigneeRole`}
                      render={({ field: cf }) => (
                        <Select
                          value={cf.value ?? NO_ROLE}
                          onValueChange={(v) => cf.onChange(v === NO_ROLE ? null : (v as OrgRole))}
                          disabled={!canManage}
                        >
                          <SelectTrigger id={`step-role-${index}`} className="w-full">
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
                      {...register(`steps.${index}.dueInDays`, {
                        setValueAs: (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
                      })}
                    />
                  </div>
                </div>

                <StepFieldsEditor control={control} register={register} index={index} disabled={!canManage} />

                <div className="border-border space-y-3 rounded-md border border-dashed p-3">
                  <p className="text-muted-foreground text-xs font-medium">
                    Run condition — leave the field empty to always run this step
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor={`cond-field-${index}`}>Field</Label>
                      <Input id={`cond-field-${index}`} disabled={!canManage} placeholder="e.g. priority" {...register(`steps.${index}.condition.field`)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`cond-op-${index}`}>Operator</Label>
                      <Controller
                        control={control}
                        name={`steps.${index}.condition.op`}
                        render={({ field: cf }) => (
                          <Select value={cf.value} onValueChange={(v) => cf.onChange(v as ConditionOp)} disabled={!canManage}>
                            <SelectTrigger id={`cond-op-${index}`} className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {OPS.map((op) => (
                                <SelectItem key={op} value={op}>
                                  {op}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`cond-value-${index}`}>Value</Label>
                      <Input id={`cond-value-${index}`} disabled={!canManage} placeholder="e.g. high" {...register(`steps.${index}.condition.valueText`)} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {errors.steps && <p className="text-destructive text-sm">Check the step definitions.</p>}
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
              <Badge variant={workflow.status === 'PUBLISHED' ? 'default' : 'outline'}>{workflow.status}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Runs</span>
              <span className="text-sm font-medium">{workflow.instanceCount}</span>
            </div>
            {canRun && (
              <Button type="button" className="w-full" onClick={startInstance} disabled={isPending || workflow.status !== 'PUBLISHED'}>
                <PlayIcon />
                Start instance
              </Button>
            )}
            {workflow.status !== 'PUBLISHED' && (
              <p className="text-muted-foreground text-xs">Publish the workflow before starting instances.</p>
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
              Published versions are immutable. Running instances keep their version even when you edit the draft.
            </p>
          </CardContent>
        </Card>

        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>Danger zone</CardTitle>
            </CardHeader>
            <CardContent>
              <Button type="button" variant="destructive" className="w-full" onClick={() => setConfirmDelete(true)} disabled={workflow.instanceCount > 0}>
                <Trash2Icon />
                Delete workflow
              </Button>
              {workflow.instanceCount > 0 && (
                <p className="text-muted-foreground mt-2 text-xs">Workflows with runs cannot be deleted.</p>
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
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={removeWorkflow}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/**
 * Nested editor for a step's form fields. Uses its own field array keyed to the
 * parent step index.
 */
function StepFieldsEditor({
  control,
  register,
  index,
  disabled,
}: {
  control: Control<BuilderForm>
  register: UseFormRegister<BuilderForm>
  index: number
  disabled: boolean
}) {
  const { fields, append, remove } = useFieldArray({ control, name: `steps.${index}.fields` })

  return (
    <div className="border-border space-y-3 rounded-md border border-dashed p-3">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs font-medium">Form fields (optional)</p>
        {!disabled && (
          <Button type="button" variant="outline" size="xs" onClick={() => append(emptyField())}>
            <PlusIcon />
            Add field
          </Button>
        )}
      </div>

      {fields.length === 0 && (
        <p className="text-muted-foreground text-xs">
          No fields — the performer just marks the task done.
        </p>
      )}

      {fields.map((field, fieldIndex) => (
        <div key={field.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input
            aria-label="Field key"
            placeholder="key (e.g. priority)"
            disabled={disabled}
            {...register(`steps.${index}.fields.${fieldIndex}.key`)}
          />
          <Input
            aria-label="Field label"
            placeholder="Label"
            disabled={disabled}
            {...register(`steps.${index}.fields.${fieldIndex}.label`)}
          />
          <div className="flex items-center gap-2">
            <Controller
              control={control}
              name={`steps.${index}.fields.${fieldIndex}.type`}
              render={({ field: cf }) => (
                <Select value={cf.value} onValueChange={(v) => cf.onChange(v as FormFieldType)} disabled={disabled}>
                  <SelectTrigger className="w-32" aria-label="Field type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <Button type="button" variant="ghost" size="icon-sm" disabled={disabled} onClick={() => remove(fieldIndex)} aria-label="Remove field">
              <Trash2Icon className="text-destructive" />
            </Button>
          </div>
          <Input
            className="sm:col-span-2"
            aria-label="Field options"
            placeholder={field.type === 'select' ? 'Options (comma separated)' : 'Options (only for select)'}
            disabled={disabled || field.type !== 'select'}
            {...register(`steps.${index}.fields.${fieldIndex}.optionsText`)}
          />
          <label className="flex items-center gap-2 text-sm">
            <Controller
              control={control}
              name={`steps.${index}.fields.${fieldIndex}.required`}
              render={({ field: cf }) => (
                <Checkbox checked={cf.value} onCheckedChange={(v) => cf.onChange(v === true)} disabled={disabled} />
              )}
            />
            Required
          </label>
        </div>
      ))}
    </div>
  )
}
