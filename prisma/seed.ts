import { auth } from '@/shared/lib/auth'
import { prisma } from '@/shared/lib/prisma'

const rootMail = process.env.ROOT_EMAIL || 'admin@relay.com'
const rootPassword = process.env.ROOT_PASSWORD || 'rootroot'

/**
 * Idempotent seed:
 *  1. ensures the root ADMIN account exists (via Better Auth so the password
 *     is hashed correctly),
 *  2. gives it a demo workspace,
 *  3. adds a sample draft workflow so the builder is not empty on first run.
 */
async function main() {
  let user = await prisma.user.findUnique({ where: { email: rootMail } })

  if (!user) {
    await auth.api.signUpEmail({
      body: { name: 'Root', email: rootMail, password: rootPassword },
    })
    user = await prisma.user.findUnique({ where: { email: rootMail } })
    if (!user) throw new Error('Failed to create the root account')
    await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } })
    console.log('✔ Created root account')
  } else {
    console.log('• Root account already exists')
  }

  const admin = await prisma.user.findUniqueOrThrow({ where: { email: rootMail } })

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
    console.log('✔ Created demo workspace')
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
            { order: 2, name: 'Review', description: 'Review the draft', assigneeRole: 'ADMIN', dueInDays: 1 },
            { order: 3, name: 'Publish', description: 'Publish the content', dueInDays: 1 },
          ],
        },
      },
    })
    console.log('✔ Created sample workflow')
  }

  console.log('\nLogin: ' + rootMail)
  console.log('Password: ' + rootPassword)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
