import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from '@/shared/lib/prisma'
import { apiJson, withApiKey } from '@/features/api/server/handler'
import { createApiKey, listApiKeys, revokeApiKey } from '@/features/api/server/keys'
import {
  acceptInvitation,
  createInvitation,
} from '@/features/organization/server/invitations'
import { getTask } from '@/features/task/server/service'
import { createWorkflow, publishWorkflow, runInstance, saveWorkflowDraft } from '@/features/workflow/server/service'
import { cleanupDatabase, createContext, createTestUser, disconnect } from './helpers/db'

function bearer(token: string): Request {
  return new Request('https://relay.test/api/v1/tasks', {
    headers: { authorization: `Bearer ${token}` },
  })
}

describe('API key security', () => {
  afterAll(async () => {
    await cleanupDatabase()
    await disconnect()
  })

  it('enforces scopes, rejects unknown scopes and honours revocation', async () => {
    const ctx = await createContext('OWNER')

    const created = await createApiKey(ctx, { name: 'reader', scopes: ['tasks:read', 'admin:all'] })
    // Unknown scopes are silently dropped, never granted.
    expect(created.apiKey.scopes).toEqual(['tasks:read'])

    const allowed = await withApiKey(bearer(created.token), 'tasks:read', async () => apiJson({ ok: true }))
    expect(allowed.status).toBe(200)

    const forbidden = await withApiKey(bearer(created.token), 'tasks:write', async () =>
      apiJson({ ok: true })
    )
    expect(forbidden.status).toBe(403)

    const invalid = await withApiKey(bearer('rk_not_a_real_key'), 'tasks:read', async () =>
      apiJson({ ok: true })
    )
    expect(invalid.status).toBe(401)

    const keys = await listApiKeys(ctx)
    await revokeApiKey(ctx, keys[0].id)
    const revoked = await withApiKey(bearer(created.token), 'tasks:read', async () =>
      apiJson({ ok: true })
    )
    expect(revoked.status).toBe(401)
  })

  it('does not let a key read another tenant’s task', async () => {
    const orgA = await createContext('OWNER')
    const orgB = await createContext('OWNER')

    const workflow = await createWorkflow(orgA, { name: 'Private' })
    await saveWorkflowDraft(orgA, {
      workflowId: workflow.id,
      name: 'Private',
      steps: [{ name: 'Secret step' }],
    })
    await publishWorkflow(orgA, workflow.id)
    const instance = await runInstance(orgA, workflow.id)
    const [task] = await prisma.task.findMany({ where: { instanceId: instance.id } })

    await expect(getTask(orgB, task.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('invitation acceptance', () => {
  afterAll(async () => {
    await cleanupDatabase()
    await disconnect()
  })

  it('is single-use, idempotent for the invitee and rejects a mismatched email', async () => {
    const ctx = await createContext('OWNER')
    const invitee = await createTestUser('Invitee')
    const stranger = await createTestUser('Stranger')

    const invitation = await createInvitation(ctx, { email: invitee.email, role: 'MEMBER' })
    const token = invitation.link.split('/').pop()!

    // A different account cannot use the invitation.
    await expect(acceptInvitation(stranger.id, stranger.email, token)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    // Concurrent accepts by the invitee: at most one enrollment, no crash.
    const results = await Promise.allSettled([
      acceptInvitation(invitee.id, invitee.email, token),
      acceptInvitation(invitee.id, invitee.email, token),
    ])
    expect(results.some((result) => result.status === 'fulfilled')).toBe(true)

    const memberships = await prisma.membership.count({
      where: { organizationId: ctx.organizationId, userId: invitee.id },
    })
    expect(memberships).toBe(1)

    // A repeated accept by the same user is idempotent, not an error.
    const again = await acceptInvitation(invitee.id, invitee.email, token)
    expect(again.organizationId).toBe(ctx.organizationId)

    // Once accepted, the token cannot enroll anyone else.
    await expect(acceptInvitation(stranger.id, stranger.email, token)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
    expect(
      await prisma.membership.count({
        where: { organizationId: ctx.organizationId, userId: stranger.id },
      })
    ).toBe(0)
  })
})
