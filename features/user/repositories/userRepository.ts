import { User } from '@/prisma/generated/prisma/client'
import { UserCreateInput, UserUpdateInput } from '@/prisma/generated/prisma/models'
import { prisma } from '@/shared/lib/prisma'

class UserRepository {
  async findAll(): Promise<User[]> {
    return prisma.user.findMany()
  }

  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } })
  }

  async update(id: string, data: UserUpdateInput): Promise<User | null> {
    return prisma.user.update({ where: { id }, data })
  }

  async create(data: UserCreateInput): Promise<User> {
    return prisma.user.create({ data })
  }

  async delete(id: string): Promise<User> {
    return prisma.user.delete({ where: { id } })
  }
}

export const userRepository = new UserRepository()
