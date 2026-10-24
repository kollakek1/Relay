'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { useAction } from '@/shared/hooks/useAction'
import { useT } from '@/shared/i18n/provider'
import { updateOrganizationAction } from '@/features/organization/actions'
import { Loader2Icon, SaveIcon } from 'lucide-react'

const TIMEZONES = [
  'UTC',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/Moscow',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
]

export interface OrganizationSettings {
  name: string
  description: string | null
  timezone: string
}

export function OrganizationSettingsForm({
  organization,
  canManage,
}: {
  organization: OrganizationSettings
  canManage: boolean
}) {
  const router = useRouter()
  const { isPending, run } = useAction()
  const t = useT()
  const [name, setName] = useState(organization.name)
  const [description, setDescription] = useState(organization.description ?? '')
  const [timezone, setTimezone] = useState(organization.timezone)

  if (!canManage) {
    return (
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <p className="text-muted-foreground">{t('orgSettings.name')}</p>
          <p className="font-medium">{organization.name}</p>
        </div>
        <div>
          <p className="text-muted-foreground">{t('orgSettings.timezone')}</p>
          <p className="font-medium">{organization.timezone}</p>
        </div>
        {organization.description && (
          <div className="sm:col-span-2">
            <p className="text-muted-foreground">{t('orgSettings.description')}</p>
            <p>{organization.description}</p>
          </div>
        )}
      </div>
    )
  }

  const options = TIMEZONES.includes(timezone) ? TIMEZONES : [timezone, ...TIMEZONES]

  const save = () =>
    run(() => updateOrganizationAction({ name, description, timezone }), {
      success: t('orgSettings.updated'),
      onSuccess: () => router.refresh(),
    })

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="org-name">{t('orgSettings.name')}</Label>
          <Input
            id="org-name"
            value={name}
            autoComplete="off"
            onChange={(event) => setName(event.target.value)}
            disabled={isPending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-timezone">{t('orgSettings.timezone')}</Label>
          <Select value={timezone} onValueChange={setTimezone} disabled={isPending}>
            <SelectTrigger id="org-timezone" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((zone) => (
                <SelectItem key={zone} value={zone}>
                  {zone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="org-description">{t('orgSettings.description')}</Label>
        <Textarea
          id="org-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={isPending}
          placeholder={t('orgSettings.descriptionPlaceholder')}
        />
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={isPending || name.trim().length < 2}>
          {isPending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
          {t('common.save')}
        </Button>
      </div>
    </div>
  )
}
