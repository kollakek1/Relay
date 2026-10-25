'use client'

import { useState } from 'react'
import { Loader2Icon, RotateCcwIcon } from 'lucide-react'
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
import { restoreInstanceAction } from '@/features/workflow/actions'
import { useAction } from '@/shared/hooks/useAction'
import { useT } from '@/shared/i18n/provider'

/** Restore action for an archived process instance. */
export function RestoreInstanceButton({
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
        {isPending ? <Loader2Icon className="animate-spin" /> : <RotateCcwIcon />}
        <span className="sr-only sm:not-sr-only">{t('archive.restoreAction')}</span>
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('archive.restoreTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('archive.restoreBody', { name })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                run(() => restoreInstanceAction({ instanceId }), {
                  success: t('archive.restoreSuccess'),
                })
              }
            >
              {t('archive.restoreConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
