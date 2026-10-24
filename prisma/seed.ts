import { auth } from '@/shared/lib/auth'
import { prisma } from '@/shared/lib/prisma'
import {
  SeedConfigurationError,
  isProductionSeed,
  resolveRootCredentials,
  shouldSeedDemoData,
} from './seed-lib'

/**
 * Idempotent seed.
 *
 * Safety rules (see `docs/PRODUCTION_HARDENING.md`):
 *  - No default credentials. `ROOT_EMAIL` is always required and
 *    `ROOT_PASSWORD` is required only when the account does not exist yet.
 *  - Weak / placeholder passwords are rejected.
 *  - The password is **never** written to the console or logs.
 *  - Demo content is opt-in and never created in production by default.
 *
 * For a production deployment, provision the first administrator once with a
 * strong password, sign in, then remove `ROOT_PASSWORD` from the environment
 * (or rotate it). The account continues to exist; re-running the seed without
 * the password is a no-op.
 */
async function main() {
  const production = isProductionSeed()
  const existing = process.env.ROOT_EMAIL
    ? await prisma.user.findUnique({ where: { email: process.env.ROOT_EMAIL.trim().toLowerCase() } })
    : null

  const credentials = resolveRootCredentials(process.env, { accountExists: Boolean(existing) })

  let adminId = existing?.id

  if (!existing) {
    if (!credentials) {
      throw new SeedConfigurationError('Unable to resolve root credentials')
    }
    await auth.api.signUpEmail({
      body: { name: 'Root', email: credentials.email, password: credentials.password },
    })
    const created = await prisma.user.findUnique({ where: { email: credentials.email } })
    if (!created) throw new Error('Failed to create the root account')
    await prisma.user.update({ where: { id: created.id }, data: { role: 'ADMIN' } })
    adminId = created.id
    console.log(`✔ Created the administrator account for ${credentials.email}`)
    console.log('  The password was supplied via ROOT_PASSWORD and is not displayed.')
  } else {
    console.log('• The administrator account already exists — no credentials changed.')
  }

  if (!adminId) throw new Error('Root account id could not be resolved')

  if (!shouldSeedDemoData()) {
    console.log('• Demo data is disabled (set SEED_DEMO_DATA=true to create a sample workspace).')
    return
  }

  const admin = await prisma.user.findUniqueOrThrow({ where: { id: adminId } })

  let membership = await prisma.membership.findFirst({
    where: { userId: admin.id },
    orderBy: { createdAt: 'asc' },
  })

  if (!membership) {
    const organization = await prisma.organization.create({
      data: { name: 'Relay Demo', slug: `relay-demo-${Date.now().toString(36)}` },
    })
    membership = await prisma.membership.create({
      data: { organizationId: organization.id, userId: admin.id, role: 'OWNER' },
    })
    console.log('✔ Created the demo workspace')
  }

  const workflowCount = await prisma.workflow.count({
    where: { organizationId: membership.organizationId },
  })

  if (workflowCount === 0) {
    await prisma.workflow.create({
      data: {
        organizationId: membership.organizationId,
        name: 'Content Review',
        description: 'Draft content, review it, then publish.',
        createdById: admin.id,
        steps: {
          create: [
            { order: 1, name: 'Draft', description: 'Write the first draft', dueInDays: 2 },
            {
              order: 2,
              name: 'Review',
              description: 'Review the draft',
              assigneeRole: 'ADMIN',
              dueInDays: 1,
            },
            { order: 3, name: 'Publish', description: 'Publish the content', dueInDays: 1 },
          ],
        },
      },
    })
    console.log('✔ Created the sample workflow')
  }

  if (production) {
    console.log('\nProduction seed finished. Rotate ROOT_PASSWORD and remove it from the environment.')
  } else {
    console.log(`\nSign in as ${admin.email} using the password you provided.`)
  }
}

main()
  .catch((error) => {
    if (error instanceof SeedConfigurationError) {
      console.error(`\nSeed aborted: ${error.message}\n`)
    } else {
      console.error(error)
    }
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
