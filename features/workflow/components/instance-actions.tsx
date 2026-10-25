'use client'

import { useState } from 'react'
import { ArchiveIcon, Loader2Icon } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
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
import { archiveInstanceAction } from '@/features/workflow/actions'
import { useAction } from '@/shared/hooks/useAction'
import { useT } from '@/shared/i18n/provider'

/**
 * Archive action for a finished process instance. The button is only rendered
 * when the caller holds `workflow.delete`; the server re-checks the permission
 * and the terminal-state/task guards regardless.
 */
export function ArchiveInstanceButton({
  instanceId,
  name,
}: {
  instanceId: string
  name: string
}) {
  const t = useT()
  const { isPending, run } = useAction()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} disabled={isPending}>
        {isPending ? <Loader2Icon className="animate-spin" /> : <ArchiveIcon />}
        <span className="sr-only sm:not-sr-only">{t('archive.archiveAction')}</span>
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('archive.archiveTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('archive.archiveBody', { name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                run(() => archiveInstanceAction({ instanceId }), {
                  success: t('archive.archiveSuccess'),
                })
              }
            >
              {t('archive.archiveConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
