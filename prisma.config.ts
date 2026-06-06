import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: "postgresql://postgres:NewPassword123@localhost:5432/barbershop_db?schema=public",
  },
})
