'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/shared/components/ui/button'
import { useAction } from '@/shared/hooks/useAction'
import { acceptInvitationAction } from '@/features/organization/actions'
import { useT } from '@/shared/i18n/provider'
import { Loader2Icon } from 'lucide-react'

export function AcceptInvitation({ token, organizationName }: { token: string; organizationName: string }) {
  const router = useRouter()
  const t = useT()
  const { isPending, run } = useAction()

  const accept = () =>
    run(() => acceptInvitationAction({ token }), {
      success: `${t('invite.accepted')} · ${organizationName}`,
      onSuccess: () => {
        router.push('/dashboard')
        router.refresh()
      },
    })

  return (
    <Button onClick={accept} disabled={isPending} size="lg" className="w-full">
      {isPending ? <Loader2Icon className="animate-spin" /> : null}
      {isPending ? t('invite.accepting') : t('invite.accept')}
    </Button>
  )
}
