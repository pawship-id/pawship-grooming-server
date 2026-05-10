import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Counter, CounterDocument } from './counter.entity';

@Injectable()
export class CounterService {
  constructor(
    @InjectModel(Counter.name)
    private readonly counterModel: Model<CounterDocument>,
  ) {}

  async getNextSequence(name: string): Promise<number> {
    const result = await this.counterModel.findOneAndUpdate(
      { name },
      { $inc: { seq: 1 } },
      { upsert: true, new: true },
    );
    return result.seq;
  }
}
