/**
 * Pure helpers for booking flows. Kept free of Nest / Mongoose / entity
 * imports so they can be reused and unit-tested without bootstrapping the full
 * BookingService DI graph.
 */

// YYYY-MM-DD in the server's local timezone.
export function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Hotel detection — service type title (case-insensitive, trimmed) equals "hotel".
// Used to gate end_date requirement and per-night pricing.
export function isHotelServiceType(title?: string | null): boolean {
  return (title ?? '').trim().toLowerCase() === 'hotel';
}

// Grooming detection — service type title (case-insensitive, trimmed) equals "grooming".
// Daily store capacity is tracked only for grooming bookings; other service types
// (hotel, daycare, vet, transport, etc.) do not consume or validate capacity.
export function isGroomingServiceType(title?: string | null): boolean {
  return (title ?? '').trim().toLowerCase() === 'grooming';
}

// Number of nights between two dates (calendar-day diff, min 1).
// Both dates are normalized to UTC midnight to ignore time-of-day drift.
export function computeHotelNights(start: Date, end: Date): number {
  const s = new Date(start);
  const e = new Date(end);
  s.setUTCHours(0, 0, 0, 0);
  e.setUTCHours(0, 0, 0, 0);
  const ms = e.getTime() - s.getTime();
  const nights = Math.round(ms / (1000 * 60 * 60 * 24));
  return Math.max(1, nights);
}
