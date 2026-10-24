'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Controller, useFieldArray, useForm, useWatch, type Control, type UseFormRegister } from 'react-hook-form'
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
import { useT } from '@/shared/i18n/provider'
import type { MessageKey } from '@/shared/i18n/translate'
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
  approvalMode: 'ANY' | 'ALL' | null
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
    approvalMode: 'ANY' | 'ALL' | null
    fields: BuilderFormField[]
    condition: BuilderCondition
  }>
  versions: { id: string; version: number; publishedAt: Date | string }[]
  instanceCount: number
}

const FIELD_TYPES: FormFieldType[] = ['text', 'textarea', 'number', 'date', 'select', 'checkbox']
const OPS: ConditionOp[] = ['eq', 'neq', 'gt', 'lt', 'contains', 'isTrue', 'isFalse']

const FIELD_TYPE_KEY: Record<FormFieldType, MessageKey> = {
  text: 'builder.fieldTypeText',
  textarea: 'builder.fieldTypeTextarea',
  number: 'builder.fieldTypeNumber',
  date: 'builder.fieldTypeDate',
  select: 'builder.fieldTypeSelect',
  checkbox: 'builder.fieldTypeCheckbox',
}

const OP_KEY: Record<ConditionOp, MessageKey> = {
  eq: 'builder.opEq',
  neq: 'builder.opNeq',
  gt: 'builder.opGt',
  lt: 'builder.opLt',
  contains: 'builder.opContains',
  isTrue: 'builder.opIsTrue',
  isFalse: 'builder.opIsFalse',
}

