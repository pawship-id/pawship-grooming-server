import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

@Injectable()
export class BookingEventsService {
  readonly bookingMutated$ = new Subject<string>();

  emit(bookingId: string): void {
    console.log(`[booking-events] emit bookingId=${bookingId} observers=${this.bookingMutated$.observers.length}`);
    this.bookingMutated$.next(bookingId);
  }
}
