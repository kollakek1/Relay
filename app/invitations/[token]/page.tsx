import Link from 'next/link'
import { getSession } from '@/shared/server/auth-context'
import { getInvitationPreview } from '@/features/organization/server/invitations'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { AcceptInvitation } from '@/features/organization/components/accept-invitation'
import { GridBackground } from '@/shared/components/decorative/gridBackground'
import { getTranslator } from '@/shared/i18n/server'

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { t } = await getTranslator()
  const [session, preview] = await Promise.all([getSession(), getInvitationPreview(token)])

  let body: React.ReactNode

  if (!preview) {
    body = <CardDescription>{t('invite.invalid')}</CardDescription>
  } else if (preview.status === 'ACCEPTED') {
    body = <CardDescription>{t('invite.alreadyUsed')}</CardDescription>
  } else if (preview.status === 'REVOKED') {
    body = <CardDescription>{t('invite.revoked')}</CardDescription>
  } else if (preview.status === 'EXPIRED' || preview.expired) {
    body = <CardDescription>{t('invite.expired')}</CardDescription>
  } else if (!session?.user) {
    body = (
      <div className="space-y-4">
        <CardDescription>
          {t('invite.signInPrompt', { email: preview.email })}
        </CardDescription>
        <Button asChild className="w-full">
          <Link href="/dashboard/auth">{t('invite.signIn')}</Link>
        </Button>
      </div>
    )
  } else if (session.user.email.toLowerCase() !== preview.email.toLowerCase()) {
    body = (
      <CardDescription>
        {t('invite.wrongAccount', {
          invited: preview.email,
          current: session.user.email,
        })}
      </CardDescription>
    )
  } else {
    body = (
      <div className="space-y-4">
        <CardDescription>
          {t('invite.invitedAs', {
            organization: preview.organizationName,
            role: t(`status.${preview.role}`),
          })}
        </CardDescription>
        <AcceptInvitation token={token} organizationName={preview.organizationName} />
      </div>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <GridBackground />
      <Card className="z-10 w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('invite.cardTitle')}</CardTitle>
        </CardHeader>
        <CardContent>{body}</CardContent>
      </Card>
    </main>
  )
}