const emptyStep = (): BuilderFormStep => ({
  name: '',
  description: '',
  assigneeRole: null,
  dueInDays: null,
  kind: 'TASK',
  approvalMode: null,
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
  const t = useT()
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
  const watchedSteps = useWatch({ control, name: 'steps' })

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
        approvalMode: step.kind === 'APPROVAL' ? (step.approvalMode ?? 'ANY') : null,
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
      success: t('toast.draftSaved'),
      onSuccess: () => router.refresh(),
    })

  const publish = () =>
    run(
      async () => {
        const saved = await saveWorkflowAction(buildPayload())
        if (!saved.ok) return saved
        return publishWorkflowAction({ workflowId: workflow.id })
      },
      { success: t('toast.workflowPublished'), onSuccess: () => router.refresh() }
    )

  const startInstance = () =>
    run(() => runInstanceAction({ workflowId: workflow.id }), {
      success: t('toast.instanceStarted'),
      onSuccess: () => router.push('/dashboard/instances'),
    })

  const removeWorkflow = () => {
    setConfirmDelete(false)
    run(() => deleteWorkflowAction({ workflowId: workflow.id }), {
      success: t('toast.workflowDeleted'),
      onSuccess: () => router.push('/dashboard/workflows'),
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <form onSubmit={handleSubmit(save)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('builder.details')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="builder-name">{t('builder.name')}</Label>
              <Input id="builder-name" autoComplete="off" disabled={!canManage} {...register('name')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="builder-description">{t('builder.description')}</Label>
              <Textarea id="builder-description" disabled={!canManage} {...register('description')} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('builder.steps')}</CardTitle>
            {canManage && (
              <Button type="button" variant="outline" size="sm" onClick={() => append(emptyStep())}>
                <PlusIcon />
                {t('builder.addStep')}
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="border-border bg-background/60 space-y-4 rounded-lg border p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs font-semibold uppercase">
                    {t('builder.step', { number: index + 1 })}
                  </span>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <Button type="button" variant="ghost" size="icon-xs" disabled={index === 0} onClick={() => move(index, index - 1)} aria-label={t('builder.moveStepUp')}>
                        <ChevronUpIcon />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-xs" disabled={index === fields.length - 1} onClick={() => move(index, index + 1)} aria-label={t('builder.moveStepDown')}>
                        <ChevronDownIcon />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-xs" disabled={fields.length === 1} onClick={() => remove(index)} aria-label={t('builder.removeStep')}>
                        <Trash2Icon className="text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor={`step-name-${index}`}>{t('builder.stepName')}</Label>
                    <Input id={`step-name-${index}`} disabled={!canManage} {...register(`steps.${index}.name`)} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor={`step-desc-${index}`}>{t('builder.description')}</Label>
                    <Textarea id={`step-desc-${index}`} disabled={!canManage} {...register(`steps.${index}.description`)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`step-kind-${index}`}>{t('builder.stepType')}</Label>
                    <Controller
                      control={control}
                      name={`steps.${index}.kind`}
                      render={({ field: cf }) => (
                        <Select value={cf.value} onValueChange={(v) => cf.onChange(v as StepKind)} disabled={!canManage}>
                          <SelectTrigger id={`step-kind-${index}`} className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="TASK">{t('status.TASK')}</SelectItem>
                            <SelectItem value="APPROVAL">{t('status.APPROVAL')}</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  {watchedSteps?.[index]?.kind === 'APPROVAL' && (
                    <div className="space-y-2">
                      <Label htmlFor={`step-approval-${index}`}>{t('builder.approvalRule')}</Label>
                      <Controller
                        control={control}
                        name={`steps.${index}.approvalMode`}
                        render={({ field: cf }) => (
                          <Select
                            value={cf.value ?? 'ANY'}
                            onValueChange={(value) => cf.onChange(value)}
                            disabled={!canManage}
                          >
                            <SelectTrigger id={`step-approval-${index}`} className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ANY">{t('builder.anyApprover')}</SelectItem>
                              <SelectItem value="ALL">{t('builder.allApprovers')}</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor={`step-role-${index}`}>{t('builder.requiredRole')}</Label>                    <Controller
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
                            <SelectItem value={NO_ROLE}>{t('builder.anyone')}</SelectItem>
                            <SelectItem value="MEMBER">{t('builder.memberPlus')}</SelectItem>
                            <SelectItem value="ADMIN">{t('builder.adminPlus')}</SelectItem>
                            <SelectItem value="OWNER">{t('status.OWNER')}</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`step-due-${index}`}>{t('builder.dueInDays')}</Label>
                    <Input
                      id={`step-due-${index}`}
                      type="number"
                      min={0}
                      max={365}
                      disabled={!canManage}
                      placeholder={t('builder.noDueDate')}
                      {...register(`steps.${index}.dueInDays`, {
                        setValueAs: (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
                      })}
                    />
                  </div>
                </div>

                <StepFieldsEditor control={control} register={register} index={index} disabled={!canManage} />

                <div className="border-border space-y-3 rounded-md border border-dashed p-3">
                  <p className="text-muted-foreground text-xs font-medium">
                    {t('builder.conditionHint')}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor={`cond-field-${index}`}>{t('builder.field')}</Label>
                      <Input id={`cond-field-${index}`} disabled={!canManage} placeholder={t('builder.fieldPlaceholder')} {...register(`steps.${index}.condition.field`)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`cond-op-${index}`}>{t('builder.operator')}</Label>
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
                                  {t(OP_KEY[op])}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`cond-value-${index}`}>{t('builder.value')}</Label>
                      <Input id={`cond-value-${index}`} disabled={!canManage} placeholder={t('builder.valuePlaceholder')} {...register(`steps.${index}.condition.valueText`)} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {errors.steps && <p className="text-destructive text-sm">{t('builder.checkSteps')}</p>}
          </CardContent>
        </Card>

        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" variant="outline" disabled={isPending}>
              {isPending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
              {t('builder.saveDraft')}
            </Button>
            <Button type="button" onClick={publish} disabled={isPending}>
              <RocketIcon />
              {t('builder.publish')}
            </Button>
          </div>
        )}
      </form>

      <aside className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('builder.status')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">{t('builder.current')}</span>
              <Badge variant={workflow.status === 'PUBLISHED' ? 'default' : 'outline'}>
                {t(`status.${workflow.status}` as MessageKey)}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">{t('builder.runs')}</span>
              <span className="text-sm font-medium">{workflow.instanceCount}</span>
            </div>
            {canRun && (
              <Button type="button" className="w-full" onClick={startInstance} disabled={isPending || workflow.status !== 'PUBLISHED'}>
                <PlayIcon />
                {t('builder.startInstance')}
              </Button>
            )}
            {workflow.status !== 'PUBLISHED' && (
              <p className="text-muted-foreground text-xs">{t('builder.publishFirst')}</p>
            )}
          </CardContent>
        </Card>

        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>{t('builder.dangerZone')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Button type="button" variant="destructive" className="w-full" onClick={() => setConfirmDelete(true)} disabled={workflow.instanceCount > 0}>
                <Trash2Icon />
                {t('builder.deleteWorkflow')}
              </Button>
              {workflow.instanceCount > 0 && (
                <p className="text-muted-foreground mt-2 text-xs">{t('builder.deleteWithRuns')}</p>
              )}
            </CardContent>
          </Card>
        )}
      </aside>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('builder.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('builder.deleteConfirmBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={removeWorkflow}>
              {t('common.delete')}
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
  const watchedFields = useWatch({ control, name: `steps.${index}.fields` })
  const t = useT()

  return (
    <div className="border-border space-y-3 rounded-md border border-dashed p-3">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs font-medium">{t('builder.formFields')}</p>
        {!disabled && (
          <Button type="button" variant="outline" size="xs" onClick={() => append(emptyField())}>
            <PlusIcon />
            {t('builder.addField')}
          </Button>
        )}
      </div>

      {fields.length === 0 && (
        <p className="text-muted-foreground text-xs">{t('builder.noFields')}</p>
      )}

      {fields.map((field, fieldIndex) => {
        const fieldType = watchedFields?.[fieldIndex]?.type ?? 'text'
        return (
          <div key={field.id} className="border-border/60 space-y-2 rounded-md border p-2">
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_9rem_auto]">
              <Input
                id={`f-${index}-${fieldIndex}-key`}
                aria-label={t('builder.fieldKey')}
                placeholder={t('builder.fieldKeyPlaceholder')}
                disabled={disabled}
                {...register(`steps.${index}.fields.${fieldIndex}.key`)}
              />
              <Input
                id={`f-${index}-${fieldIndex}-label`}
                aria-label={t('builder.fieldLabel')}
                placeholder={t('builder.fieldLabelPlaceholder')}
                disabled={disabled}
                {...register(`steps.${index}.fields.${fieldIndex}.label`)}
              />
              <Controller
                control={control}
                name={`steps.${index}.fields.${fieldIndex}.type`}
                render={({ field: cf }) => (
                  <Select
                    value={cf.value}
                    onValueChange={(value) => cf.onChange(value as FormFieldType)}
                    disabled={disabled}
                  >
                    <SelectTrigger
                      id={`f-${index}-${fieldIndex}-type`}
                      className="w-full"
                      aria-label={t('builder.fieldType')}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {t(FIELD_TYPE_KEY[type])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={disabled}
                onClick={() => remove(fieldIndex)}
                aria-label={t('builder.removeField')}
              >
                <Trash2Icon className="text-destructive" />
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              {fieldType === 'select' && (
                <Input
                  id={`f-${index}-${fieldIndex}-options`}
                  className="min-w-52 flex-1"
                  aria-label={t('builder.fieldOptions')}
                  placeholder={t('builder.fieldOptionsPlaceholder')}
                  disabled={disabled}
                  {...register(`steps.${index}.fields.${fieldIndex}.optionsText`)}
                />
              )}
              <label className="flex items-center gap-2 text-sm">
                <Controller
                  control={control}
                  name={`steps.${index}.fields.${fieldIndex}.required`}
                  render={({ field: cf }) => (
                    <Checkbox
                      checked={cf.value}
                      onCheckedChange={(value) => cf.onChange(value === true)}
                      disabled={disabled}
                    />
                  )}
                />
                {t('builder.required')}
              </label>
            </div>
          </div>
        )
      })}
    </div>
  )
}
