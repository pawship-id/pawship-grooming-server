import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Store, StoreDocument } from 'src/store/entities/store.entity';
import {
  StoreDailyCapacity,
  StoreDailyCapacityDocument,
} from 'src/store-daily-capacity/entities/store-daily-capacity.entity';
import {
  StoreDailyUsage,
  StoreDailyUsageDocument,
} from 'src/booking/entities/store-daily-usage.entity';
import { toUtcStartOfDay } from '../utils/date-range';

export interface CapacityStoreItem {
  store_id: string;
  store_name: string;
  used_minutes: number;
  total_capacity_minutes: number;
  slots_remaining_minutes: number;
  utilisation_pct: number;
  is_closed: boolean;
}

export interface CapacityTrendPoint {
  date: string;
  utilisation_pct: number;
}

export interface CapacityResponse {
  message?: string;
  today: string;
  stores: CapacityStoreItem[];
  trend7d: CapacityTrendPoint[];
}

interface CapacityQueryArgs {
  storeId?: string;
}

const DEFAULT_CAPACITY_MINUTES = 960;

@Injectable()
export class CapacityService {
  constructor(
    @InjectModel(Store.name) private storeModel: Model<StoreDocument>,
    @InjectModel(StoreDailyCapacity.name)
    private capacityModel: Model<StoreDailyCapacityDocument>,
    @InjectModel(StoreDailyUsage.name)
    private usageModel: Model<StoreDailyUsageDocument>,
  ) {}

  async getCapacity(args: CapacityQueryArgs): Promise<CapacityResponse> {
    const today = toUtcStartOfDay(new Date());
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const storeFilter: Record<string, any> = { is_active: true };
    if (args.storeId && args.storeId !== 'all') {
      if (!Types.ObjectId.isValid(args.storeId)) {
        return { today: today.toISOString(), stores: [], trend7d: [] };
      }
      storeFilter._id = new Types.ObjectId(args.storeId);
    }

    const stores = await this.storeModel.find(storeFilter).lean<any[]>().exec();
    const storeIds = stores.map((s) => s._id);

    const [usages, overrides] = await Promise.all([
      this.usageModel
        .find({
          store_id: { $in: storeIds },
          date: { $gte: today, $lt: tomorrow },
        })
        .lean<any[]>()
        .exec(),
      this.capacityModel
        .find({
          store_id: { $in: storeIds },
          date: { $gte: today, $lt: tomorrow },
        })
        .lean<any[]>()
        .exec(),
    ]);

    const usageByStore = new Map<string, number>();
    for (const u of usages) usageByStore.set(String(u.store_id), u.used_minutes ?? 0);

    const overrideByStore = new Map<string, number>();
    for (const o of overrides)
      overrideByStore.set(String(o.store_id), o.total_capacity_minutes ?? 0);

    const storeItems: CapacityStoreItem[] = stores.map((store) => {
      const id = String(store._id);
      const override = overrideByStore.get(id);
      const total =
        override !== undefined
          ? override
          : (store.capacity?.default_daily_capacity_minutes ??
            DEFAULT_CAPACITY_MINUTES);
      const used = usageByStore.get(id) ?? 0;
      const remaining = Math.max(0, total - used);
      const utilisation = total > 0 ? round2((used / total) * 100) : 0;
      return {
        store_id: id,
        store_name: store.name,
        used_minutes: used,
        total_capacity_minutes: total,
        slots_remaining_minutes: remaining,
        utilisation_pct: utilisation,
        is_closed: total === 0,
      };
    });

    storeItems.sort((a, b) => b.utilisation_pct - a.utilisation_pct);

    const trend7d = await this.aggregateTrend7d(storeIds, stores, today);

    return {
      today: today.toISOString(),
      stores: storeItems,
      trend7d,
    };
  }

  private async aggregateTrend7d(
    storeIds: Types.ObjectId[],
    stores: any[],
    today: Date,
  ): Promise<CapacityTrendPoint[]> {
    if (storeIds.length === 0) return [];

    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - 6);
    const end = new Date(today);
    end.setUTCHours(23, 59, 59, 999);

    const [usages, overrides] = await Promise.all([
      this.usageModel
        .find({
          store_id: { $in: storeIds },
          date: { $gte: start, $lte: end },
        })
        .lean<any[]>()
        .exec(),
      this.capacityModel
        .find({
          store_id: { $in: storeIds },
          date: { $gte: start, $lte: end },
        })
        .lean<any[]>()
        .exec(),
    ]);

    const ymd = (d: Date) => d.toISOString().slice(0, 10);
    const defaultsByStore = new Map<string, number>();
    for (const s of stores) {
      defaultsByStore.set(
        String(s._id),
        s.capacity?.default_daily_capacity_minutes ?? DEFAULT_CAPACITY_MINUTES,
      );
    }

    const overrideByKey = new Map<string, number>();
    for (const o of overrides) {
      const key = `${String(o.store_id)}|${ymd(new Date(o.date))}`;
      overrideByKey.set(key, o.total_capacity_minutes ?? 0);
    }

    const result: CapacityTrendPoint[] = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      const key = ymd(d);

      let totalCapacity = 0;
      let totalUsed = 0;

      for (const storeId of storeIds.map((id) => String(id))) {
        const ovr = overrideByKey.get(`${storeId}|${key}`);
        const cap =
          ovr !== undefined
            ? ovr
            : (defaultsByStore.get(storeId) ?? DEFAULT_CAPACITY_MINUTES);
        totalCapacity += cap;
      }

      for (const u of usages) {
        if (ymd(new Date(u.date)) === key) totalUsed += u.used_minutes ?? 0;
      }

      result.push({
        date: key,
        utilisation_pct:
          totalCapacity > 0 ? round2((totalUsed / totalCapacity) * 100) : 0,
      });
    }
    return result;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
