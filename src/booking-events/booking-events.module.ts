import { Global, Module } from '@nestjs/common';
import { BookingEventsService } from './booking-events.service';

@Global()
@Module({
  providers: [BookingEventsService],
  exports: [BookingEventsService],
})
export class BookingEventsModule {}
