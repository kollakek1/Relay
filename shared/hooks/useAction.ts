'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import type { ActionResult, ErrorCode } from '@/shared/server/errors'
import { useT } from '@/shared/i18n/provider'
import type { MessageKey } from '@/shared/i18n/translate'

interface RunOptions<T> {
  /** Overrides the localized default success message. */
  success?: string
  /** Overrides the localized default error message. */
  error?: string
  onSuccess?: (data: T) => void
  onError?: (message: string) => void
}

/** Maps an `ActionResult` error code to a translated, user-safe message. */
const ERROR_KEY: Record<ErrorCode, MessageKey> = {
  UNAUTHORIZED: 'actionErrors.unauthorized',
  FORBIDDEN: 'actionErrors.forbidden',
  NOT_FOUND: 'actionErrors.notFound',
  CONFLICT: 'actionErrors.conflict',
  VALIDATION: 'actionErrors.validation',
  RATE_LIMITED: 'actionErrors.rateLimited',
}

/**
 * Wraps a server-action call with pending state, a localized success toast and a
 * localized error toast. Server actions return a discriminated `ActionResult`
 * whose `code` is translated here, so the UI never surfaces a raw server string
 * (which is written without locale context) to the user.
 */
export function useAction() {
  const t = useT()
  const [isPending, startTransition] = useTransition()

  function run<T>(action: () => Promise<ActionResult<T>>, options: RunOptions<T> = {}) {
    startTransition(async () => {
      try {
        const result = await action()
        if (!result.ok) {
          const message = options.error ?? t(ERROR_KEY[result.code])
          toast.error(message)
          options.onError?.(message)
          return
        }
        if (options.success) toast.success(options.success)
        options.onSuccess?.(result.data)
      } catch {
        const message = options.error ?? t('actionErrors.unexpected')
        toast.error(message)
        options.onError?.(message)
      }
    })
  }

  return { isPending, run }
}
