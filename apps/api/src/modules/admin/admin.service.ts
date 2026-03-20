import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Practice analytics: appointment stats, revenue, patient counts.
   */
  async getAnalytics(
    practiceId: string,
    options: { from?: string; to?: string } = {},
  ) {
    const dateFilter: any = {};
    if (options.from || options.to) {
      dateFilter.created_at = {};
      if (options.from) dateFilter.created_at.gte = new Date(options.from);
      if (options.to) dateFilter.created_at.lte = new Date(options.to);
    }

    const [
      totalAppointments,
      completedAppointments,
      cancelledAppointments,
      noShowAppointments,
      revenueResult,
      totalPatients,
      newPatients,
    ] = await Promise.all([
      this.prisma.appointment.count({
        where: { practice_id: practiceId, ...dateFilter },
      }),
      this.prisma.appointment.count({
        where: { practice_id: practiceId, status: 'COMPLETED', ...dateFilter },
      }),
      this.prisma.appointment.count({
        where: { practice_id: practiceId, status: 'CANCELLED', ...dateFilter },
      }),
      this.prisma.appointment.count({
        where: { practice_id: practiceId, status: 'NO_SHOW', ...dateFilter },
      }),
      this.prisma.paymentRecord.aggregate({
        where: { practice_id: practiceId, status: 'SUCCEEDED', ...dateFilter },
        _sum: { amount: true },
      }),
      this.prisma.appointment
        .findMany({
          where: { practice_id: practiceId },
          select: { patient_id: true },
          distinct: ['patient_id'],
        })
        .then((r) => r.length),
      this.prisma.appointment
        .findMany({
          where: { practice_id: practiceId, ...dateFilter },
          select: { patient_id: true },
          distinct: ['patient_id'],
        })
        .then((r) => r.length),
    ]);

    const totalRevenue = revenueResult._sum.amount
      ? Number(revenueResult._sum.amount)
      : 0;

    const completionRate =
      totalAppointments > 0
        ? Math.round((completedAppointments / totalAppointments) * 10000) / 100
        : 0;

    return {
      total_appointments: totalAppointments,
      completed_appointments: completedAppointments,
      cancelled_appointments: cancelledAppointments,
      no_show_appointments: noShowAppointments,
      total_revenue: totalRevenue,
      total_patients: totalPatients,
      new_patients_period: newPatients,
      appointment_completion_rate: completionRate,
    };
  }

  /**
   * List patients for a practice with search.
   */
  async listPatients(
    practiceId: string,
    options: { search?: string; page?: number; limit?: number } = {},
  ) {
    const { search, page = 1, limit = 20 } = options;

    // Find distinct patient IDs who have appointments at this practice
    const patientIds = await this.prisma.appointment.findMany({
      where: { practice_id: practiceId },
      select: { patient_id: true },
      distinct: ['patient_id'],
    });

    const ids = patientIds.map((p) => p.patient_id);

    const where: any = { id: { in: ids } };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [patients, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          avatar_url: true,
          date_of_birth: true,
          gender: true,
          created_at: true,
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: patients,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * List payments for a practice (admin view).
   */
  async listPayments(
    practiceId: string,
    options: {
      status?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const { status, from, to, page = 1, limit = 20 } = options;

    const where: any = { practice_id: practiceId };
    if (status) where.status = status;
    if (from || to) {
      where.created_at = {};
      if (from) where.created_at.gte = new Date(from);
      if (to) where.created_at.lte = new Date(to);
    }

    const [payments, total] = await Promise.all([
      this.prisma.paymentRecord.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          appointment: {
            select: {
              id: true,
              patient_id: true,
              start_time: true,
              patient: { select: { name: true, email: true } },
              service: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.paymentRecord.count({ where }),
    ]);

    return {
      data: payments.map((p) => ({
        ...p,
        amount: Number(p.amount),
        platform_fee: p.platform_fee ? Number(p.platform_fee) : null,
        refund_amount: p.refund_amount ? Number(p.refund_amount) : null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
