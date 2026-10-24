'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/shared/components/ui/button'
import { useAction } from '@/shared/hooks/useAction'
import { acceptInvitationAction } from '@/features/organization/actions'
import { Loader2Icon } from 'lucide-react'

export function AcceptInvitation({ token, organizationName }: { token: string; organizationName: string }) {
  const router = useRouter()
  const { isPending, run } = useAction()

  const accept = () =>
    run(() => acceptInvitationAction({ token }), {
      success: `You joined ${organizationName}`,
      onSuccess: () => {
        router.push('/dashboard')
        router.refresh()
      },
    })

  return (
    <Button onClick={accept} disabled={isPending} size="lg" className="w-full">
      {isPending && <Loader2Icon className="animate-spin" />}
      Accept invitation
    </Button>
  )
}
