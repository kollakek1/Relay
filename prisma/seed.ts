import { auth } from '@/shared/lib/auth'
import { prisma } from '@/shared/lib/prisma'

const rootMail = process.env.ROOT_EMAIL || 'admin@relay.com'
const rootPassword = process.env.ROOT_PASSWORD || 'rootroot'

async function main() {
  const response = await auth.api.signUpEmail({
    body: {
      name: 'Root',
      password: rootPassword,
      email: rootMail,
    },
    asResponse: true,
  })

  const userData = await response.json()

  if (userData.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') {
    console.warn('Аккаунт уже создан!')
    return
  }

  await prisma.user.update({
    where: { id: userData.user.id },
    data: { role: 'ADMIN' },
  })

  console.log('Админ аккаунт создан')

  console.log('Логин: ' + rootMail)
  console.log('Пароль: ' + rootPassword)
}

main()
