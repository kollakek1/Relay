import { logger } from './logger'

export interface SendEmailInput {
  to: string
  subject: string
  text: string
  html?: string
}

export interface SendEmailResult {
  /** Whether an external provider actually accepted the message. */
  delivered: boolean
  provider: string
}

/**
 * Email is optional. When no provider is configured the app must still work:
 * we log the intent and return `delivered: false`, and callers surface the
 * invite link in-app instead of pretending the mail was sent.
 */
export function emailProvider(): 'resend' | 'dev' {
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) return 'resend'
  return 'dev'
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const provider = emailProvider()

  if (provider === 'dev') {
    logger.info('email_dev_fallback', { to: input.to, subject: input.subject })
    return { delivered: false, provider: 'dev' }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
      // Bound the call so a slow provider can never hang a serverless function.
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) {
      logger.warn('email_send_failed', { provider, status: response.status })
      return { delivered: false, provider }
    }
    return { delivered: true, provider }
  } catch (error) {
    logger.warn('email_send_error', {
      provider,
      message: error instanceof Error ? error.message : String(error),
    })
    return { delivered: false, provider }
  }
}
