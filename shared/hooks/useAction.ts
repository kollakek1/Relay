'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import type { ActionResult } from '@/shared/server/errors'

interface RunOptions<T> {
  success?: string
  error?: string
  onSuccess?: (data: T) => void
  onError?: (message: string) => void
}

/**
 * Wraps a server-action call with pending state, a success toast and an error
 * toast. Server actions return a discriminated `ActionResult`, so the UI always
 * reflects the real outcome instead of optimistically assuming success.
 */
export function useAction() {
  const [isPending, startTransition] = useTransition()

  function run<T>(action: () => Promise<ActionResult<T>>, options: RunOptions<T> = {}) {
    startTransition(async () => {
      try {
        const result = await action()
        if (!result.ok) {
          toast.error(options.error ?? result.error)
          options.onError?.(result.error)
          return
        }
        if (options.success) toast.success(options.success)
        options.onSuccess?.(result.data)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Something went wrong'
        toast.error(message)
        options.onError?.(message)
      }
    })
  }

  return { isPending, run }
}
