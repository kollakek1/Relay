'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Loader2Icon, SaveIcon } from 'lucide-react'
import { authClient } from '@/shared/lib/auth-client'

export function ProfileForm({ initialName }: { initialName: string }) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [isSaving, setIsSaving] = useState(false)

  const save = async () => {
    if (name.trim().length < 2) {
      toast.error('Name must be at least 2 characters')
      return
    }
    setIsSaving(true)
    try {
      const { error } = await authClient.updateUser({ name: name.trim() })
      if (error) throw new Error(error.message || 'Unable to update profile')
      toast.success('Profile updated')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-2">
        <Label htmlFor="profile-name">Display name</Label>
        <Input
          id="profile-name"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={isSaving}
        />
      </div>
      <Button onClick={save} disabled={isSaving || name.trim() === initialName}>
        {isSaving ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
        Save
      </Button>
    </div>
  )
}
