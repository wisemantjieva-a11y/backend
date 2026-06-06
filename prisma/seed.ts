import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 1. Clean out existing data
  await prisma.appointment.deleteMany()
  await prisma.service.deleteMany()
  await prisma.barberProfile.deleteMany()
  await prisma.user.deleteMany()

  // 2. Create Services
  const fade = await prisma.service.create({
    data: { name: 'Skin Fade', duration: 45, priceInCents: 3500, description: 'Premium mid/high skin fade' }
  })
  const beard = await prisma.service.create({
    data: { name: 'Beard Sculpt & Shave', duration: 30, priceInCents: 2500, description: 'Hot towel razor shave' }
  })

  // 3. Create Barbers
  const barberUser1 = await prisma.user.create({
    data: { email: 'marcus@barber.com', name: 'Marcus V.', passwordHash: 'hashed_pw', role: 'BARBER' }
  })
  const barber1 = await prisma.barberProfile.create({
    data: { userId: barberUser1.id, bio: 'Fade Master', skills: ['Skin Fade'] }
  })

  const barberUser2 = await prisma.user.create({
    data: { email: 'sarah@barber.com', name: 'Sarah Connor', passwordHash: 'hashed_pw', role: 'BARBER' }
  })
  const barber2 = await prisma.barberProfile.create({
    data: { userId: barberUser2.id, bio: 'Beard Specialist', skills: ['Beard Sculpt & Shave'] }
  })

  // 4. Create Customers
  const customer1 = await prisma.user.create({
    data: { email: 'david@client.com', name: 'David K.', passwordHash: 'hashed_pw', role: 'CUSTOMER' }
  })
  const customer2 = await prisma.user.create({
    data: { email: 'john@client.com', name: 'John D.', passwordHash: 'hashed_pw', role: 'CUSTOMER' }
  })

  // 5. Create Live Today Appointments
  const today = new Date()

  await prisma.appointment.create({
    data: {
      customerId: customer1.id,
      barberId: barber1.id,
      serviceId: fade.id,
      startTime: new Date(today.setHours(15, 0, 0, 0)),
      endTime: new Date(today.setHours(15, 45, 0, 0)),
      status: 'CONFIRMED',
      totalPrice: fade.priceInCents,
      tipAmount: 500
    }
  })

  await prisma.appointment.create({
    data: {
      customerId: customer2.id,
      barberId: barber2.id,
      serviceId: beard.id,
      startTime: new Date(today.setHours(14, 45, 0, 0)),
      endTime: new Date(today.setHours(15, 15, 0, 0)),
      status: 'COMPLETED',
      totalPrice: beard.priceInCents,
      tipAmount: 1000
    }
  })

  console.log('🌱 Database seeded successfully with barbers, services, and live bookings!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
