import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

@Injectable()
export class BookingEventsService {
  readonly bookingMutated$ = new Subject<string>();

  emit(bookingId: string): void {
    this.bookingMutated$.next(bookingId);
  }
}
