import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isJobAuthorized, jobSecret, safeEqual } from '@/shared/server/job-auth'

function request(url: string, init?: RequestInit): Request {
  return new Request(url, init)
}

describe('cron job auth', () => {
  const original = process.env.CRON_SECRET

  beforeEach(() => {
    process.env.CRON_SECRET = 'a-long-random-cron-secret-value'
  })

  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = original
  })

  it('accepts the secret only via Authorization: Bearer', () => {
    const authorized = request('https://relay.test/api/jobs/drain', {
      method: 'POST',
      headers: { authorization: 'Bearer a-long-random-cron-secret-value' },
    })
    expect(isJobAuthorized(authorized)).toBe(true)
  })

  it('rejects the secret in the query string', () => {
    const viaQuery = request(
      'https://relay.test/api/jobs/drain?secret=a-long-random-cron-secret-value',
      { method: 'POST' }
    )
    expect(isJobAuthorized(viaQuery)).toBe(false)
  })

  it('rejects missing, malformed and wrong credentials', () => {
    expect(isJobAuthorized(request('https://relay.test/api/jobs/drain', { method: 'POST' }))).toBe(
      false
    )
    expect(
      isJobAuthorized(
        request('https://relay.test/api/jobs/drain', {
          method: 'POST',
          headers: { authorization: 'Basic abc' },
        })
      )
    ).toBe(false)
    expect(
      isJobAuthorized(
        request('https://relay.test/api/jobs/drain', {
          method: 'POST',
          headers: { authorization: 'Bearer wrong-secret' },
        })
      )
    ).toBe(false)
    expect(
      isJobAuthorized(
        request('https://relay.test/api/jobs/drain', {
          method: 'POST',
          headers: { authorization: 'Bearer ' },
        })
      )
    ).toBe(false)
  })

  it('fails closed when CRON_SECRET is not configured', () => {
    delete process.env.CRON_SECRET
    expect(jobSecret()).toBeUndefined()
    expect(
      isJobAuthorized(
        request('https://relay.test/api/jobs/drain', {
          method: 'POST',
          headers: { authorization: 'Bearer anything' },
        })
      )
    ).toBe(false)
  })
})

describe('safeEqual', () => {
  it('compares without leaking length through an exception', () => {
    expect(safeEqual('abc', 'abc')).toBe(true)
    expect(safeEqual('abc', 'abd')).toBe(false)
    expect(safeEqual('abc', 'abcd')).toBe(false)
    expect(safeEqual('', '')).toBe(true)
  })
})
