import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const now = new Date()

    // 1. Establish the operational window for today (00:00 to 23:59)
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    
    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)

    // 2. Fetch all active barbers currently clocked in or available
    const activeBarbers = await prisma.barberProfile.findMany({
      where: { isAvailable: true },
      select: { id: true, user: { select: { name: true } } }
    })

    if (activeBarbers.length === 0) {
      return NextResponse.json({
        success: true,
        data: { estimatedWaitMinutes: 0, message: "No active barbers available." }
      })
    }

    // 3. Query all pending or ongoing client appointments for today
    const activeAppointments = await prisma.appointment.findMany({
      where: {
        startTime: { gte: todayStart, lte: todayEnd },
        status: { in: ['PENDING', 'CONFIRMED'] }
      },
      include: {
        service: { select: { duration: true } }
      },
      orderBy: { startTime: 'asc' }
    })

    // 4. Calculate total outstanding workload minutes stacked per barber chair
    const barberWorkloads: Record<string, number> = {}
    activeBarbers.forEach(barber => {
      barberWorkloads[barber.id] = 0
    })

    activeAppointments.forEach(appt => {
      if (barberWorkloads[appt.barberId] !== undefined) {
        const apptEnd = new Date(appt.endTime)
        
        // Only count time remaining if the appointment is in the future or currently running
        if (apptEnd > now) {
          const startCalculation = new Date(appt.startTime) > now ? new Date(appt.startTime) : now
          const remainingMinutes = Math.max(0, Math.ceil((apptEnd.getTime() - startCalculation.getTime()) / (1000 * 60)))
          barberWorkloads[appt.barberId] += remainingMinutes
        }
      }
    })

    // 5. The walk-in wait time is determined by the barber with the shortest remaining queue line
    const remainingTimes = Object.values(barberWorkloads)
    const baselineWaitMinutes = Math.min(...remainingTimes)

    // 6. Build the dynamic descriptive standings structure for the front-end layout cards
    const queueBreakdown = activeBarbers.map(barber => ({
      barberId: barber.id,
      barberName: barber.user.name,
      minutesRemaining: barberWorkloads[barber.id],
      status: barberWorkloads[barber.id] === 0 ? "Empty / Available" : `Busy (${barberWorkloads[barber.id]} mins queue)`
    }))

    return NextResponse.json({
      success: true,
      data: {
        estimatedWaitMinutes: baselineWaitMinutes,
        activeBarberCount: activeBarbers.length,
        totalPendingAppointments: activeAppointments.length,
        chairs: queueBreakdown
      }
    })

  } catch (error) {
    console.error("Critical Queue Analytics Failure:", error)
    return NextResponse.json(
      { success: false, message: "Internal server data compilation error" },
      { status: 500 }
    )
  }
}
