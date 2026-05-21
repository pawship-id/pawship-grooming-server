import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Booking, BookingDocument } from 'src/booking/entities/booking.entity';
import { Pet, PetDocument } from 'src/pet/entities/pet.entity';
import { User, UserDocument } from 'src/user/entities/user.entity';
import { parseRange, previousRange, toUtcStartOfDay } from '../utils/date-range';

export type PetStatus = 'idle' | 'new' | 'active' | 'at_risk' | 'lapsed';

export interface PetStatusSnapshot {
  idle: number;
  new: number;
  active: number;
  at_risk: number;
  lapsed: number;
  total: number;
}

export interface GrowthResponse {
  range: { from: string; to: string };
  new_customers: number;
  new_pets_registered: number;
  pets_from_existing_owners: number;
  first_booking_conversion_pct: number;
  net_pet_growth: number;
  delta: {
    new_customers_pct: number | null;
    new_pets_registered_pct: number | null;
  };
  pet_status: PetStatusSnapshot;
}

interface GrowthArgs {
  from?: string;
  to?: string;
}

@Injectable()
export class GrowthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Pet.name) private petModel: Model<PetDocument>,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
  ) {}

  async getGrowth(args: GrowthArgs): Promise<GrowthResponse> {
    const range = parseRange(args.from, args.to);
    const prevRange = previousRange(range);

    const [
      newCustomers,
      newPets,
      prevCustomers,
      prevPets,
      conversion,
      status,
    ] = await Promise.all([
      this.userModel.countDocuments({
        role: 'customer',
        createdAt: { $gte: range.from, $lte: range.to },
      }),
      this.petModel.countDocuments({
        createdAt: { $gte: range.from, $lte: range.to },
        isDeleted: { $ne: true },
      }),
      this.userModel.countDocuments({
        role: 'customer',
        createdAt: { $gte: prevRange.from, $lte: prevRange.to },
      }),
      this.petModel.countDocuments({
        createdAt: { $gte: prevRange.from, $lte: prevRange.to },
        isDeleted: { $ne: true },
      }),
      this.computeFirstBookingConversion(),
      this.computePetStatusSnapshot(),
    ]);

    return {
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      new_customers: newCustomers,
      new_pets_registered: newPets,
      pets_from_existing_owners: Math.max(0, newPets - newCustomers),
      first_booking_conversion_pct: conversion,
      // approximation: new pets registered in period minus current lapsed snapshot.
      // Exact transition-in-period tracking butuh event log; di luar scope phase ini.
      net_pet_growth: newPets - status.lapsed,
      delta: {
        new_customers_pct: pctDelta(newCustomers, prevCustomers),
        new_pets_registered_pct: pctDelta(newPets, prevPets),
      },
      pet_status: status,
    };
  }

  /**
   * Pets registered in the last 30 days that already have >=1 completed booking,
   * divided by total pets registered in the same window.
   */
  private async computeFirstBookingConversion(): Promise<number> {
    const today = toUtcStartOfDay(new Date());
    const ago30 = new Date(today);
    ago30.setUTCDate(ago30.getUTCDate() - 30);

    const recentPets = await this.petModel
      .find({
        createdAt: { $gte: ago30 },
        isDeleted: { $ne: true },
      })
      .select('_id')
      .lean<any[]>()
      .exec();

    if (recentPets.length === 0) return 0;

    const recentPetIds = recentPets.map((p) => p._id);
    const convertedIds = await this.bookingModel
      .distinct('pet_id', {
        pet_id: { $in: recentPetIds },
        booking_status: 'completed',
        isDeleted: { $ne: true },
      })
      .exec();

    return round2((convertedIds.length / recentPets.length) * 100);
  }

  /**
   * 5-tier MECE classification. Top-to-bottom priority — first match wins.
   * Based on ALL completed service orders per pet.
   */
  private async computePetStatusSnapshot(): Promise<PetStatusSnapshot> {
    const today = toUtcStartOfDay(new Date());
    const ago14 = new Date(today);
    ago14.setUTCDate(ago14.getUTCDate() - 14);
    const ago30 = new Date(today);
    ago30.setUTCDate(ago30.getUTCDate() - 30);
    const ago31 = new Date(today);
    ago31.setUTCDate(ago31.getUTCDate() - 31);

    const rows = await this.petModel
      .aggregate([
        {
          $match: { is_active: true, isDeleted: { $ne: true } },
        },
        {
          $lookup: {
            from: 'bookings',
            let: { petId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$pet_id', '$$petId'] },
                      { $eq: ['$booking_status', 'completed'] },
                      { $ne: ['$isDeleted', true] },
                    ],
                  },
                },
              },
              {
                $group: {
                  _id: null,
                  total: { $sum: 1 },
                  first_date: { $min: '$date' },
                  last_date: { $max: '$date' },
                },
              },
            ],
            as: 'visits',
          },
        },
        {
          $addFields: {
            total_visits: {
              $ifNull: [{ $arrayElemAt: ['$visits.total', 0] }, 0],
            },
            first_booking_date: {
              $arrayElemAt: ['$visits.first_date', 0],
            },
            last_booking_date: {
              $arrayElemAt: ['$visits.last_date', 0],
            },
          },
        },
        {
          $addFields: {
            status: {
              $switch: {
                branches: [
                  {
                    case: { $eq: ['$total_visits', 0] },
                    then: 'idle',
                  },
                  {
                    case: {
                      $and: [
                        { $gte: ['$total_visits', 1] },
                        { $gte: ['$first_booking_date', ago14] },
                      ],
                    },
                    then: 'new',
                  },
                  {
                    case: {
                      $and: [
                        { $gte: ['$last_booking_date', ago14] },
                        { $lt: ['$first_booking_date', ago30] },
                      ],
                    },
                    then: 'active',
                  },
                  {
                    case: {
                      $and: [
                        { $gte: ['$last_booking_date', ago31] },
                        { $lt: ['$last_booking_date', ago14] },
                        { $gt: ['$total_visits', 1] },
                      ],
                    },
                    then: 'at_risk',
                  },
                ],
                default: 'lapsed',
              },
            },
          },
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ])
      .exec();

    const counts: PetStatusSnapshot = {
      idle: 0,
      new: 0,
      active: 0,
      at_risk: 0,
      lapsed: 0,
      total: 0,
    };
    for (const r of rows) {
      const key = r._id as PetStatus;
      if (key in counts) {
        counts[key] = r.count ?? 0;
        counts.total += r.count ?? 0;
      }
    }
    return counts;
  }
}

function pctDelta(current: number, previous: number): number | null {
  if (!previous) return current > 0 ? 100 : null;
  return round2(((current - previous) / previous) * 100);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
