export enum BookingStatus {
  REQUESTED = 'requested',
  CONFIRMED = 'confirmed',
  WAITLIST = 'waitlist',
  DRIVER_ON_THE_WAY = 'driver on the way',
  GROOMER_ON_THE_WAY = 'groomer on the way',
  ARRIVED = 'arrived',
  IN_PROGRESS = 'in progress',
  COMPLETED = 'completed',
  RETURNED = 'returned',
  RESCHEDULED = 'rescheduled',
  CANCELLED = 'cancelled',
}

export enum SessionStatus {
  NOT_STARTED = 'not started',
  IN_PROGRESS = 'in progress',
  FINISHED = 'finished',
}

export enum GroomingType {
  IN_HOME = 'in home',
  IN_STORE = 'in store',
}

export enum MediaType {
  BEFORE = 'before',
  AFTER = 'after',
  OTHER = 'other',
}
