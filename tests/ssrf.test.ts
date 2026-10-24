import { describe, expect, it } from 'vitest'
import {
  checkOutboundUrl,
  isBlockedIpLiteral,
  resolveAndAssertSafe,
  type HostResolver,
} from '@/shared/server/ssrf'

describe('IP literal classification', () => {
  it('blocks loopback, private, link-local and reserved ranges', () => {
    const blocked = [
      '127.0.0.1',
      '127.1.2.3',
      '10.0.0.5',
      '172.16.5.4',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.169.254', // cloud metadata
      '100.64.0.1',
      '0.0.0.0',
      '255.255.255.255',
      '224.0.0.1',
      '198.18.0.1',
      '::1',
      '::',
      'fc00::1',
      'fd12:3456::1',
      'fe80::1',
      'ff02::1',
      '::ffff:127.0.0.1',
      '::ffff:169.254.169.254',
    ]
    for (const address of blocked) {
      expect(isBlockedIpLiteral(address), address).toBe(true)
    }
  })

  it('allows ordinary public addresses', () => {
    for (const address of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '2606:2800:220:1::1']) {
      expect(isBlockedIpLiteral(address), address).toBe(false)
    }
  })
})

describe('checkOutboundUrl', () => {
  it('rejects non-http(s) schemes and embedded credentials', () => {
    expect(checkOutboundUrl('ftp://example.com').ok).toBe(false)
    expect(checkOutboundUrl('file:///etc/passwd').ok).toBe(false)
    expect(checkOutboundUrl('https://user:pass@example.com/hook').ok).toBe(false)
    expect(checkOutboundUrl('not a url').ok).toBe(false)
  })

  it('blocks localhost, metadata hosts and private addresses', () => {
    expect(checkOutboundUrl('http://localhost/hook').ok).toBe(false)
    expect(checkOutboundUrl('http://foo.localhost/hook').ok).toBe(false)
    expect(checkOutboundUrl('http://service.internal/hook').ok).toBe(false)
    expect(checkOutboundUrl('http://169.254.169.254/latest/meta-data').ok).toBe(false)
    expect(checkOutboundUrl('http://127.0.0.1:8080/hook').ok).toBe(false)
    expect(checkOutboundUrl('http://[::1]/hook').ok).toBe(false)
    // Non-standard IP encodings normalise to the blocked literal.
    expect(checkOutboundUrl('http://2130706433/hook').ok).toBe(false)
    expect(checkOutboundUrl('http://0x7f.1/hook').ok).toBe(false)
  })

  it('enforces the port policy', () => {
    expect(checkOutboundUrl('https://example.com/hook').ok).toBe(true)
    expect(checkOutboundUrl('http://example.com/hook').ok).toBe(true)
    expect(checkOutboundUrl('https://example.com:1234/hook').ok).toBe(false)
  })

  it('accepts a normal public https endpoint', () => {
    expect(checkOutboundUrl('https://hooks.example.com/relay').ok).toBe(true)
  })
})

describe('resolveAndAssertSafe', () => {
  const resolver = (addresses: string[]): HostResolver => async () =>
    addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }))

  it('blocks a public hostname that resolves to a private address (DNS rebinding)', async () => {
    await expect(
      resolveAndAssertSafe('https://rebind.example.com/hook', resolver(['127.0.0.1']))
    ).rejects.toThrow(/private or reserved/i)
  })

  it('blocks when any resolved address is private', async () => {
    await expect(
      resolveAndAssertSafe('https://mixed.example.com/hook', resolver(['93.184.216.34', '10.0.0.1']))
    ).rejects.toThrow(/private or reserved/i)
  })

  it('blocks when the host cannot be resolved', async () => {
    await expect(
      resolveAndAssertSafe('https://nope.example.com/hook', async () => {
        throw new Error('ENOTFOUND')
      })
    ).rejects.toThrow(/could not resolve/i)
  })

  it('allows a hostname resolving only to public addresses', async () => {
    const url = await resolveAndAssertSafe(
      'https://ok.example.com/hook',
      resolver(['93.184.216.34'])
    )
    expect(url.hostname).toBe('ok.example.com')
  })
})
