import Link from 'next/link'
import { getSession } from '@/shared/server/auth-context'
import { getInvitationPreview } from '@/features/organization/server/invitations'
import { ROLE_LABEL } from '@/shared/server/permissions'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { AcceptInvitation } from '@/features/organization/components/accept-invitation'
import { GridBackground } from '@/shared/components/decorative/gridBackground'

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const [session, preview] = await Promise.all([getSession(), getInvitationPreview(token)])

  let body: React.ReactNode

  if (!preview) {
    body = (
      <CardDescription>This invitation link is invalid or has been removed.</CardDescription>
    )
  } else if (preview.status === 'ACCEPTED') {
    body = <CardDescription>This invitation has already been used.</CardDescription>
  } else if (preview.status === 'REVOKED') {
    body = <CardDescription>This invitation was revoked by an administrator.</CardDescription>
  } else if (preview.status === 'EXPIRED' || preview.expired) {
    body = (
      <CardDescription>This invitation has expired. Ask an administrator to send a new one.</CardDescription>
    )
  } else if (!session?.user) {
    body = (
      <div className="space-y-4">
        <CardDescription>
          Sign in or create an account as <strong>{preview.email}</strong> to accept this invitation.
        </CardDescription>
        <Button asChild className="w-full">
          <Link href="/dashboard/auth">Sign in</Link>
        </Button>
      </div>
    )
  } else if (session.user.email.toLowerCase() !== preview.email.toLowerCase()) {
    body = (
      <CardDescription>
        This invitation was issued to <strong>{preview.email}</strong>, but you are signed in as{' '}
        <strong>{session.user.email}</strong>. Sign in with the invited address to accept it.
      </CardDescription>
    )
  } else {
    body = (
      <div className="space-y-4">
        <CardDescription>
          You have been invited to join <strong>{preview.organizationName}</strong> as{' '}
          <strong>{ROLE_LABEL[preview.role]}</strong>.
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
          <CardTitle>Workspace invitation</CardTitle>
        </CardHeader>
        <CardContent>{body}</CardContent>
      </Card>
    </main>
  )
}
