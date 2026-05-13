import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking, BookingDocument } from 'src/booking/entities/booking.entity';
import { FinancialReportDto } from './dto/financial-report.dto';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
  ) {}

  async getFinancialReport(dto: FinancialReportDto) {
    const filter: Record<string, any> = { isDeleted: false };

    if (dto.booking_status) {
      filter.booking_status = dto.booking_status;
    }

    if (dto.date_from || dto.date_to) {
      filter.date = {};
      if (dto.date_from) filter.date.$gte = new Date(dto.date_from);
      if (dto.date_to) filter.date.$lte = new Date(dto.date_to);
    }

    if (dto.store_id) {
      try {
        filter.store_id = new Types.ObjectId(dto.store_id);
      } catch {
        filter.store_id = dto.store_id;
      }
    }

    if (dto.booking_type) {
      filter.type = dto.booking_type;
    }

    const limit = Math.min(dto.limit ?? 10000, 50000);

    const bookings = await this.bookingModel
      .find(filter)
      .sort({ date: -1, createdAt: -1 })
      .limit(limit)
      // customer: include code for financial report (unlike regular list which omits code)
      .populate('customer', 'code username email phone_number')
      // store: include code for financial report (unlike regular list which omits code)
      .populate('store', 'code name')
      .populate({
        path: 'sessions.groomer_id',
        select: 'username',
        model: 'User',
      })
      .exec();

    const plain = bookings.map((b) =>
      (b as any).toJSON ? (b as any).toJSON() : b,
    );

    return { bookings: plain, total: plain.length };
  }
}
