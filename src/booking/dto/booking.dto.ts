export enum BookingStatus {
  REQUESTED = 'requested',
  CONFIRMED = 'confirmed',
  ARRIVED = 'arrived',
  GROOMING_IN_PROGRESS = 'grooming in progress',
  GROOMING_FINISHED = 'grooming finished',
  RESCHEDULED = 'rescheduled',
  CANCELLED = 'cancelled',
}

export enum GroomingSessionStatus {
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
}
