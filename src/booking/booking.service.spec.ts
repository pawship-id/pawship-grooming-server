// Capacity-gating helpers live in booking.helpers.ts so they can be unit-tested
// in isolation (importing booking.service.ts pulls in mongoose entity decorators
// that don't load in this jest environment).
import {
  isGroomingServiceType,
  isHotelServiceType,
} from './booking.helpers';

describe('BookingService — service-type helpers', () => {
  describe('isGroomingServiceType', () => {
    it.each([
      ['grooming', true],
      ['Grooming', true],
      ['GROOMING', true],
      ['  grooming  ', true],
      ['hotel', false],
      ['daycare', false],
      ['vet', false],
      ['transport', false],
      ['grooming addons', false],
      ['', false],
    ])('returns %p for title %j', (title, expected) => {
      expect(isGroomingServiceType(title)).toBe(expected);
    });

    it('treats null/undefined as non-grooming', () => {
      expect(isGroomingServiceType(null)).toBe(false);
      expect(isGroomingServiceType(undefined)).toBe(false);
    });

    it('is mutually exclusive with isHotelServiceType', () => {
      expect(isGroomingServiceType('hotel')).toBe(false);
      expect(isHotelServiceType('grooming')).toBe(false);
    });
  });
});

/**
 * Behavioral tests for the capacity-gating rules introduced in BookingService.
 *
 * The booking flows (create / update / updateStatus) are large multi-collection
 * orchestrations that are not practical to construct end-to-end here, so these
 * tests narrow the focus to the *gating predicate*: whether StoreDailyUsage
 * should be touched for a given booking based on its service type.
 *
 * The predicate is derived from `isGroomingServiceType(service_type.title)` in
 * every flow that adjusts daily capacity. If this contract changes (e.g. new
 * service types start consuming capacity), the gating logic in
 * booking.service.ts must be updated to match.
 */
describe('BookingService — capacity gating predicate', () => {
  type ServiceSnapshotLike = {
    service_type?: { title?: string | null } | null;
  };

  // Mirror of the production gating expression. Co-locating it here means a
  // drift in the helper signature surfaces immediately in this spec.
  const tracksDailyCapacity = (snapshot: ServiceSnapshotLike | undefined) =>
    isGroomingServiceType(snapshot?.service_type?.title);

  it('tracks capacity for grooming bookings', () => {
    expect(
      tracksDailyCapacity({ service_type: { title: 'Grooming' } }),
    ).toBe(true);
  });

  it.each([
    ['Hotel'],
    ['Daycare'],
    ['Vet'],
    ['Transport'],
    ['Grooming Addons'],
  ])('does NOT track capacity for %s bookings', (typeTitle) => {
    expect(
      tracksDailyCapacity({ service_type: { title: typeTitle } }),
    ).toBe(false);
  });

  it('does NOT track capacity when the service_type snapshot is missing', () => {
    expect(tracksDailyCapacity(undefined)).toBe(false);
    expect(tracksDailyCapacity({})).toBe(false);
    expect(tracksDailyCapacity({ service_type: null })).toBe(false);
    expect(tracksDailyCapacity({ service_type: { title: null } })).toBe(false);
  });

  describe('reschedule/update transitions', () => {
    // On update + reschedule we decide independently whether to rollback the
    // *old* booking's usage and whether to validate/increment the *new*
    // service's usage. Each side is gated on its own service type.
    const sideEffects = (
      oldTitle: string | null | undefined,
      newTitle: string | null | undefined,
    ) => ({
      rollbackOld: isGroomingServiceType(oldTitle),
      incrementNew: isGroomingServiceType(newTitle),
    });

    it('grooming → grooming: rollback old + increment new', () => {
      expect(sideEffects('grooming', 'grooming')).toEqual({
        rollbackOld: true,
        incrementNew: true,
      });
    });

    it('grooming → hotel: rollback old, do NOT increment new', () => {
      expect(sideEffects('grooming', 'hotel')).toEqual({
        rollbackOld: true,
        incrementNew: false,
      });
    });

    it('hotel → grooming: do NOT rollback old, increment new', () => {
      expect(sideEffects('hotel', 'grooming')).toEqual({
        rollbackOld: false,
        incrementNew: true,
      });
    });

    it('hotel → hotel: no capacity side effects', () => {
      expect(sideEffects('hotel', 'hotel')).toEqual({
        rollbackOld: false,
        incrementNew: false,
      });
    });
  });
});
