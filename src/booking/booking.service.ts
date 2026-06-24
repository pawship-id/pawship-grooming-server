import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  BookingStatusLogDto,
  CreateBookingDto,
} from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { BookingPreviewRequestDto } from './dto/booking-preview.dto';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Booking, BookingDocument } from './entities/booking.entity';
import { Model, Types, Connection } from 'mongoose';
import { ObjectId } from 'mongodb';
import { PetService } from 'src/pet/pet.service';
import { ServiceService } from 'src/service/service.service';
import { PetMembershipService } from 'src/pet-membership/pet-membership.service';
import { BenefitUsageService } from 'src/benefit-usage/benefit-usage.service';
import { BookingStatus, GroomingType, SessionStatus } from './dto/booking.dto';
import { Store, StoreDocument } from 'src/store/entities/store.entity';
import { Service, ServiceDocument } from 'src/service/entities/service.entity';
import { toUtcStartOfDay } from 'src/dashboard/utils/date-range';
import { User, UserDocument } from 'src/user/entities/user.entity';
import {
  StoreDailyUsage,
  StoreDailyUsageDocument,
} from './entities/store-daily-usage.entity';
import {
  StoreDailyCapacity,
  StoreDailyCapacityDocument,
} from 'src/store-daily-capacity/entities/store-daily-capacity.entity';
import {
  Promotion,
  PromotionDocument,
} from 'src/promotion/entities/promotion.entity';
import {
  PromotionLimitType,
  PromotionUsagePeriod,
} from 'src/promotion/dto/create-promotion.dto';
import { PromotionUsageService } from 'src/promotion-usage/promotion-usage.service';
import { GoogleMapsDistanceService } from 'src/helpers/google-maps-distance.service';
import { ListBookingsDto } from './dto/list-bookings.dto';
import {
  ListGroomerMyJobsDto,
  ListGroomerOpenJobsDto,
} from './dto/list-groomer-bookings.dto';
import { GetDailyUsagesDto } from './dto/get-daily-usages.dto';
import { CounterService } from 'src/counter/counter.service';
import { OptionService } from 'src/option/option.service';
import { BookingEventsService } from 'src/booking-events/booking-events.service';

// Open Jobs status priority — arrived first, then in-progress, then confirmed.
// Lower = higher priority. Other statuses fall to default (99) and follow the
// secondary sort (booking date asc, createdAt desc).
const OPEN_JOBS_STATUS_PRIORITY: Record<string, number> = {
  [BookingStatus.ARRIVED]: 1,
  [BookingStatus.IN_PROGRESS]: 2,
  [BookingStatus.CONFIRMED]: 3,
};

import {
  computeHotelNights,
  isGroomingServiceType,
  isHotelServiceType,
  toYMD,
} from './booking.helpers';

// Re-exported so existing callers that imported these helpers from
// './booking.service' continue to work.
export {
  computeHotelNights,
  isGroomingServiceType,
  isHotelServiceType,
} from './booking.helpers';

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(Store.name)
    private readonly storeModel: Model<StoreDocument>,
    @InjectModel(Service.name)
    private readonly serviceModel: Model<ServiceDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(StoreDailyUsage.name)
    private readonly storeDailyUsageModel: Model<StoreDailyUsageDocument>,
    @InjectModel(StoreDailyCapacity.name)
    private readonly storeDailyCapacityModel: Model<StoreDailyCapacityDocument>,
    @InjectModel(Promotion.name)
    private readonly promotionModel: Model<PromotionDocument>,
    @InjectConnection()
    private readonly connection: Connection,
    private readonly petService: PetService,
    private readonly serviceService: ServiceService,
    private readonly petMembershipService: PetMembershipService,
    private readonly benefitUsageService: BenefitUsageService,
    private readonly promotionUsageService: PromotionUsageService,
    private readonly googleMapsDistanceService: GoogleMapsDistanceService,
    private readonly counterService: CounterService,
    private readonly optionService: OptionService,
    private readonly bookingEventsService: BookingEventsService,
  ) {}

  /**
   * Get booking preview with pricing calculation and benefit options
   */
  async getBookingPreview(dto: BookingPreviewRequestDto): Promise<any> {
    try {
      // 1. Validate and fetch pet
      const pet = await this.petService.getPetSnapshot(
        new ObjectId(dto.pet_id),
      );

      if (!pet) {
        throw new NotFoundException('Pet not found');
      }

      // 2. Fetch service pricing
      const service = await this.serviceService.getServiceForBooking(
        new ObjectId(dto.service_id),
        pet.size?._id ? new ObjectId(pet.size._id) : undefined,
        pet.pet_type?._id ? new ObjectId(pet.pet_type._id) : undefined,
        pet.hair?._id ? new ObjectId(pet.hair._id) : undefined,
      );

      if (!service) {
        throw new NotFoundException('Service not found');
      }

      // Hotel pricing: when the service type is "hotel", the service price is
      // per-night. Multiply by the night count derived from start/end dates.
      const serviceTypeTitle = (service as any).service_type?.title as
        | string
        | undefined;
      const isHotel = isHotelServiceType(serviceTypeTitle);
      const startDate = dto.date ? new Date(dto.date) : new Date();
      let effectiveEndDate = dto.end_date ? new Date(dto.end_date) : startDate;
      if (isHotel) {
        if (!dto.end_date) {
          throw new BadRequestException(
            'end_date is required for hotel service',
          );
        }
        effectiveEndDate = new Date(dto.end_date);
        const startOnly = new Date(startDate);
        startOnly.setUTCHours(0, 0, 0, 0);
        const endOnly = new Date(effectiveEndDate);
        endOnly.setUTCHours(0, 0, 0, 0);
        if (endOnly.getTime() < startOnly.getTime()) {
          throw new BadRequestException(
            'end_date must be greater than or equal to start_date',
          );
        }
      } else {
        // Non-hotel services always check-in/out the same day.
        effectiveEndDate = new Date(startDate);
      }
      const hotelNights = isHotel
        ? computeHotelNights(startDate, effectiveEndDate)
        : 1;

      const basePricePerUnit = service.price || 0;
      let originalPrice = isHotel
        ? basePricePerUnit * hotelNights
        : basePricePerUnit;
      const addonPrices: any[] = [];
      let addonsTotal = 0;

      // 3. Fetch addon pricing (if provided)
      if (dto.addon_ids && dto.addon_ids.length > 0) {
        const addons = await Promise.all(
          dto.addon_ids.map((addonId) =>
            this.serviceService.getServiceForBooking(
              new ObjectId(addonId),
              pet.size?._id ? new ObjectId(pet.size._id) : undefined,
              pet.pet_type?._id ? new ObjectId(pet.pet_type._id) : undefined,
              pet.hair?._id ? new ObjectId(pet.hair._id) : undefined,
            ),
          ),
        );

        for (const addon of addons) {
          if (addon) {
            const addonPrice = addon.price || 0;
            addonsTotal += addonPrice;
            const addonId = (addon as any)._id
              ? (addon as any)._id.toString()
              : (addon as any).id || '';
            addonPrices.push({
              _id: addonId,
              name: addon.name,
              price: addonPrice,
            });
          }
        }
      }

      const subtotalBeforeBenefits = originalPrice + addonsTotal;

      // 4. Determine service type and calculate travel/pickup/delivery fees
      // Use user's selected location type if provided, otherwise validate against service's available types
      const serviceLocationType = service.service_location_type || [];
      const isInHome = serviceLocationType.includes('in home');
      const isInStore = serviceLocationType.includes('in store');
      const userSelectedType = dto.service_location_type; // User's choice: "in home" or "in store"

      // Validate that user's selection is supported by the service
      if (userSelectedType && !serviceLocationType.includes(userSelectedType)) {
        throw new BadRequestException(
          `Service does not support ${userSelectedType} service`,
        );
      }

      // Determine which fees to calculate based on user's choice
      const shouldCalculateInHomeFee =
        userSelectedType === 'in home' ||
        (!userSelectedType &&
          serviceLocationType.includes('in home') &&
          !serviceLocationType.includes('in store'));

      const shouldCalculatePickupDeliveryFee =
        userSelectedType === 'in store' ||
        (!userSelectedType && serviceLocationType.includes('in store'));

      let pickupFee = 0;
      let deliveryFee = 0;
      let travelFee = 0;
      let zoneInfo: any = null;

      // For IN_HOME services: calculate home service fee
      if (shouldCalculateInHomeFee) {
        if (!dto.store_id) {
          throw new BadRequestException(
            'store_id is required for in-home service',
          );
        }
        if (!dto.customer_id) {
          throw new BadRequestException(
            'customer_id is required for in-home service',
          );
        }

        const store = await this.storeModel.findOne({
          _id: new ObjectId(dto.store_id),
          isDeleted: false,
        });
        if (!store) {
          throw new NotFoundException('Store not found');
        }

        const customer = await this.userModel
          .findById(new ObjectId(dto.customer_id))
          .select('profile.addresses')
          .lean();
        if (!customer) {
          throw new NotFoundException('Customer not found');
        }

        const addresses = (customer as any).profile?.addresses || [];
        let mainAddress = addresses.find((a: any) => a.is_main_address);
        if (!mainAddress && addresses.length > 0) {
          mainAddress = addresses[0];
        }
        if (
          !mainAddress ||
          mainAddress.latitude == null ||
          mainAddress.longitude == null
        ) {
          throw new BadRequestException(
            'Customer must have a location (latitude/longitude) for in-home service',
          );
        }

        const result = await this.calculateHomeServiceFee(
          store,
          { latitude: mainAddress.latitude, longitude: mainAddress.longitude },
          pet,
        );

        travelFee = result.fee;
        zoneInfo = {
          ...result.zone_snapshot,
          distance_km: this.calculateDistance(
            mainAddress.latitude,
            mainAddress.longitude,
            store.location!.latitude!,
            store.location!.longitude!,
          ),
        };
      }
      // For IN_STORE services: optionally calculate pickup/delivery fees
      else if (shouldCalculatePickupDeliveryFee) {
        const needsPickupOrDelivery =
          dto.pick_up === true || dto.delivery === true;

        if (needsPickupOrDelivery) {
          if (!dto.store_id) {
            throw new BadRequestException(
              'store_id is required when pickup or delivery is requested',
            );
          }
          if (!dto.customer_id) {
            throw new BadRequestException(
              'customer_id is required when pickup or delivery is requested',
            );
          }

          const store = await this.storeModel.findOne({
            _id: new ObjectId(dto.store_id),
            isDeleted: false,
          });
          if (!store) {
            throw new NotFoundException('Store not found');
          }

          const customer = await this.userModel
            .findById(new ObjectId(dto.customer_id))
            .select('profile.addresses')
            .lean();
          if (!customer) {
            throw new NotFoundException('Customer not found');
          }

          const addresses = (customer as any).profile?.addresses || [];
          let mainAddress = addresses.find((a: any) => a.is_main_address);
          if (!mainAddress && addresses.length > 0) {
            mainAddress = addresses[0];
          }
          if (
            !mainAddress ||
            mainAddress.latitude == null ||
            mainAddress.longitude == null
          ) {
            throw new BadRequestException(
              'Customer must have a location (latitude/longitude) for pickup/delivery service',
            );
          }

          const result = await this.calculatePickupDeliveryFees(
            store,
            {
              latitude: mainAddress.latitude,
              longitude: mainAddress.longitude,
            },
            dto.pick_up === true,
            dto.delivery === true,
          );

          pickupFee = result.pickup_fee;
          deliveryFee = result.delivery_fee;
          travelFee = result.total; // backward compatibility

          if (result.zone_snapshot) {
            zoneInfo = {
              ...result.zone_snapshot,
              distance_km: this.calculateDistance(
                mainAddress.latitude,
                mainAddress.longitude,
                store.location!.latitude!,
                store.location!.longitude!,
              ),
            };
          }
        }
        // No pickup or delivery requested - fees remain 0
      }

      // 5. Get available benefits filtered by context:
      //    - applies_to 'service' → only benefit whose service_id matches dto.service_id
      //    - applies_to 'addon'   → only benefit whose service_id is in dto.addon_ids (skipped when no addons)
      //    - applies_to 'pickup'  → only when pick_up is true or travel_fee > 0
      const membershipData =
        await this.petMembershipService.getAvailableBenefits(
          dto.pet_id,
          dto.date ? new Date(dto.date) : undefined,
          dto.exclude_booking_id,
        );

      const hasActiveMembership = membershipData.has_active_membership;

      const addonIdSet = new Set(
        (dto.addon_ids || []).map((id) => id.toString()),
      );
      const hasAddons = !!(dto.addon_ids && dto.addon_ids.length > 0);

      const availableBenefits = hasActiveMembership
        ? (membershipData.benefits || [])
            .filter((b: any) => {
              const bServiceId = b.service_id?.toString();
              if (b.applies_to === 'service') {
                // null service_id = applies to any service
                return !bServiceId || bServiceId === dto.service_id.toString();
              }
              if (b.applies_to === 'addon') {
                // null service_id = applies to all selected addons
                return hasAddons && (!bServiceId || addonIdSet.has(bServiceId));
              }
              if (b.applies_to === 'pickup') {
                return (
                  travelFee > 0 || dto.pick_up === true || dto.delivery === true
                );
              }
              return false;
            })
            .map((b: any) => {
              // Determine price base for this benefit type
              let discountBase = 0;
              if (b.applies_to === 'service') {
                discountBase = originalPrice;
              } else if (b.applies_to === 'addon') {
                if (b.service_id) {
                  const matchingAddon = addonPrices.find(
                    (a) => a._id.toString() === b.service_id.toString(),
                  );
                  discountBase = matchingAddon?.price ?? 0;
                } else {
                  // no specific addon: benefit discounts all selected addons
                  discountBase = addonsTotal;
                }
              } else if (b.applies_to === 'pickup') {
                discountBase = travelFee;
              }

              const amountDiscount = b.can_apply
                ? b.type === 'discount'
                  ? this.computeDiscountAmount(b, discountBase, pet)
                  : discountBase
                : 0;

              return {
                _id: b._id,
                applies_to: b.applies_to,
                service_id: b.service_id,
                label: b.label,
                service: b.service,
                type: b.type,
                period: b.period,
                limit: b.limit,
                value: b.value,
                discount_type: b.discount_type,
                variant_mode: b.variant_mode,
                effective_value:
                  b.type === 'discount'
                    ? this.getEffectiveValue(b, pet)
                    : null,
                used: b.used,
                remaining: b.remaining,
                can_apply: b.can_apply,
                period_reset_date: b.period_reset_date,
                next_reset_date: b.next_reset_date,
                amount_discount: amountDiscount,
                description: this.getBenefitDescription(b, amountDiscount),
              };
            })
        : [];

      // 6. Calculate estimated maximum discount and final price
      let estimatedTotalDiscount = 0;
      availableBenefits.forEach((benefit: any) => {
        if (benefit.can_apply && benefit.type === 'discount') {
          estimatedTotalDiscount += benefit.amount_discount;
        }
      });

      const grandTotal = subtotalBeforeBenefits + travelFee;
      const estimatedFinalPrice = Math.max(
        0,
        grandTotal - estimatedTotalDiscount,
      );

      // 6b. Get available promotions
      const availablePromotions = await this.getAvailablePromotions({
        serviceId: dto.service_id,
        addonIds: dto.addon_ids,
        pickUp: dto.pick_up,
        delivery: dto.delivery,
        hasActiveMembership,
        originalServicePrice: originalPrice,
        addonPrices,
        travelFee,
        grandTotal,
        customerId: dto.customer_id,
        petId: dto.pet_id,
        bookingDate: dto.date ? new Date(dto.date) : new Date(),
        excludeBookingId: dto.exclude_booking_id,
      });

      // 7. Build response
      const response: any = {
        pet_id: dto.pet_id,
        pet_name: pet.name,
        service_id: dto.service_id,
        service_name: service.name,
        service_type: isInHome ? 'in home' : isInStore ? 'in store' : 'unknown',
        is_hotel: isHotel,
        hotel_nights: hotelNights,
        start_date: startDate,
        end_date: effectiveEndDate,
        pricing: {
          original_service_price: originalPrice,
          base_service_price: basePricePerUnit,
          hotel_nights: hotelNights,
          addon_prices: addonPrices,
          subtotal_before_benefits: subtotalBeforeBenefits,
          pickup_fee: pickupFee,
          delivery_fee: deliveryFee,
          travel_fee: travelFee, // backward compatibility (sum of pickup + delivery or home service fee)
          has_active_membership: hasActiveMembership,
          available_benefits: availableBenefits,
          available_promotions: availablePromotions,
          estimated_total_discount: estimatedTotalDiscount,
          estimated_final_price: estimatedFinalPrice,
        },
        pricing_breakdown: {
          service: {
            name: service.name,
            price: originalPrice,
            base_price: basePricePerUnit,
            nights: hotelNights,
          },
          addons: addonPrices,
          subtotal: subtotalBeforeBenefits,
          pickup_fee: pickupFee,
          delivery_fee: deliveryFee,
          travel_fee: travelFee, // backward compatibility
          grand_total: grandTotal,
          discount: estimatedTotalDiscount,
          final: estimatedFinalPrice,
        },
      };

      if (zoneInfo !== null) {
        response.zone = zoneInfo;
      }

      return response;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate human-readable benefit description
   */
  private getBenefitDescription(benefit: any, amountDiscount?: number): string {
    const typeLabel =
      {
        discount: 'Discount',
        quota: 'Free Sessions',
      }[benefit.type] || 'Benefit';

    let valueStr: string;
    if (benefit.type === 'discount') {
      if (benefit.variant_mode === 'per_variant') {
        valueStr =
          amountDiscount != null && amountDiscount > 0
            ? `Rp${Math.round(amountDiscount).toLocaleString('id-ID')} (per varian)`
            : 'Per-variant discount';
      } else if (benefit.discount_type === 'fixed') {
        valueStr = `Rp${(benefit.value ?? 0).toLocaleString('id-ID')}`;
      } else {
        valueStr = benefit.value != null ? `${benefit.value}%` : 'Diskon';
      }
    } else {
      valueStr = `${benefit.service?.name ?? benefit.label ?? 'Free'}`;
    }

    const periodLabel =
      {
        weekly: 'Weekly',
        monthly: 'Monthly',
        unlimited: 'Unlimited',
      }[benefit.period] || benefit.period;

    const remainingStr =
      benefit.remaining === null ? '∞' : `${benefit.remaining}`;
    const limitStr = benefit.limit === null ? '∞' : `${benefit.limit}`;

    return `${typeLabel}: ${valueStr} (${periodLabel}) - ${remainingStr}/${limitStr} remaining`;
  }

  private getEffectiveValue(benefit: any, pet: any): number | null {
    const variantMode: string = benefit.variant_mode ?? 'all';
    if (variantMode === 'per_variant' && benefit.variant_discounts?.length) {
      const match = benefit.variant_discounts.find(
        (vd: any) =>
          (!vd.pet_type_id ||
            vd.pet_type_id.toString() === pet.pet_type?._id?.toString()) &&
          (!vd.size_id ||
            vd.size_id.toString() === pet.size?._id?.toString()) &&
          (!vd.hair_id ||
            vd.hair_id.toString() === pet.hair?._id?.toString()),
      );
      return match?.value ?? null;
    }
    return benefit.value ?? null;
  }

  private computeDiscountAmount(
    benefit: any,
    basePrice: number,
    pet: any,
  ): number {
    const discountType: string = benefit.discount_type ?? 'percentage';
    const variantMode: string = benefit.variant_mode ?? 'all';

    let effectiveValue: number = benefit.value ?? 0;

    if (variantMode === 'per_variant' && benefit.variant_discounts?.length) {
      const match = benefit.variant_discounts.find(
        (vd: any) =>
          (!vd.pet_type_id ||
            vd.pet_type_id.toString() ===
              pet.pet_type?._id?.toString()) &&
          (!vd.size_id ||
            vd.size_id.toString() === pet.size?._id?.toString()) &&
          (!vd.hair_id ||
            vd.hair_id.toString() === pet.hair?._id?.toString()),
      );
      effectiveValue = match?.value ?? 0;
    }

    if (discountType === 'fixed') {
      return Math.min(effectiveValue, basePrice);
    }
    // percentage (default / legacy path)
    return (effectiveValue / 100) * basePrice;
  }

  /**
   * Haversine formula to calculate distance between two lat/long points in km
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calculate and apply selected benefits to booking
   */
  private async applyBenefitsToBooking(
    petId: string,
    selectedBenefitIds: string[],
    storeId?: string,
    serviceId?: string,
    addOnIds?: string[],
    originalTotalPrice?: number, // BUG2: when provided, final_price = originalTotalPrice - totalDiscount
    bookingDate?: Date,
    pickUp?: boolean,
    delivery?: boolean,
    excludeBookingId?: string,
  ): Promise<{
    applied_benefits: any[];
    total_discount: number;
    final_price: number;
    breakdown: Array<{
      benefit: {
        _id: string;
        label: string | null;
        service: { name: string } | null;
      };
      applies_to: string;
      benefit_type: string;
      benefit_period: string;
      benefit_value: number | null;
      base_price: number;
      amount_deducted: number;
      description: string | null;
      applied_at: Date;
    }>;
  }> {
    const emptyResult = (fallbackTotal = 0) => ({
      applied_benefits: [],
      total_discount: 0,
      final_price: fallbackTotal,
      breakdown: [],
    });

    if (!selectedBenefitIds || selectedBenefitIds.length === 0) {
      return emptyResult(originalTotalPrice ?? 0);
    }

    // 1. Get pet attributes for price lookup
    const pet = await this.petService.getPetSnapshot(new ObjectId(petId));

    // 2. Lazy-load full pet doc (customer_id needed only for pickup benefit)
    let petDoc: any = null;
    const getPetDoc = async () => {
      if (!petDoc) petDoc = await this.petService.findOne(new ObjectId(petId));
      return petDoc;
    };

    // 3. Get active membership benefits
    const membershipData = await this.petMembershipService.getAvailableBenefits(
      petId,
      bookingDate,
      excludeBookingId,
    );
    if (!membershipData.has_active_membership) {
      this.logger.warn(
        `[applyBenefits] No active membership for pet=${petId}, excludeBooking=${excludeBookingId}`,
      );
      return emptyResult(originalTotalPrice ?? 0);
    }

    // Log available benefits for debugging
    this.logger.log(
      `[applyBenefits] pet=${petId}, selectedIds=[${selectedBenefitIds}], ` +
        `bookingDate=${bookingDate}, excludeBooking=${excludeBookingId}, ` +
        `availableBenefits=${JSON.stringify(
          membershipData.benefits.map((b: any) => ({
            _id: b._id,
            type: b.type,
            applies_to: b.applies_to,
            can_apply: b.can_apply,
            remaining: b.remaining,
            used: b.used,
            limit: b.limit,
          })),
        )}`,
    );

    const appliedBenefits: any[] = [];
    let totalDiscount = 0;
    const breakdown: Array<any> = [];

    // Pre-scan: collect which service/addon IDs are fully covered by a quota benefit.
    // A discount on an already-free item has no effect and should be skipped.
    const quotaCoveredServiceIds = new Set<string>();
    const quotaCoveredAddonIds = new Set<string>();
    for (const bId of selectedBenefitIds) {
      const b = membershipData.benefits.find((x: any) => x._id === bId);
      if (!b || !b.can_apply || b.type !== 'quota') continue;
      if (b.applies_to === 'service') {
        const resolvedId = b.service_id || serviceId;
        if (resolvedId) quotaCoveredServiceIds.add(resolvedId.toString());
      } else if (b.applies_to === 'addon') {
        const covered: string[] = b.service_id
          ? [b.service_id.toString()]
          : (addOnIds || []).map((id) => id.toString());
        covered.forEach((id) => quotaCoveredAddonIds.add(id));
      }
    }

    for (const benefitId of selectedBenefitIds) {
      const benefit = membershipData.benefits.find(
        (b: any) => b._id === benefitId,
      );
      if (!benefit) {
        this.logger.warn(
          `[applyBenefits] benefit ${benefitId} NOT FOUND in available benefits`,
        );
        continue;
      }
      if (!benefit.can_apply) {
        this.logger.warn(
          `[applyBenefits] benefit ${benefitId} can_apply=false (used=${benefit.used}, limit=${benefit.limit}, remaining=${benefit.remaining})`,
        );
        continue;
      }
      const appliesTo: string = benefit.applies_to;
      let basePrice = 0;

      // ── Skip discount if target is already free via an applied quota ──────
      if (benefit.type === 'discount') {
        if (appliesTo === 'service') {
          const resolvedId = (benefit.service_id || serviceId)?.toString();
          if (resolvedId && quotaCoveredServiceIds.has(resolvedId)) continue;
        } else if (appliesTo === 'addon') {
          if (benefit.service_id) {
            if (quotaCoveredAddonIds.has(benefit.service_id.toString()))
              continue;
          } else {
            // null service_id → applies to all selected addons; skip if all are covered
            const allCovered =
              (addOnIds || []).length > 0 &&
              (addOnIds || []).every((id) =>
                quotaCoveredAddonIds.has(id.toString()),
              );
            if (allCovered) continue;
          }
        }
      }

      // ── Resolve base price per scope ─────────────────────────────────────
      if (appliesTo === 'service') {
        let service_id = benefit.service_id || serviceId;
        if (!service_id) continue;

        try {
          // BUG8 fix: use resolved service_id, not raw serviceId param
          const resolvedServiceId = benefit.service_id || serviceId;
          const svc = await this.serviceService.getServiceForBooking(
            new ObjectId(resolvedServiceId),
            pet.size?._id ? new ObjectId(pet.size._id) : undefined,
            pet.pet_type?._id ? new ObjectId(pet.pet_type._id) : undefined,
            pet.hair?._id ? new ObjectId(pet.hair._id) : undefined,
          );
          basePrice = svc.price;
        } catch (err) {
          this.logger.warn(
            `[applyBenefits] SERVICE price lookup failed for benefit ${benefitId}, serviceId=${benefit.service_id || serviceId}: ${err}`,
          );
          continue; // skip benefit if service price lookup fails
        }
      } else if (appliesTo === 'addon') {
        let add_ons = benefit.service_id ? [benefit.service_id] : addOnIds;

        if (!add_ons || add_ons.length === 0) continue;
        for (const addonId of add_ons) {
          // Skip individual addon if already fully free via a quota benefit
          if (
            benefit.type === 'discount' &&
            quotaCoveredAddonIds.has(addonId.toString())
          )
            continue;
          let addonBasePrice = 0;
          try {
            const addon = await this.serviceService.getServiceForBooking(
              new ObjectId(addonId),
              pet.size._id ? new ObjectId(pet.size._id) : undefined,
              pet.pet_type._id ? new ObjectId(pet.pet_type._id) : undefined,
              pet.hair._id ? new ObjectId(pet.hair._id) : undefined,
            );
            addonBasePrice = addon.price;
          } catch (err) {
            this.logger.warn(
              `[applyBenefits] ADDON price lookup failed for benefit ${benefitId}, addonId=${addonId}: ${err}`,
            );
            continue; // skip this addon if price lookup fails
          }
          let addonDiscount = 0;
          if (benefit.type === 'discount') {
            addonDiscount = this.computeDiscountAmount(benefit, addonBasePrice, pet);
          } else if (benefit.type === 'quota') {
            addonDiscount = addonBasePrice;
          }
          addonDiscount = Math.max(0, addonDiscount);
          breakdown.push({
            benefit: {
              _id: benefit._id,
              label: benefit.label ?? null,
              service: benefit.service ? { name: benefit.service.name } : null,
            },
            applies_to: appliesTo,
            benefit_type: benefit.type,
            benefit_period: benefit.period,
            benefit_value: benefit.value ?? null,
            base_price: addonBasePrice,
            amount_deducted: addonDiscount,
            description: benefit.description ?? null,
            pet_membership_id: benefit.pet_membership_id ?? null,
            service_id: new Types.ObjectId(addonId),
            applied_at: new Date(),
          });
          if (addonDiscount > 0) {
            totalDiscount += addonDiscount;
            appliedBenefits.push({
              pet_membership_id: benefit.pet_membership_id, // needed for deductBenefitUsage
              benefit_id: new Types.ObjectId(benefitId),
              benefit_type: benefit.type,
              benefit_period: benefit.period,
              benefit_value: benefit.value,
              amount_deducted: addonDiscount,
              applied_at: new Date(),
            });
          }
        }
        continue; // addon entries already pushed inside the loop above
      } else if (appliesTo === 'pickup') {
        if (!storeId) {
          continue; // skip pickup benefit if store_id is not provided
        }
        // Skip if neither pickup nor delivery is selected
        if (!pickUp && !delivery) {
          // Check if this might be an in-home service with travel fee
          // In this case, we should still calculate the fee
          // We'll detect this by checking if the store has home_service_zones
        }

        try {
          const doc = await getPetDoc();
          const customerId = (doc as any)?.customer_id;
          if (!customerId) {
            throw new BadRequestException('customer_id is required');
          }

          const customer = await this.userModel.findById(customerId);
          const addresses = (customer as any)?.profile?.addresses ?? [];
          let mainAddress = addresses.find((a: any) => a.is_main_address);
          if (!mainAddress && addresses.length > 0) mainAddress = addresses[0];
          if (!mainAddress?.latitude || !mainAddress?.longitude) continue;

          const store = await this.storeModel.findById(new ObjectId(storeId));
          if (!store) {
            throw new NotFoundException('store is not found');
          }

          // Determine if this is in-home service or pickup/delivery service
          // If pickup or delivery is true, use pickup/delivery zones
          // Otherwise, try home service zones (for in-home service)
          if (pickUp === true || delivery === true) {
            // Use the new calculatePickupDeliveryFees method for in-store with pickup/delivery
            const result = await this.calculatePickupDeliveryFees(
              store,
              {
                latitude: mainAddress.latitude,
                longitude: mainAddress.longitude,
              },
              pickUp === true,
              delivery === true,
            );

            // basePrice is the total travel fee (pickup + delivery)
            basePrice = result.total;
          } else {
            // This is likely an in-home service, use home service zones
            const result = await this.calculateHomeServiceFee(
              store,
              {
                latitude: mainAddress.latitude,
                longitude: mainAddress.longitude,
              },
              pet,
            );

            basePrice = result.fee;
          }
        } catch (err) {
          this.logger.warn(
            `[applyBenefits] PICKUP/DELIVERY fee calculation failed for benefit ${benefitId}: ${err}`,
          );
          continue; // skip benefit if fee calculation fails
        }
      }

      // ── Apply discount or quota ───────────────────────────────────────────
      let discountAmount = 0;
      if (benefit.type === 'discount') {
        discountAmount = this.computeDiscountAmount(benefit, basePrice, pet);
      } else if (benefit.type === 'quota') {
        discountAmount = basePrice; // fully free
      }
      discountAmount = Math.max(0, discountAmount);

      // Resolve the actual service_id used in this breakdown entry
      const resolvedBreakdownServiceId =
        appliesTo === 'service'
          ? benefit.service_id || serviceId
          : benefit.service_id;

      breakdown.push({
        benefit: {
          _id: benefit._id,
          label: benefit.label ?? null,
          service: benefit.service ? { name: benefit.service.name } : null,
        },
        applies_to: appliesTo,
        benefit_type: benefit.type,
        benefit_period: benefit.period,
        benefit_value: benefit.value ?? null,
        base_price: basePrice,
        amount_deducted: discountAmount,
        description: benefit.description ?? null,
        pet_membership_id: benefit.pet_membership_id ?? null,
        service_id: resolvedBreakdownServiceId
          ? new Types.ObjectId(resolvedBreakdownServiceId)
          : null,
        applied_at: new Date(),
      });

      if (discountAmount > 0) {
        totalDiscount += discountAmount;
        appliedBenefits.push({
          pet_membership_id: benefit.pet_membership_id, // needed for deductBenefitUsage
          benefit_id: new Types.ObjectId(benefitId),
          benefit_type: benefit.type,
          benefit_period: benefit.period,
          benefit_value: benefit.value,
          amount_deducted: discountAmount,
          applied_at: new Date(),
        });
      }
    }

    // BUG2 fix: if originalTotalPrice provided, final_price = total - discount
    // (breakdown only contains discounted items, non-discounted items would be missing)
    const finalPrice =
      originalTotalPrice != null
        ? Math.max(0, originalTotalPrice - totalDiscount)
        : breakdown.reduce(
            (sum, item) =>
              sum + Math.max(0, item.base_price - item.amount_deducted),
            0,
          );

    this.logger.log(
      `[applyBenefits] RESULT: applied=${appliedBenefits.length}, totalDiscount=${totalDiscount}, ` +
        `finalPrice=${finalPrice}, originalTotal=${originalTotalPrice}, breakdownItems=${breakdown.length}`,
    );

    return {
      applied_benefits: appliedBenefits,
      total_discount: totalDiscount,
      final_price: finalPrice,
      breakdown,
    };
  }

  /**
   * Get available promotions for a booking context.
   * Filters by active, not deleted, within date range, applies_to match.
   */
  private async getAvailablePromotions(opts: {
    serviceId: string;
    addonIds?: string[];
    pickUp?: boolean;
    delivery?: boolean;
    hasActiveMembership: boolean;
    originalServicePrice: number;
    addonPrices: { _id: string; name: string; price: number }[];
    travelFee: number;
    grandTotal: number;
    customerId?: string;
    petId?: string;
    bookingDate?: Date;
    excludeBookingId?: string;
  }) {
    const now = new Date();

    const promotions = await this.promotionModel
      .find({
        is_active: true,
        isDeleted: false,
        start_date: { $lte: now },
        $or: [{ end_date: null }, { end_date: { $gte: now } }],
      })
      .populate('service_id', 'name code')
      .lean();

    const addonIdSet = new Set(
      (opts.addonIds || []).map((id) => id.toString()),
    );
    const hasAddons = addonIdSet.size > 0;
    const addonsTotal = opts.addonPrices.reduce((s, a) => s + a.price, 0);

    const filteredPromotions = promotions.filter((promo: any) => {
      // Filter by membership availability
      if (opts.hasActiveMembership && !promo.is_available_to_membership) {
        return false;
      }

      const promoServiceId =
        promo.service_id?._id?.toString() ??
        promo.service_id?.toString() ??
        null;

      if (promo.applies_to === 'service') {
        return !promoServiceId || promoServiceId === opts.serviceId;
      }
      if (promo.applies_to === 'addon') {
        return hasAddons && (!promoServiceId || addonIdSet.has(promoServiceId));
      }
      if (promo.applies_to === 'pickup') {
        return (
          opts.travelFee > 0 || opts.pickUp === true || opts.delivery === true
        );
      }
      if (promo.applies_to === 'booking') {
        return true;
      }
      return false;
    });

    const mappedPromotions = filteredPromotions.map(async (promo: any) => {
      let discountBase = 0;
      const promoServiceId =
        promo.service_id?._id?.toString() ??
        promo.service_id?.toString() ??
        null;

      if (promo.applies_to === 'service') {
        discountBase = opts.originalServicePrice;
      } else if (promo.applies_to === 'addon') {
        if (promoServiceId) {
          const matchingAddon = opts.addonPrices.find(
            (a) => a._id.toString() === promoServiceId,
          );
          discountBase = matchingAddon?.price ?? 0;
        } else {
          discountBase = addonsTotal;
        }
      } else if (promo.applies_to === 'pickup') {
        discountBase = opts.travelFee;
      } else if (promo.applies_to === 'booking') {
        discountBase = opts.grandTotal;
      }

      const amountDiscount =
        promo.discount_type === 'percent'
          ? (promo.value / 100) * discountBase
          : Math.min(promo.value, discountBase);

      const serviceName =
        typeof promo.service_id === 'object' && promo.service_id?.name
          ? promo.service_id.name
          : null;

      const limitType = promo.limit_type ?? PromotionLimitType.NONE;
      const maxUsage = promo.max_usage ?? null;
      const usagePeriod = promo.usage_period ?? PromotionUsagePeriod.LIFETIME;

      // Check if promotion can be used (limit enforcement)
      let canUse = true;
      let usageCount = 0;
      let limitMessage: string | null = null;

      if (
        limitType !== PromotionLimitType.NONE &&
        maxUsage !== null &&
        maxUsage > 0
      ) {
        try {
          await this.promotionUsageService.assertCanUse({
            promotionId: promo._id.toString(),
            maxUsage,
            limitType,
            usagePeriod,
            bookingDate: opts.bookingDate ?? new Date(),
            userId: opts.customerId,
            petId: opts.petId,
            excludeBookingId: opts.excludeBookingId,
          });
          // If assertCanUse doesn't throw, promotion can be used
          canUse = true;

          // Get current usage count for display
          const count = await this.promotionUsageService.countUsage({
            promotionId: promo._id.toString(),
            limitType,
            usagePeriod,
            bookingDate: opts.bookingDate ?? new Date(),
            userId: opts.customerId,
            petId: opts.petId,
          });
          usageCount = count;
        } catch (err) {
          canUse = false;
          limitMessage = err instanceof Error ? err.message : 'Limit tercapai';
        }
      }

      return {
        _id: promo._id.toString(),
        code: promo.code,
        name: promo.name,
        description: promo.description || null,
        applies_to: promo.applies_to,
        service_id: promoServiceId,
        service_name: serviceName,
        discount_type: promo.discount_type,
        value: promo.value,
        is_stackable: promo.is_stackable,
        is_available_to_membership: promo.is_available_to_membership,
        amount_discount: amountDiscount,
        limit_type: limitType,
        max_usage: maxUsage,
        usage_period: usagePeriod,
        can_use: canUse,
        usage_count: usageCount,
        limit_message: limitMessage,
      };
    });

    return Promise.all(mappedPromotions);
  }

  /**
   * Apply selected promotions and return breakdown.
   * Validates stacking rules.
   */
  private async applyPromotionsToBooking(
    selectedPromotionIds: string[],
    opts: {
      serviceId: string;
      addonIds?: string[];
      pickUp?: boolean;
      delivery?: boolean;
      hasActiveMembership: boolean;
      originalServicePrice: number;
      addonPrices: { _id: string; name: string; price: number }[];
      travelFee: number;
      grandTotal: number;
      customerId?: string;
      petId?: string;
      bookingDate?: Date;
      excludeBookingId?: string;
    },
  ): Promise<{
    applied_promotions: any[];
    total_discount: number;
    breakdown: any[];
  }> {
    const emptyResult = {
      applied_promotions: [],
      total_discount: 0,
      breakdown: [],
    };

    if (!selectedPromotionIds || selectedPromotionIds.length === 0) {
      return emptyResult;
    }

    const promotions = await this.promotionModel
      .find({
        _id: { $in: selectedPromotionIds.map((id) => new Types.ObjectId(id)) },
        is_active: true,
        isDeleted: false,
      })
      .populate('service_id', 'name code')
      .lean();

    if (promotions.length === 0) {
      return emptyResult;
    }

    this.logger.log(
      `[applyPromotionsToBooking] Fetched ${promotions.length} promotions from DB`,
    );
    promotions.forEach((p: any) => {
      this.logger.log(
        `[applyPromotionsToBooking] Promo ${p.code}: limit_type=${p.limit_type}, max_usage=${p.max_usage}, usage_period=${p.usage_period}`,
      );
    });

    // Validate stacking: if any promo is non-stackable, only 1 is allowed
    if (promotions.length > 1) {
      const hasNonStackable = promotions.some((p: any) => !p.is_stackable);
      if (hasNonStackable) {
        throw new BadRequestException(
          'Non-stackable promotion cannot be combined with other promotions',
        );
      }
    }

    const addonIdSet = new Set(
      (opts.addonIds || []).map((id) => id.toString()),
    );
    const addonsTotal = opts.addonPrices.reduce((s, a) => s + a.price, 0);

    const appliedPromotions: any[] = [];
    const breakdown: any[] = [];
    let totalDiscount = 0;

    for (const promo of promotions) {
      const promoServiceId =
        (promo as any).service_id?._id?.toString() ??
        (promo as any).service_id?.toString() ??
        null;

      // Verify the promo still applies to the booking context
      let discountBase = 0;
      let applicable = true;

      if (promo.applies_to === 'service') {
        if (promoServiceId && promoServiceId !== opts.serviceId) {
          applicable = false;
        }
        discountBase = opts.originalServicePrice;
      } else if (promo.applies_to === 'addon') {
        if (promoServiceId) {
          const matchingAddon = opts.addonPrices.find(
            (a) => a._id.toString() === promoServiceId,
          );
          if (!matchingAddon) {
            applicable = false;
          }
          discountBase = matchingAddon?.price ?? 0;
        } else {
          if (!opts.addonIds || opts.addonIds.length === 0) {
            applicable = false;
          }
          discountBase = addonsTotal;
        }
      } else if (promo.applies_to === 'pickup') {
        if (opts.travelFee <= 0 && !opts.pickUp && !opts.delivery) {
          applicable = false;
        }
        discountBase = opts.travelFee;
      } else if (promo.applies_to === 'booking') {
        discountBase = opts.grandTotal;
      }

      if (!applicable) continue;

      const amountDeducted =
        promo.discount_type === 'percent'
          ? (promo.value / 100) * discountBase
          : Math.min(promo.value, discountBase);

      const limitType = (promo as any).limit_type ?? PromotionLimitType.NONE;
      const maxUsage =
        typeof (promo as any).max_usage === 'number'
          ? (promo as any).max_usage
          : null;
      const usagePeriod =
        (promo as any).usage_period ?? PromotionUsagePeriod.LIFETIME;

      this.logger.log(
        `[applyPromotionsToBooking] Processing promo ${promo.code}: limitType=${limitType}, maxUsage=${maxUsage}, usagePeriod=${usagePeriod}, willValidate=${limitType !== PromotionLimitType.NONE && maxUsage && maxUsage > 0}`,
      );

      if (limitType !== PromotionLimitType.NONE && maxUsage && maxUsage > 0) {
        await this.promotionUsageService.assertCanUse({
          promotionId: promo._id.toString(),
          maxUsage,
          limitType,
          usagePeriod,
          bookingDate: opts.bookingDate ?? new Date(),
          userId: opts.customerId,
          petId: opts.petId,
          excludeBookingId: opts.excludeBookingId,
        });
      }

      totalDiscount += amountDeducted;

      const entry = {
        promotion_id: promo._id,
        code: promo.code,
        name: promo.name,
        applies_to: promo.applies_to,
        discount_type: promo.discount_type,
        value: promo.value,
        base_price: discountBase,
        amount_deducted: amountDeducted,
        service_id: promoServiceId ? new Types.ObjectId(promoServiceId) : null,
        applied_at: new Date(),
        limit_type: limitType,
        max_usage: maxUsage,
        usage_period: usagePeriod,
      };

      appliedPromotions.push({
        promotion_id: promo._id.toString(),
        code: promo.code,
        name: promo.name,
        applies_to: promo.applies_to,
        discount_type: promo.discount_type,
        value: promo.value,
        amount_deducted: amountDeducted,
        applied_at: new Date(),
        limit_type: limitType,
        max_usage: maxUsage,
        usage_period: usagePeriod,
      });

      breakdown.push(entry);
    }

    return {
      applied_promotions: appliedPromotions,
      total_discount: totalDiscount,
      breakdown,
    };
  }

  /**
   * Extract price for specific pet size from zone's price array
   */
  private extractPriceFromZone(zone: any, petSizeCategoryId: string): number {
    if (!zone.prices || zone.prices.length === 0) {
      throw new BadRequestException(
        `Zone "${zone.area_name}" has no pricing configured`,
      );
    }

    const priceItem = zone.prices.find(
      (p: any) =>
        p.size_category_id.toString() === petSizeCategoryId.toString(),
    );

    if (!priceItem) {
      throw new BadRequestException(
        `Zone "${zone.area_name}" does not have pricing configured for this pet size category`,
      );
    }

    return priceItem.price;
  }

  /**
   * Find matching zone for customer location based on store zones and zone type
   */
  private async findZoneForCustomer(
    zones: any[],
    customerLatitude: number,
    customerLongitude: number,
    storeLatitude: number,
    storeLongitude: number,
    zoneType: 'home_service' | 'pickup_delivery',
  ): Promise<{ zone: any; price: number; distance: number }> {
    if (!storeLatitude || !storeLongitude) {
      throw new BadRequestException('Store location not properly configured');
    }

    if (!zones || zones.length === 0) {
      throw new BadRequestException(
        `Store has no ${zoneType === 'home_service' ? 'home service' : 'pickup/delivery'} zones configured`,
      );
    }

    const distance = await this.googleMapsDistanceService.getRouteDistanceKm(
      customerLatitude,
      customerLongitude,
      storeLatitude,
      storeLongitude,
    );

    // Find zone that matches the distance
    const matchingZone = zones.find(
      (zone) =>
        distance >= zone.min_radius_km && distance <= zone.max_radius_km,
    );

    if (!matchingZone) {
      throw new BadRequestException(
        `Customer location is outside all ${zoneType === 'home_service' ? 'home service' : 'pickup/delivery'} zones. Distance: ${distance.toFixed(2)}km`,
      );
    }

    // Extract price based on zone type
    let price: number;
    if (zoneType === 'home_service') {
      // Home service has a single flat price
      price = matchingZone.price;
      if (!price || price < 0) {
        throw new BadRequestException(
          `Zone "${matchingZone.area_name}" has invalid pricing configured`,
        );
      }
    } else {
      // Pickup/delivery now also uses flat price
      price = matchingZone.price;
      if (price == null || price < 0) {
        throw new BadRequestException(
          `Zone "${matchingZone.area_name}" has invalid pricing configured`,
        );
      }
    }

    return { zone: matchingZone, price, distance };
  }

  /**
   * Calculate home service fee for in-home grooming
   */
  private async calculateHomeServiceFee(
    store: StoreDocument,
    customerLocation: { latitude: number; longitude: number },
    pet: any,
  ): Promise<{ fee: number; zone_snapshot: any }> {
    if (!store.location?.latitude || !store.location?.longitude) {
      throw new BadRequestException('Store location not properly configured');
    }

    const { zone, price, distance } = await this.findZoneForCustomer(
      store.home_service_zones,
      customerLocation.latitude,
      customerLocation.longitude,
      store.location.latitude,
      store.location.longitude,
      'home_service',
    );

    // Create zone snapshot
    const zone_snapshot = {
      area_name: zone.area_name,
      min_radius_km: zone.min_radius_km,
      max_radius_km: zone.max_radius_km,
      travel_time_minutes: zone.travel_time_minutes,
      price: zone.price,
      zone_type: 'home_service',
      travel_fee: price, // backward compatibility
    };

    return { fee: price, zone_snapshot };
  }

  /**
   * Calculate pickup and/or delivery fees for in-store services
   */
  private async calculatePickupDeliveryFees(
    store: StoreDocument,
    customerLocation: { latitude: number; longitude: number },
    pick_up: boolean,
    delivery: boolean,
  ): Promise<{
    pickup_fee: number;
    delivery_fee: number;
    total: number;
    zone_snapshot: any | null;
  }> {
    // If neither pickup nor delivery selected, return zeros
    if (!pick_up && !delivery) {
      return {
        pickup_fee: 0,
        delivery_fee: 0,
        total: 0,
        zone_snapshot: null,
      };
    }

    if (!store.location?.latitude || !store.location?.longitude) {
      throw new BadRequestException('Store location not properly configured');
    }

    const { zone, price, distance } = await this.findZoneForCustomer(
      store.pickup_delivery_zones,
      customerLocation.latitude,
      customerLocation.longitude,
      store.location.latitude,
      store.location.longitude,
      'pickup_delivery',
    );

    // Validate store supports pickup/delivery services
    if (!store.is_pickup_delivery_available) {
      throw new BadRequestException(
        'Pickup/delivery service is not available at this store',
      );
    }

    // Calculate fees
    const pickup_fee = pick_up ? price : 0;
    const delivery_fee = delivery ? price : 0;
    const total = pickup_fee + delivery_fee;

    // Create zone snapshot
    const zone_snapshot = {
      area_name: zone.area_name,
      min_radius_km: zone.min_radius_km,
      max_radius_km: zone.max_radius_km,
      travel_time_minutes: zone.travel_time_minutes,
      price: zone.price,
      zone_type: 'pickup_delivery',
      travel_fee: total, // backward compatibility
    };

    return { pickup_fee, delivery_fee, total, zone_snapshot };
  }

  /**
   * Find matching zone for pick-up based on customer location and store zones
   * @deprecated Use findZoneForCustomer instead
   */
  private async findPickUpZone(
    store: StoreDocument,
    customerLatitude: number,
    customerLongitude: number,
  ): Promise<any> {
    if (!store.location?.latitude || !store.location?.longitude) {
      throw new BadRequestException('Store location not properly configured');
    }

    const distance = this.calculateDistance(
      customerLatitude,
      customerLongitude,
      store.location.latitude,
      store.location.longitude,
    );

    // Find zone that matches the distance - fallback to old zones field for backward compatibility
    const zones = store.home_service_zones || (store as any).zones || [];
    const matchingZone = zones.find(
      (zone) =>
        distance >= zone.min_radius_km && distance <= zone.max_radius_km,
    );

    if (!matchingZone) {
      throw new BadRequestException(
        `Customer location is outside all delivery zones. Distance: ${distance.toFixed(2)}km`,
      );
    }

    return matchingZone;
  }

  async create(
    body: CreateBookingDto,
    user?: { username: string; role: string },
  ) {
    const seq = await this.counterService.getNextSequence('booking');
    (body as any).code = `ODR-${String(seq).padStart(4, '0')}`;

    if (Array.isArray(body.parent_items)) {
      body.parent_items = body.parent_items.map((it) => ({
        item: it?.item ?? '',
        item_in: it?.item_in ?? false,
        item_out: it?.item_out ?? false,
      }));
    }

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // 1. get pet snapshot
      const pet = await this.petService.getPetSnapshot(
        new ObjectId(body.pet_id),
      );

      // Resolve member_type: comma-separated names of all memberships active on the appointment date
      const createBookingDate = body.date ? new Date(body.date) : undefined;
      const activeMemberships =
        await this.petMembershipService.getActiveMembership(
          body.pet_id,
          createBookingDate,
        );
      let memberType: string | null = null;
      if (activeMemberships && activeMemberships.length > 0) {
        const names = activeMemberships
          .map((m: any) => m.membership?.name)
          .filter(Boolean);
        if (names.length > 0) memberType = names.join(', ');
      }

      body.pet_snapshot = {
        ...pet,
        _id: pet._id.toString(),
        member_type: memberType,
      };

      // Build customer snapshot entirely from BE — never trust FE input
      try {
        const customerDoc = await this.userModel
          .findById(new ObjectId(body.customer_id))
          .select('username phone_number profile')
          .lean();
        if (customerDoc) {
          let customerCategory: { _id: Types.ObjectId; name: string } | null =
            null;
          const catId = (customerDoc as any).profile?.customer_category_id;
          if (catId) {
            try {
              const categoryOption = await this.optionService.findOne(
                new ObjectId(catId),
              );
              if (categoryOption) {
                customerCategory = {
                  _id: categoryOption._id as Types.ObjectId,
                  name: categoryOption.name,
                };
              }
            } catch {
              // category lookup failure is non-fatal — snapshot saved without category
            }
          }
          (body as any).customer_snapshot = {
            customer_name:
              (customerDoc as any).profile?.full_name ||
              (customerDoc as any).username,
            customer_phone: (customerDoc as any).phone_number,
            customer_category: customerCategory,
          };
        }
      } catch {
        // customer snapshot build failure is non-fatal — booking proceeds without it
      }

      // 2. get service snapshot
      body.service_snapshot = (await this.serviceService.getServiceSnapshot(
        new ObjectId(body.service_id),
        pet.pet_type._id ? new ObjectId(pet.pet_type._id) : undefined,
        pet.size._id ? new ObjectId(pet.size._id) : undefined,
        pet.hair._id ? new ObjectId(pet.hair._id) : undefined,
        body.service_addon_ids?.map((id) => new ObjectId(id)),
      )) as any;

      // 3. get Store with session
      const store = await this.storeModel
        .findById(body.store_id)
        .session(session);

      if (!store) throw new NotFoundException('Store not found');

      // 4. Determine service type and handle zone/fee calculation
      const serviceDoc = await this.serviceModel.findById(body.service_id);
      if (!serviceDoc) {
        throw new NotFoundException('Service not found');
      }

      const serviceLocationType = serviceDoc.service_location_type || [];
      const isInHome = serviceLocationType.includes('in home');
      const isInStore = serviceLocationType.includes('in store');

      let pickupFee = 0;
      let deliveryFee = 0;
      let travelFee = 0;
      let matchedZone: any = null;

      // For IN_HOME services: calculate home service fee (always required)
      if (isInHome && !isInStore) {
        const customer = await this.userModel.findById(body.customer_id);
        if (!customer) {
          throw new NotFoundException('Customer not found');
        }

        const addresses = (customer as any).profile?.addresses || [];
        let mainAddress = addresses.find((a: any) => a.is_main_address);
        if (!mainAddress && addresses.length > 0) {
          mainAddress = addresses[0];
        }
        if (!mainAddress || !mainAddress.latitude || !mainAddress.longitude) {
          throw new BadRequestException(
            'Customer must have a location (latitude/longitude) for in-home service',
          );
        }

        const result = await this.calculateHomeServiceFee(
          store,
          { latitude: mainAddress.latitude, longitude: mainAddress.longitude },
          pet,
        );

        travelFee = result.fee;
        matchedZone = result.zone_snapshot;
        (body as any).matched_zone = matchedZone;
        (body as any).pick_up_zone = matchedZone; // backward compatibility
      }
      // For IN_STORE services: calculate pickup/delivery fees (optional)
      else if (isInStore) {
        const needsPickupOrDelivery = body.pick_up || body.delivery;

        if (needsPickupOrDelivery) {
          const customer = await this.userModel.findById(body.customer_id);
          if (!customer) {
            throw new NotFoundException('Customer not found');
          }

          const addresses = (customer as any).profile?.addresses || [];
          let mainAddress = addresses.find((a: any) => a.is_main_address);
          if (!mainAddress && addresses.length > 0) {
            mainAddress = addresses[0];
          }
          if (!mainAddress || !mainAddress.latitude || !mainAddress.longitude) {
            throw new BadRequestException(
              'Customer must have a location (latitude/longitude) for pickup/delivery service',
            );
          }

          const result = await this.calculatePickupDeliveryFees(
            store,
            {
              latitude: mainAddress.latitude,
              longitude: mainAddress.longitude,
            },
            body.pick_up === true,
            body.delivery === true,
          );

          pickupFee = result.pickup_fee;
          deliveryFee = result.delivery_fee;
          travelFee = result.total;
          matchedZone = result.zone_snapshot;

          if (matchedZone) {
            (body as any).matched_zone = matchedZone;
            (body as any).pick_up_zone = matchedZone; // backward compatibility
          }
        }
        // No pickup or delivery - fees remain 0
      }

      // Set fee fields in body for booking creation
      (body as any).pickup_fee = pickupFee;
      (body as any).delivery_fee = deliveryFee;
      (body as any).travel_fee = travelFee;

      // 6. get service and addons
      // 6.1 handle service price calculation
      const service = await this.serviceService.getServiceForBooking(
        new ObjectId(body.service_id),
        pet.size._id ? new ObjectId(pet.size._id) : undefined,
        pet.pet_type._id ? new ObjectId(pet.pet_type._id) : undefined,
        pet.hair._id ? new ObjectId(pet.hair._id) : undefined,
      );

      // 6.2 handle add-ons (if any)
      let addonsTotal = 0;
      let addonsTotalDuration = 0;
      if (body.service_addon_ids && body.service_addon_ids.length > 0) {
        const addons = await Promise.all(
          body.service_addon_ids.map((addonId) =>
            this.serviceService.getServiceForBooking(
              new ObjectId(addonId),
              pet.size._id ? new ObjectId(pet.size._id) : undefined,
              pet.pet_type._id ? new ObjectId(pet.pet_type._id) : undefined,
              pet.hair._id ? new ObjectId(pet.hair._id) : undefined,
            ),
          ),
        );
        addonsTotal = addons.reduce(
          (total, addon) => total + (addon.price || 0),
          0,
        );

        addonsTotalDuration = addons.reduce(
          (total, addon) => total + (addon.duration || 0),
          0,
        );
      }

      // 7. calculate service and addons duration
      const serviceDuration =
        (Number(service.duration) || 0) + addonsTotalDuration;

      // 7b. Hotel: validate end_date and compute number of nights for pricing.
      // For non-hotel services we always set end_date = date so all downstream
      // consumers can rely on the field being present.
      const createServiceTypeTitle = (service as any).service_type?.title as
        | string
        | undefined;
      const isHotelCreate = isHotelServiceType(createServiceTypeTitle);
      const startDateCreate = new Date(body.date);
      let endDateCreate = body.end_date
        ? new Date(body.end_date)
        : startDateCreate;
      if (isHotelCreate) {
        if (!body.end_date) {
          throw new BadRequestException(
            'end_date wajib diisi untuk service hotel',
          );
        }
        const sOnly = new Date(startDateCreate);
        sOnly.setUTCHours(0, 0, 0, 0);
        const eOnly = new Date(endDateCreate);
        eOnly.setUTCHours(0, 0, 0, 0);
        if (eOnly.getTime() < sOnly.getTime()) {
          throw new BadRequestException(
            'end_date tidak boleh sebelum tanggal mulai',
          );
        }
      } else {
        endDateCreate = new Date(startDateCreate);
      }
      const nightsCreate = isHotelCreate
        ? computeHotelNights(startDateCreate, endDateCreate)
        : 1;
      (body as any).end_date = endDateCreate;

      // 8. calculate service and addons price.
      // Hotel: service.price is per-night, multiply by nights.
      const serviceBaseTotal = isHotelCreate
        ? service.price * nightsCreate
        : service.price;
      body.sub_total_service = serviceBaseTotal + addonsTotal;
      const originalTotalPrice =
        (body.sub_total_service || 0) +
        (typeof travelFee === 'number' ? travelFee : 0);
      body.original_total_price = originalTotalPrice;
      body.travel_fee = travelFee;

      // 9. apply benefits if selected
      // BUG1 fix: initialize with safe defaults so booking without benefits doesn't crash
      let appliedBenefitsData: any = {
        applied_benefits: [],
        total_discount: 0,
        final_price: originalTotalPrice,
        breakdown: [],
      };

      if (body.selected_benefit_ids && body.selected_benefit_ids.length > 0) {
        // BUG2 fix: pass originalTotalPrice so final_price covers all items
        appliedBenefitsData = await this.applyBenefitsToBooking(
          body.pet_id,
          body.selected_benefit_ids,
          body.store_id,
          body.service_id,
          body.service_addon_ids,
          originalTotalPrice,
          body.date ? new Date(body.date) : undefined, // pass bookingDate for accurate period-based usage check
          body.pick_up === true,
          body.delivery === true,
        );
      }

      body.total_discount = appliedBenefitsData.total_discount;
      body.final_total_price = appliedBenefitsData.final_price;
      (body as any).applied_benefits = appliedBenefitsData.breakdown;

      // 9b. apply promotions if selected
      let appliedPromotionsData: any = {
        applied_promotions: [],
        total_discount: 0,
        breakdown: [],
      };

      if (
        body.selected_promotion_ids &&
        body.selected_promotion_ids.length > 0
      ) {
        // Build addon prices for promotion calculation
        const snapshotAddons = (body.service_snapshot as any)?.addons ?? [];
        const promoAddonPrices = snapshotAddons.map((a: any) => ({
          _id: a._id?.toString() ?? '',
          name: a.name ?? '',
          price: a.price ?? 0,
        }));

        this.logger.log(
          `[applyPromotions] Applying promotions for customer=${body.customer_id}, pet=${body.pet_id}, date=${body.date}`,
        );

        appliedPromotionsData = await this.applyPromotionsToBooking(
          body.selected_promotion_ids,
          {
            serviceId: body.service_id,
            addonIds: body.service_addon_ids,
            pickUp: body.pick_up === true,
            delivery: body.delivery === true,
            hasActiveMembership:
              appliedBenefitsData.applied_benefits.length > 0,
            originalServicePrice: serviceBaseTotal,
            addonPrices: promoAddonPrices,
            travelFee: travelFee,
            grandTotal: originalTotalPrice,
            customerId: body.customer_id,
            petId: body.pet_id,
            bookingDate: body.date ? new Date(body.date) : new Date(),
          },
        );

        this.logger.log(
          `[applyPromotions] Result: ${appliedPromotionsData.applied_promotions?.length || 0} promotions applied`,
        );
        if (appliedPromotionsData.applied_promotions?.length > 0) {
          this.logger.log(
            `[applyPromotions] First promo details: ${JSON.stringify(appliedPromotionsData.applied_promotions[0])}`,
          );
        }
      }

      // Combine discounts: benefit + promotion
      const combinedDiscount =
        appliedBenefitsData.total_discount +
        appliedPromotionsData.total_discount;
      body.total_discount = combinedDiscount;
      body.final_total_price = Math.max(
        0,
        originalTotalPrice - combinedDiscount,
      );
      (body as any).applied_promotions = appliedPromotionsData.breakdown;
      (body as any).selected_promotion_ids = (
        body.selected_promotion_ids ?? []
      ).map((id: string) => new Types.ObjectId(id));

      // 10. auto-generate sessions from service.sessions array for all booking types
      if (service.sessions && service.sessions.length > 0) {
        const sessionOptions = await this.optionService.findByNames(
          service.sessions,
        );
        const optionMap = new Map(sessionOptions.map((o: any) => [o.name, o]));

        (body as any).sessions = service.sessions.map((sessionType, index) => ({
          type: sessionType,
          groomer_id: null,
          status: SessionStatus.NOT_STARTED,
          started_at: null,
          finished_at: null,
          notes: null,
          internal_note: null,
          order: index,
          ideal_duration: optionMap.get(sessionType)?.ideal_duration ?? null,
        }));
      } else {
        (body as any).sessions = [];
      }

      // 11. inject Pickup / Dropoff sessions for in-store bookings with pickup/delivery
      if (body.type === GroomingType.IN_STORE) {
        const generatedSessions: any[] = (body as any).sessions;

        if (body.pick_up) {
          // Shift all existing sessions' order by 1 to make room at index 0
          generatedSessions.forEach((s) => s.order++);

          generatedSessions.unshift({
            type: 'Pickup',
            groomer_id: null,
            status: SessionStatus.NOT_STARTED,
            started_at: null,
            finished_at: null,
            notes: null,
            internal_note: null,
            order: 0,
          });
        }

        if (body.delivery) {
          generatedSessions.push({
            type: 'Dropoff',
            groomer_id: null,
            status: SessionStatus.NOT_STARTED,
            started_at: null,
            finished_at: null,
            notes: null,
            internal_note: null,
            order: generatedSessions.length,
          });
        }

        (body as any).sessions = generatedSessions;
      }

      // 12-15. Daily store capacity tracking — only applied for grooming bookings.
      // Hotel / daycare / vet / transport / etc. do not consume or validate
      // daily store capacity, so this block is skipped for those service types.
      const tracksCapacityCreate = isGroomingServiceType(
        createServiceTypeTitle,
      );
      let overbookedMinutes = 0;

      if (tracksCapacityCreate) {
        // 12. get capacity by store_id and date (override or default)
        const targetDate = new Date(body.date);
        targetDate.setUTCHours(0, 0, 0, 0);
        const nextDay = new Date(targetDate);
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);

        const dailyOverride = await this.storeDailyCapacityModel
          .findOne({
            store_id: new ObjectId(body.store_id),
            date: { $gte: targetDate, $lt: nextDay },
          })
          .session(session);

        const totalCapacity =
          dailyOverride?.total_capacity_minutes ??
          store.capacity.default_daily_capacity_minutes;

        const overbookingLimit = store.capacity.overbooking_limit_minutes;
        const maxAllowedCapacity = totalCapacity + overbookingLimit;

        // 13. atomic increment usage store by date
        const usage = await this.storeDailyUsageModel.findOneAndUpdate(
          {
            store_id: new ObjectId(body.store_id),
            date: body.date,
          },
          {
            $inc: { used_minutes: serviceDuration },
          },
          {
            returnDocument: 'after',
            upsert: true,
            session,
          },
        );

        // 14. validate overbooking Limit
        if (usage.used_minutes > maxAllowedCapacity) {
          // Rollback increment
          await this.storeDailyUsageModel.findOneAndUpdate(
            {
              store_id: new ObjectId(body.store_id),
              date: body.date,
            },
            {
              $inc: { used_minutes: -serviceDuration },
            },
            { session },
          );

          // Create status log for WAITLIST
          const waitlistStatusLog: BookingStatusLogDto = {
            status: BookingStatus.WAITLIST,
            timestamp: new Date(),
            note: `Booking is waitlisted (capacity exceeded) - created by ${user?.username || 'unknown'} (${user?.role || 'unknown'})`,
          };

          body.status_logs = [waitlistStatusLog];
          body.booking_status = BookingStatus.WAITLIST;

          const waitlistBooking = await this.bookingModel.create([body], {
            session,
          });

          await session.commitTransaction();
          session.endSession();

          return waitlistBooking[0];
        }

        // 15. calculate overbooked_minutes
        if (usage.used_minutes > totalCapacity) {
          overbookedMinutes = usage.used_minutes - totalCapacity;
        }
      }

      // 16. create CONFIRMED booking
      const statusLog: BookingStatusLogDto = {
        status:
          user?.role === 'admin'
            ? BookingStatus.CONFIRMED
            : BookingStatus.REQUESTED,
        timestamp: new Date(),
        note: `Booking is created by ${user?.username || 'unknown'} (${user?.role || 'unknown'})${overbookedMinutes > 0 ? ` - overbooked by ${overbookedMinutes} minutes` : ''}`,
      };

      body.status_logs = [statusLog];
      body.booking_status =
        user?.role === 'admin'
          ? BookingStatus.CONFIRMED
          : BookingStatus.REQUESTED;

      (body as any).created_by_role =
        user?.role === 'admin'
          ? 'admin'
          : user?.role === 'customer'
            ? 'customer'
            : null;

      const booking = await this.bookingModel.create([body], { session });

      await session.commitTransaction();
      session.endSession();

      // Emit event for real-time report updates
      this.bookingEventsService.emit((booking[0] as any)._id.toString());

      // Record per-period benefit usage AFTER successful commit
      if (appliedBenefitsData.applied_benefits?.length > 0) {
        const bookingDate = new Date(body.date);
        const bookingId = (booking[0] as any)._id.toString();
        for (const applied of appliedBenefitsData.applied_benefits) {
          if (applied.pet_membership_id && applied.benefit_id) {
            try {
              await this.benefitUsageService.recordUsage({
                pet_membership_id: applied.pet_membership_id,
                benefit_id: applied.benefit_id.toString(),
                booking_id: bookingId,
                target_id: bookingId,
                amount_used: 1,
                booking_date: bookingDate,
                period_key: BenefitUsageService.computePeriodKey(
                  bookingDate,
                  applied.benefit_period,
                ),
                benefit_period: applied.benefit_period,
              });
            } catch {
              // Non-fatal: usage recording failure should not roll back a committed booking
            }
          }
        }
      }

      if (appliedPromotionsData.applied_promotions?.length > 0) {
        const bookingDate = body.date ? new Date(body.date) : new Date();
        const bookingId = (booking[0] as any)._id.toString();

        this.logger.log(
          `[recordPromotionUsage] Processing ${appliedPromotionsData.applied_promotions.length} promotions for booking ${bookingId}`,
        );

        for (const applied of appliedPromotionsData.applied_promotions) {
          const limitType = applied.limit_type ?? PromotionLimitType.NONE;
          const maxUsage = applied.max_usage;
          const usagePeriod =
            applied.usage_period ?? PromotionUsagePeriod.LIFETIME;

          this.logger.log(
            `[recordPromotionUsage] Promo ${applied.code}: limitType=${limitType}, maxUsage=${maxUsage}, usagePeriod=${usagePeriod}, promotionId=${applied.promotion_id}`,
          );

          try {
            this.logger.log(
              `[recordPromotionUsage] Recording usage with params: promotionId=${applied.promotion_id}, bookingId=${bookingId}, customerId=${body.customer_id}, petId=${body.pet_id}, limitType=${limitType}, usagePeriod=${usagePeriod}`,
            );

            const usageRecord = await this.promotionUsageService.recordUsage({
              promotionId: applied.promotion_id?.toString() || '',
              bookingId,
              bookingDate,
              limitType,
              usagePeriod,
              userId: body.customer_id?.toString(),
              petId: body.pet_id?.toString(),
            });

            this.logger.log(
              `[recordPromotionUsage] ✓ Successfully recorded usage for promo ${applied.code}, usage record ID: ${(usageRecord as any)._id}`,
            );
          } catch (err) {
            // Non-fatal: usage recording failure should not roll back a committed booking
            this.logger.error(
              `[recordPromotionUsage] ✗ Failed to record usage for promo ${applied.code}`,
            );
            this.logger.error(
              `[recordPromotionUsage] Error details: ${err instanceof Error ? err.message : String(err)}`,
            );
            if (err instanceof Error && err.stack) {
              this.logger.error(
                `[recordPromotionUsage] Stack trace: ${err.stack}`,
              );
            }
          }
        }
      }

      return booking[0];
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  // ─── Groomer Endpoints ─────────────────────────────────────────────────────

  /**
   * Get bookings assigned to a specific groomer (via sessions.groomer_id)
   */
  async getGroomerMyJobs(
    groomerId: ObjectId,
    query: ListGroomerMyJobsDto = {},
  ) {
    const { page = 1, limit = 20, session_status, date_from, date_to } = query;

    const filter: any = {
      isDeleted: false,
      'sessions.groomer_id': new Types.ObjectId(groomerId.toString()),
      booking_status: { $nin: [BookingStatus.CANCELLED] },
    };

    if (date_from || date_to) {
      filter.date = {};
      if (date_from) filter.date.$gte = date_from;
      if (date_to) filter.date.$lte = date_to;
    }

    if (session_status) {
      filter.sessions = {
        ...filter.sessions,
        $elemMatch: {
          groomer_id: new Types.ObjectId(groomerId.toString()),
          status: session_status,
        },
      };
      delete filter['sessions.groomer_id'];
    }

    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      this.bookingModel
        .find(filter)
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('customer', 'username email phone_number')
        .populate('store', 'name')
        .populate({
          path: 'sessions.groomer_id',
          select: 'username email phone_number',
          model: 'User',
        })
        .exec(),
      this.bookingModel.countDocuments(filter),
    ]);

    return { bookings, total, page, limit };
  }

  /**
   * Get bookings with at least one unassigned session (groomer_id is null)
   * Defaults to today's bookings, scoped to the groomer's branch.
   * Sorted by status priority (arrived → in progress → confirmed) then by
   * nearest booking time. Reuses `findOpenJobs()` so the urgent dashboard
   * can call into the same query with different date/scope inputs.
   */
  async getGroomerOpenJobs(
    groomerId: ObjectId,
    query: ListGroomerOpenJobsDto = {},
  ) {
    const { page = 1, limit = 20, date_from, date_to, store_id, scope } = query;

    // Default to today's date unless the caller opts out via `scope=all|urgent`.
    const skipDateDefault = scope === 'all' || scope === 'urgent';
    let effectiveDateFrom = date_from;
    let effectiveDateTo = date_to;
    if (!effectiveDateFrom && !effectiveDateTo && !skipDateDefault) {
      const today = toYMD(new Date());
      effectiveDateFrom = today;
      effectiveDateTo = today;
    }

    return this.findOpenJobs({
      groomerId,
      page,
      limit,
      date_from: effectiveDateFrom,
      date_to: effectiveDateTo,
      store_id_override: store_id,
    });
  }

  /**
   * Reusable open-jobs query — exposed for callers like the urgent dashboard.
   * Encapsulates: branch scoping (groomer placement wins; admin/no-placement
   * falls back to `store_id_override` if provided), skill matching, status
   * filter (confirmed/arrived/in progress), date filter, and status-priority
   * sort.
   */
  async findOpenJobs(args: {
    groomerId?: ObjectId;
    page?: number;
    limit?: number;
    date_from?: string;
    date_to?: string;
    store_id_override?: string;
    booking_statuses?: BookingStatus[];
    match_skills?: boolean;
  }) {
    const {
      groomerId,
      page = 1,
      limit = 20,
      date_from,
      date_to,
      store_id_override,
      booking_statuses,
      match_skills = true,
    } = args;

    // Look up groomer's placements (stores) and skills if a groomerId is given.
    // Supports both the new array field (`placements`) and the legacy scalar
    // (`placement`) for backward compatibility with old groomer profiles.
    let groomerStoreIds: any[] = [];
    let groomerSkills: string[] = [];
    if (groomerId) {
      const groomer = await this.userModel
        .findById(groomerId)
        .select('profile.placements profile.placement profile.groomer_skills')
        .lean();
      const placementsArr = (groomer?.profile as any)?.placements;
      const legacyPlacement = (groomer?.profile as any)?.placement;
      if (Array.isArray(placementsArr) && placementsArr.length > 0) {
        groomerStoreIds = placementsArr;
      } else if (legacyPlacement) {
        groomerStoreIds = [legacyPlacement];
      }
      groomerSkills = groomer?.profile?.groomer_skills || [];
    }

    // Branch scoping: groomer placements always win. If a single override is
    // supplied AND that store is one of the groomer's placements, we keep
    // scoping to that store; otherwise the filter spans every placement.
    // Super-admin / unscoped callers (no placements) fall back to override.
    let effectiveStoreIds: any[] | undefined;
    if (groomerStoreIds.length > 0) {
      if (
        store_id_override &&
        groomerStoreIds.some(
          (id) => id?.toString() === store_id_override.toString(),
        )
      ) {
        effectiveStoreIds = [store_id_override];
      } else {
        effectiveStoreIds = groomerStoreIds;
      }
    } else if (store_id_override) {
      effectiveStoreIds = [store_id_override];
    }

    const filter = this.buildOpenJobsFilter({
      store_ids: effectiveStoreIds,
      groomer_skills: match_skills ? groomerSkills : [],
      date_from,
      date_to,
      booking_statuses,
    });

    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      this.bookingModel
        .find(filter)
        .sort({ date: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('customer', 'username email phone_number')
        .populate('store', 'name')
        .populate({
          path: 'sessions.groomer_id',
          select: 'username email phone_number',
          model: 'User',
        })
        .exec(),
      this.bookingModel.countDocuments(filter),
    ]);

    // Status-priority sort: arrived → in progress → confirmed.
    // Tie-break preserves the date-asc / createdAt-desc order from the DB.
    const sorted = [...bookings].sort((a, b) => {
      const pa = OPEN_JOBS_STATUS_PRIORITY[a.booking_status] ?? 99;
      const pb = OPEN_JOBS_STATUS_PRIORITY[b.booking_status] ?? 99;
      return pa - pb;
    });

    return { bookings: sorted, total, page, limit };
  }

  /**
   * Build a MongoDB filter for "open jobs" (bookings that have at least one
   * unclaimed session). Pure / stateless — safe to call from other services.
   */
  buildOpenJobsFilter(args: {
    store_id?: any;
    store_ids?: any[];
    groomer_skills?: string[];
    date_from?: string;
    date_to?: string;
    booking_statuses?: BookingStatus[];
  }) {
    const {
      store_id,
      store_ids,
      groomer_skills = [],
      date_from,
      date_to,
      booking_statuses,
    } = args;

    const filter: any = {
      isDeleted: false,
      booking_status: {
        $in: booking_statuses ?? [
          BookingStatus.CONFIRMED,
          BookingStatus.ARRIVED,
          BookingStatus.IN_PROGRESS,
        ],
      },
    };

    // store_id in some bookings is stored as a string (not ObjectId), so match
    // against both the ObjectId and its string representation. With multi-
    // placement, we expand each store id into both forms.
    const storeList: any[] = Array.isArray(store_ids)
      ? store_ids
      : store_id
        ? [store_id]
        : [];
    if (storeList.length > 0) {
      const expanded: any[] = [];
      for (const sid of storeList) {
        if (sid === undefined || sid === null) continue;
        expanded.push(sid);
        const str = sid.toString();
        if (str !== sid) expanded.push(str);
      }
      filter.store_id = { $in: expanded };
    }

    if (date_from || date_to) {
      filter.date = {};
      if (date_from) filter.date.$gte = new Date(`${date_from}T00:00:00.000Z`);
      if (date_to) filter.date.$lte = new Date(`${date_to}T23:59:59.999Z`);
    }

    // Session $elemMatch: unclaimed + matching groomer's skills (by name, ci)
    const elemMatchFilter: any = { groomer_id: null };
    if (groomer_skills.length > 0) {
      const skillsRegex = groomer_skills.map(
        (skill) =>
          new RegExp(`^${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      );
      elemMatchFilter.type = { $in: skillsRegex };
    }
    filter.sessions = { $elemMatch: elemMatchFilter };

    return filter;
  }

  async findAll(query: ListBookingsDto = {}) {
    const {
      page = 1,
      limit = 20,
      status,
      date_from,
      date_to,
      created_by_role,
      customer_id,
      pet_id,
      store_id,
      service_id,
      service_type,
      groomer_id,
      search,
    } = query;

    const filter: any = { isDeleted: false };

    if (status) {
      const statuses = status
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (statuses.length > 1) {
        filter.booking_status = { $in: statuses };
      } else if (statuses.length === 1) {
        filter.booking_status = statuses[0];
      }
    }

    if (date_from || date_to) {
      filter.date = {};
      if (date_from) filter.date.$gte = date_from;
      if (date_to) filter.date.$lte = date_to;
    }

    if (created_by_role) {
      const roles = created_by_role
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);
      filter.created_by_role = roles.length > 1 ? { $in: roles } : roles[0];
    }

    if (customer_id) {
      filter.customer_id = customer_id;
    }

    if (pet_id) {
      filter.pet_id = pet_id;
    }

    if (store_id) {
      const storeIds = store_id
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      // Bookings may store store_id as either ObjectId or plain string depending
      // on when the document was created, so include both forms in $in.
      filter.store_id = {
        $in: storeIds.flatMap((id) =>
          Types.ObjectId.isValid(id) ? [new Types.ObjectId(id), id] : [id],
        ),
      };
    }

    if (service_id) {
      const serviceIds = service_id
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      // Same dual-form approach: match regardless of ObjectId vs string storage.
      filter.service_id = {
        $in: serviceIds.flatMap((id) =>
          Types.ObjectId.isValid(id) ? [new Types.ObjectId(id), id] : [id],
        ),
      };
    }

    if (service_type) {
      filter['service_snapshot.service_type._id'] = Types.ObjectId.isValid(
        service_type,
      )
        ? new Types.ObjectId(service_type)
        : service_type;
    }

    // Match bookings that have at least one session assigned to this groomer.
    // Mongoose doesn't reliably auto-cast values on subdocument array paths,
    // so cast the string id to ObjectId here when valid.
    if (groomer_id) {
      filter['sessions.groomer_id'] = Types.ObjectId.isValid(groomer_id)
        ? new Types.ObjectId(groomer_id)
        : groomer_id;
    }

    // --- SEARCH PATH ---
    // `customer` is a Mongoose virtual (not stored in the booking document),
    // so it cannot be queried at DB level. We fetch all bookings that match
    // the other filters, populate the virtual, then filter & paginate in app.
    if (search) {
      const allBookings = await this.bookingModel
        .find(filter)
        .sort({ date: -1, createdAt: -1 })
        .populate('customer', 'username email phone_number profile.full_name')
        .populate('store', 'name')
        .populate({
          path: 'sessions.groomer_id',
          select: 'username email phone_number',
          model: 'User',
        })
        .exec();

      const q = search.toLowerCase();
      const searchFiltered = allBookings.filter((b: any) => {
        const petName: string = (b.pet_snapshot?.name ?? '').toLowerCase();
        const customer = (b as any).customer as any;
        const username: string = (customer?.username ?? '').toLowerCase();
        const phone: string = (customer?.phone_number ?? '').toLowerCase();
        const fullName: string = (
          customer?.profile?.full_name ?? ''
        ).toLowerCase();
        return (
          petName.includes(q) ||
          username.includes(q) ||
          phone.includes(q) ||
          fullName.includes(q)
        );
      });

      const total = searchFiltered.length;
      const skip = (page - 1) * limit;
      const pagedBookings = searchFiltered.slice(skip, skip + limit);

      const searchPetIds = [
        ...new Set(
          pagedBookings
            .map((b) => (b as any).pet_id?.toString())
            .filter(Boolean) as string[],
        ),
      ];
      const searchMembershipsMap =
        await this.petMembershipService.getActiveMembershipsForPets(
          searchPetIds,
        );

      const enrichedSearchBookings = pagedBookings.map((booking) => {
        const plain = (booking as any).toJSON
          ? (booking as any).toJSON()
          : (booking as any);
        const petIdStr = plain.pet_id?.toString();
        const bookingDate = new Date(plain.date);
        const petMemberships = searchMembershipsMap.get(petIdStr) ?? [];
        const activeMemberships = petMemberships.filter(
          (pm) =>
            bookingDate >= new Date(pm.start_date) &&
            toUtcStartOfDay(bookingDate) <= new Date(pm.end_date),
        );
        plain.active_memberships = activeMemberships.map((pm) => ({
          name: pm.name,
        }));
        return plain;
      });

      return { bookings: enrichedSearchBookings, total, page, limit };
    }

    // --- NORMAL PATH (no search) ---
    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      this.bookingModel
        .find(filter)
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('customer', 'username email phone_number')
        .populate('store', 'name')
        .populate({
          path: 'sessions.groomer_id',
          select: 'username email phone_number',
          model: 'User',
        })
        .exec(),
      this.bookingModel.countDocuments(filter),
    ]);

    // Enrich each booking with active_memberships at the booking date
    const petIds = [
      ...new Set(
        bookings
          .map((b) => (b as any).pet_id?.toString())
          .filter(Boolean) as string[],
      ),
    ];
    const membershipsMap =
      await this.petMembershipService.getActiveMembershipsForPets(petIds);

    const enrichedBookings = bookings.map((booking) => {
      const plain = (booking as any).toJSON
        ? (booking as any).toJSON()
        : (booking as any);
      const petIdStr = plain.pet_id?.toString();
      const bookingDate = new Date(plain.date);
      const petMemberships = membershipsMap.get(petIdStr) ?? [];
      const activeMemberships = petMemberships.filter(
        (pm) =>
          bookingDate >= new Date(pm.start_date) &&
          bookingDate <= new Date(pm.end_date),
      );
      plain.active_memberships = activeMemberships.map((pm) => ({
        name: pm.name,
      }));
      return plain;
    });

    return { bookings: enrichedBookings, total, page, limit };
  }

  async findOne(id: ObjectId) {
    const booking = await this.bookingModel
      .findById(id)
      .populate('customer', 'username email phone_number')
      .populate('store', 'name')
      .populate({
        path: 'sessions.groomer_id',
        select: 'username email phone_number',
        model: 'User',
      })
      .exec();
    return booking;
  }

  async update(
    id: ObjectId,
    body: UpdateBookingDto,
    user?: { username: string; role: string },
  ) {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const existingBooking = await this.bookingModel
        .findById(id)
        .session(session);

      if (!existingBooking || existingBooking.isDeleted) {
        throw new NotFoundException('Booking not found');
      }

      // Guard: booking dengan status returned tidak bisa diubah
      if (existingBooking.booking_status === BookingStatus.RETURNED) {
        throw new BadRequestException(
          "Booking dengan status 'returned' tidak dapat diubah lagi.",
        );
      }

      // simpan dan status_logs yang lama
      const { status_logs } = existingBooking;

      // periksa apakah booking_status sedang diperbarui
      if (
        body.booking_status &&
        body.booking_status !== existingBooking.booking_status
      ) {
        // tambahkan entri log status baru
        const newStatusLog: BookingStatusLogDto = {
          status: body.booking_status,
          timestamp: new Date(),
          note: `Status changed to ${body.booking_status} by ${user?.username || 'unknown'} (${user?.role || 'unknown'})`,
        };

        // tambahkan log baru ke log yang sudah ada.
        body.status_logs = [...status_logs, newStatusLog];
      }

      const pet = await this.petService.getPetSnapshot(
        new ObjectId(body.pet_id),
      );

      // Resolve member_type: comma-separated names of all memberships active on the appointment date
      const updateBookingDate = body.date ? new Date(body.date) : undefined;
      const activeMembershipsUpd = body.pet_id
        ? await this.petMembershipService.getActiveMembership(
            body.pet_id,
            updateBookingDate,
          )
        : [];
      let memberTypeUpd: string | null = null;
      if (activeMembershipsUpd && activeMembershipsUpd.length > 0) {
        const names = activeMembershipsUpd
          .map((m: any) => m.membership?.name)
          .filter(Boolean);
        if (names.length > 0) memberTypeUpd = names.join(', ');
      }

      body.pet_snapshot = {
        ...pet,
        _id: pet._id.toString(),
        member_type: memberTypeUpd,
      };

      body.service_snapshot = (await this.serviceService.getServiceSnapshot(
        new ObjectId(body.service_id),
        pet.pet_type._id ? new ObjectId(pet.pet_type._id) : undefined,
        pet.size._id ? new ObjectId(pet.size._id) : undefined,
        pet.hair._id ? new ObjectId(pet.hair._id) : undefined,
        body.service_addon_ids?.map((id) => new ObjectId(id)),
      )) as any;

      // handle service
      const service = await this.serviceService.getServiceForBooking(
        new ObjectId(body.service_id),
        pet.size._id ? new ObjectId(pet.size._id) : undefined,
        pet.pet_type._id ? new ObjectId(pet.pet_type._id) : undefined,
        pet.hair._id ? new ObjectId(pet.hair._id) : undefined,
      );

      // handle add-ons jika ada
      let addonsTotal = 0;
      let addonsTotalDuration = 0;
      if (body.service_addon_ids && body.service_addon_ids.length > 0) {
        const addons = await Promise.all(
          body.service_addon_ids.map((addonId) =>
            this.serviceService.getServiceForBooking(
              new ObjectId(addonId),
              pet.size._id ? new ObjectId(pet.size._id) : undefined,
              pet.pet_type._id ? new ObjectId(pet.pet_type._id) : undefined,
              pet.hair._id ? new ObjectId(pet.hair._id) : undefined,
            ),
          ),
        );
        addonsTotal = addons.reduce(
          (total, addon) => total + (addon.price || 0),
          0,
        );
        addonsTotalDuration = addons.reduce(
          (total, addon) => total + (addon.duration || 0),
          0,
        );
      }

      const newServiceDuration =
        (Number(service.duration) || 0) + addonsTotalDuration;

      // Hotel: validate end_date & compute nights. Non-hotel: end_date = date.
      const updateServiceTypeTitle = (service as any).service_type?.title as
        | string
        | undefined;
      const isHotelUpdate = isHotelServiceType(updateServiceTypeTitle);
      const startDateUpdate = new Date(body.date ?? existingBooking.date);
      let endDateUpdate: Date;
      if (isHotelUpdate) {
        const providedEnd = body.end_date ?? (existingBooking as any).end_date;
        if (!providedEnd) {
          throw new BadRequestException(
            'end_date wajib diisi untuk service hotel',
          );
        }
        endDateUpdate = new Date(providedEnd);
        const sOnly = new Date(startDateUpdate);
        sOnly.setUTCHours(0, 0, 0, 0);
        const eOnly = new Date(endDateUpdate);
        eOnly.setUTCHours(0, 0, 0, 0);
        if (eOnly.getTime() < sOnly.getTime()) {
          throw new BadRequestException(
            'end_date tidak boleh sebelum tanggal mulai',
          );
        }
      } else {
        endDateUpdate = new Date(startDateUpdate);
      }
      const nightsUpdate = isHotelUpdate
        ? computeHotelNights(startDateUpdate, endDateUpdate)
        : 1;
      (body as any).end_date = endDateUpdate;

      const serviceBaseTotalUpdate = isHotelUpdate
        ? service.price * nightsUpdate
        : service.price;
      body.sub_total_service = serviceBaseTotalUpdate + addonsTotal;
      // travelFee always from matched zone (or 0 if not pick up)
      let travelFee = 0;
      if (
        (body as any).pick_up_zone &&
        typeof (body as any).pick_up_zone.travel_fee === 'number'
      ) {
        travelFee = (body as any).pick_up_zone.travel_fee;
      }
      const originalTotalPriceGuest = (body.sub_total_service || 0) + travelFee;
      body.original_total_price = originalTotalPriceGuest;

      // Apply benefits for guest if applicable
      let appliedBenefitsDataGuest: any = {
        applied_benefits: [],
        total_discount: 0,
        final_price: originalTotalPriceGuest,
      };

      if (
        body.selected_benefit_ids &&
        body.selected_benefit_ids.length > 0 &&
        body.pet_id
      ) {
        try {
          appliedBenefitsDataGuest = await this.applyBenefitsToBooking(
            body.pet_id,
            body.selected_benefit_ids,
            body.store_id,
            body.service_id,
            body.service_addon_ids,
            originalTotalPriceGuest,
            undefined, // bookingDate
            body.pick_up === true,
            body.delivery === true,
          );
        } catch (error) {
          // Guest might not have membership, proceed without benefits
          appliedBenefitsDataGuest = {
            applied_benefits: [],
            total_discount: 0,
            final_price: originalTotalPriceGuest,
          };
        }
      }

      // BUG4 fix: was assigning final_price to total_discount (wrong field)
      body.total_discount = appliedBenefitsDataGuest.total_discount;
      body.final_total_price = appliedBenefitsDataGuest.final_price;
      (body as any).applied_benefits = appliedBenefitsDataGuest.breakdown;

      // Check if date or service/addons changed (affects capacity)
      const oldDate = new Date(existingBooking.date);

      // Use existing date if not provided in update
      const dateToUse = body.date || existingBooking.date;
      const newDate = new Date(dateToUse);

      const dateChanged = oldDate.getTime() !== newDate.getTime();

      // Get old service duration
      const oldService = await this.serviceModel
        .findById(existingBooking.service_id)
        .session(session);
      let oldServiceDuration = Number(oldService?.duration) || 0;

      if (
        existingBooking.service_addon_ids &&
        existingBooking.service_addon_ids.length > 0
      ) {
        const oldAddons = await this.serviceModel
          .find({
            _id: { $in: existingBooking.service_addon_ids },
          })
          .session(session);
        const oldAddonsDuration = oldAddons.reduce(
          (total, addon) => total + (Number(addon.duration) || 0),
          0,
        );
        oldServiceDuration += oldAddonsDuration;
      }

      const durationChanged = oldServiceDuration !== newServiceDuration;

      // Capacity tracking is gated on grooming service type. We may need to
      // rollback the old booking's usage (if it WAS grooming) and increment the
      // new date's usage (if the updated booking IS grooming).
      const oldServiceTypeTitle = (existingBooking.service_snapshot as any)
        ?.service_type?.title as string | undefined;
      const oldTracksCapacity = isGroomingServiceType(oldServiceTypeTitle);
      const newTracksCapacity = isGroomingServiceType(updateServiceTypeTitle);

      // If date or duration changed, update capacity tracking
      if (
        (dateChanged || durationChanged) &&
        (oldTracksCapacity || newTracksCapacity)
      ) {
        // 1️⃣ Rollback old capacity usage (only if old booking consumed capacity)
        if (oldTracksCapacity) {
          await this.storeDailyUsageModel.findOneAndUpdate(
            {
              store_id: new ObjectId(existingBooking.store_id),
              date: oldDate,
            },
            {
              $inc: { used_minutes: -oldServiceDuration },
            },
            { session },
          );
        }

        // Only validate/increment new capacity if updated booking is grooming.
        if (newTracksCapacity) {
          // 2️⃣ Get store and check new capacity
          const store = await this.storeModel
            .findById(body.store_id)
            .session(session);

          if (!store) throw new NotFoundException('Store not found');

          const targetDate = new Date(newDate);
          targetDate.setUTCHours(0, 0, 0, 0);
          const nextDay = new Date(targetDate);
          nextDay.setUTCDate(nextDay.getUTCDate() + 1);

          const dailyOverride = await this.storeDailyCapacityModel
            .findOne({
              store_id: new ObjectId(body.store_id),
              date: { $gte: targetDate, $lt: nextDay },
            })
            .session(session);

          const totalCapacity =
            dailyOverride?.total_capacity_minutes ??
            store.capacity.default_daily_capacity_minutes;

          const overbookingLimit = store.capacity.overbooking_limit_minutes;
          const maxAllowedCapacity = totalCapacity + overbookingLimit;

          // 3️⃣ Atomic increment usage for new date
          const usage = await this.storeDailyUsageModel.findOneAndUpdate(
            {
              store_id: new ObjectId(body.store_id),
              date: newDate,
            },
            {
              $inc: { used_minutes: newServiceDuration },
            },
            {
              returnDocument: 'after',
              upsert: true,
              session,
            },
          );

          // 4️⃣ Validasi Overbooking Limit
          if (usage.used_minutes > maxAllowedCapacity) {
            // Rollback increment
            await this.storeDailyUsageModel.findOneAndUpdate(
              {
                store_id: new ObjectId(body.store_id),
                date: newDate,
              },
              {
                $inc: { used_minutes: -newServiceDuration },
              },
              { session },
            );

            // Restore old capacity usage (only if we rolled it back)
            if (oldTracksCapacity) {
              await this.storeDailyUsageModel.findOneAndUpdate(
                {
                  store_id: new ObjectId(existingBooking.store_id),
                  date: oldDate,
                },
                {
                  $inc: { used_minutes: oldServiceDuration },
                },
                { session },
              );
            }

            await session.abortTransaction();
            session.endSession();

            throw new Error(
              `Cannot update booking: capacity exceeded for ${newDate.toISOString().split('T')[0]}. Available capacity: ${maxAllowedCapacity} minutes, would be used: ${usage.used_minutes} minutes.`,
            );
          }

          // 5️⃣ Update status log if overbooked
          let overbookedMinutes = 0;
          if (usage.used_minutes > totalCapacity) {
            overbookedMinutes = usage.used_minutes - totalCapacity;
          }

          if (overbookedMinutes > 0) {
            const overbookLog: BookingStatusLogDto = {
              status: existingBooking.booking_status,
              timestamp: new Date(),
              note: `Booking updated - overbooked by ${overbookedMinutes} minutes by ${user?.username || 'unknown'} (${user?.role || 'unknown'})`,
            };
            body.status_logs = [...status_logs, overbookLog];
          }
        }
      }

      // Prepare update data
      const updateData: any = { ...body };

      // Convert sessions[].groomer_id strings to ObjectId if sessions are provided
      if (body.sessions && body.sessions.length > 0) {
        updateData.sessions = body.sessions.map((s, index) => ({
          type: s.type,
          groomer_id: new Types.ObjectId(s.groomer_id),
          status: SessionStatus.NOT_STARTED,
          started_at: null,
          finished_at: null,
          notes: null,
          internal_note: null,
          order: s.order ?? index,
          media: [],
        }));
      }

      // update booking
      const updatedBooking = await this.bookingModel.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, session },
      );

      await session.commitTransaction();
      session.endSession();

      // Emit event for real-time report updates
      this.bookingEventsService.emit(id.toString());

      return updatedBooking;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  async remove(id: ObjectId) {
    const booking = await this.bookingModel.findByIdAndUpdate(id, {
      isDeleted: true,
      deletedAt: new Date(),
    });

    return booking;
  }

  async updateNote(id: ObjectId, note?: string) {
    const booking = await this.bookingModel.findByIdAndUpdate(
      id,
      {
        $set: { note: note || '' },
      },
      { new: true },
    );

    return booking;
  }

  async updateParentItems(
    id: ObjectId,
    parent_items?: { item?: string; item_in?: boolean; item_out?: boolean }[],
  ) {
    const normalized = (parent_items ?? []).map((it) => ({
      item: it?.item ?? '',
      item_in: it?.item_in ?? false,
      item_out: it?.item_out ?? false,
    }));

    const booking = await this.bookingModel.findByIdAndUpdate(
      id,
      {
        $set: { parent_items: normalized },
      },
      { new: true },
    );

    return booking;
  }

  async updateStatus(
    id: ObjectId,
    status: BookingStatus,
    note?: string,
    rescheduleData?: { date?: Date; end_date?: Date; time_range?: string },
    user?: { username: string; role: string },
    cancellation_reason?: string,
  ) {
    try {
      // Guard: booking dengan status returned tidak bisa diubah
      const existingBooking = await this.bookingModel.findById(id);
      if (!existingBooking || existingBooking.isDeleted) {
        throw new NotFoundException('Booking not found');
      }
      if (existingBooking.booking_status === BookingStatus.RETURNED) {
        throw new BadRequestException(
          "Booking dengan status 'returned' tidak dapat diubah lagi.",
        );
      }

      // status yang diupdate dari API ini hanya untuk CONFIRMED, RESCHEDULED, CANCELLED, GROOMER ON THE WAY, DRIVER ON THE WAY, RETURNED

      // validasi: jika status RESCHEDULED, date dan time_range harus ada
      if (status === BookingStatus.RESCHEDULED) {
        if (!rescheduleData?.date || !rescheduleData?.time_range) {
          throw new NotFoundException(
            'date and time_range are required for rescheduled status',
          );
        }
      }

      // Hotel-specific reschedule validation. Detect via the service_type snapshot
      // (already populated at create time) so we don't need to re-fetch the service.
      const snapshotTypeTitle = (existingBooking.service_snapshot as any)
        ?.service_type?.title as string | undefined;
      const isHotelBooking = isHotelServiceType(snapshotTypeTitle);
      if (status === BookingStatus.RESCHEDULED && isHotelBooking) {
        if (!rescheduleData?.end_date) {
          throw new BadRequestException(
            'end_date wajib diisi saat reschedule booking hotel',
          );
        }
        const sOnly = new Date(rescheduleData.date!);
        sOnly.setUTCHours(0, 0, 0, 0);
        const eOnly = new Date(rescheduleData.end_date);
        eOnly.setUTCHours(0, 0, 0, 0);
        if (eOnly.getTime() < sOnly.getTime()) {
          throw new BadRequestException(
            'end_date tidak boleh sebelum tanggal mulai',
          );
        }
      }

      // Daily store capacity is only tracked for grooming bookings. Non-grooming
      // bookings never wrote to StoreDailyUsage on create, so we must not adjust
      // it on reschedule/cancel either.
      const tracksCapacityStatus = isGroomingServiceType(snapshotTypeTitle);

      // Hitung service duration untuk keperluan update StoreDailyUsage
      const isBookingWithUsage =
        existingBooking.booking_status !== BookingStatus.WAITLIST &&
        existingBooking.booking_status !== BookingStatus.CANCELLED &&
        tracksCapacityStatus;

      let serviceDuration = 0;
      if (
        isBookingWithUsage &&
        (status === BookingStatus.CANCELLED ||
          status === BookingStatus.RESCHEDULED)
      ) {
        const service = await this.serviceModel.findById(
          existingBooking.service_id,
        );
        serviceDuration = Number(service?.duration) || 0;

        if (
          existingBooking.service_addon_ids &&
          existingBooking.service_addon_ids.length > 0
        ) {
          const addons = await this.serviceModel.find({
            _id: { $in: existingBooking.service_addon_ids },
          });
          serviceDuration += addons.reduce(
            (total, addon) => total + (Number(addon.duration) || 0),
            0,
          );
        }

        console.log(
          `[updateStatus] bookingId=${id}, currentStatus=${existingBooking.booking_status}, newStatus=${status}, serviceDuration=${serviceDuration}`,
        );
      }

      // Untuk RESCHEDULED: validasi kapasitas tanggal baru dan update StoreDailyUsage
      if (
        status === BookingStatus.RESCHEDULED &&
        rescheduleData &&
        isBookingWithUsage
      ) {
        const oldDate = existingBooking.date;
        const newDate = rescheduleData.date!;

        const store = await this.storeModel.findById(existingBooking.store_id);
        if (!store) throw new NotFoundException('Store not found');

        const targetDate = new Date(newDate);
        targetDate.setUTCHours(0, 0, 0, 0);
        const nextDay = new Date(targetDate);
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);

        const dailyOverride = await this.storeDailyCapacityModel.findOne({
          store_id: new ObjectId(existingBooking.store_id.toString()),
          date: { $gte: targetDate, $lt: nextDay },
        });

        const totalCapacity =
          dailyOverride?.total_capacity_minutes ??
          store.capacity.default_daily_capacity_minutes;
        const overbookingLimit = store.capacity.overbooking_limit_minutes;
        const maxAllowedCapacity = totalCapacity + overbookingLimit;

        // Baca usage tanggal baru saat ini (sebelum ada perubahan)
        const currentUsage = await this.storeDailyUsageModel.findOne({
          store_id: new ObjectId(existingBooking.store_id.toString()),
          date: { $gte: targetDate, $lt: nextDay },
        });
        const currentUsedMinutes = currentUsage?.used_minutes ?? 0;
        const remainingMinutes = maxAllowedCapacity - currentUsedMinutes;

        console.log(
          `[updateStatus-reschedule] targetDate=${targetDate.toISOString()}, currentUsedMinutes=${currentUsedMinutes}, maxAllowedCapacity=${maxAllowedCapacity}, remainingMinutes=${remainingMinutes}, serviceDuration=${serviceDuration}`,
        );

        // Validasi: apakah sisa kapasitas cukup untuk booking ini?
        if (serviceDuration > remainingMinutes) {
          throw new BadRequestException(
            `Tanggal ${new Date(newDate).toISOString().split('T')[0]} tidak memiliki kapasitas yang cukup. Sisa kapasitas ${remainingMinutes} menit, dibutuhkan ${serviceDuration} menit. Silakan pilih tanggal lain.`,
          );
        }

        // Kapasitas cukup — kurangi usage tanggal lama, tambah usage tanggal baru (hanya jika ada durasi)
        if (serviceDuration > 0) {
          // Kurangi old date: pakai range query agar cocok meskipun time component berbeda
          const oldDayStart = new Date(oldDate);
          oldDayStart.setUTCHours(0, 0, 0, 0);
          const oldDayEnd = new Date(oldDayStart);
          oldDayEnd.setUTCDate(oldDayEnd.getUTCDate() + 1);

          await this.storeDailyUsageModel.findOneAndUpdate(
            {
              store_id: new ObjectId(existingBooking.store_id.toString()),
              date: { $gte: oldDayStart, $lt: oldDayEnd },
            },
            { $inc: { used_minutes: -serviceDuration } },
          );

          // Tambah new date: update record yang sudah ditemukan saat validasi (by _id)
          // agar tidak buat record duplikat di hari yang sama dengan time berbeda
          if (currentUsage) {
            await this.storeDailyUsageModel.findByIdAndUpdate(
              (currentUsage as any)._id,
              { $inc: { used_minutes: serviceDuration } },
            );
          } else {
            // Tidak ada record untuk tanggal ini — buat baru di midnight UTC
            await this.storeDailyUsageModel.findOneAndUpdate(
              {
                store_id: new ObjectId(existingBooking.store_id.toString()),
                date: targetDate,
              },
              { $inc: { used_minutes: serviceDuration } },
              { upsert: true },
            );
          }
        }
      }

      // tambahkan log status baru
      const statusLog: BookingStatusLogDto = {
        status: status,
        timestamp: new Date(),
        note:
          note ||
          `Status updated to ${status} by ${user?.username || 'unknown'} (${user?.role || 'unknown'})`,
      };

      // simpan snapshot tanggal lama & baru di status log saat RESCHEDULED
      if (status === BookingStatus.RESCHEDULED && rescheduleData) {
        statusLog.previous_date = existingBooking.date;
        statusLog.previous_time_range = existingBooking.time_range;
        statusLog.new_date = rescheduleData.date;
        statusLog.new_time_range = rescheduleData.time_range;
        if (isHotelBooking) {
          (statusLog as any).previous_end_date =
            (existingBooking as any).end_date ?? existingBooking.date;
          (statusLog as any).new_end_date = rescheduleData.end_date;
        }
      }

      const updateData: any = {
        booking_status: status,
      };

      // sync analytics completed_at field with completion transitions
      if (status === BookingStatus.COMPLETED) {
        updateData.completed_at = new Date();
      } else if (existingBooking.booking_status === BookingStatus.COMPLETED) {
        updateData.completed_at = null;
      }

      // jika RESCHEDULED, tambahkan date, time_range, end_date ke update.
      // Hotel: end_date diset ke nilai baru dan harga di-recompute berdasarkan
      // jumlah malam baru. Non-hotel: end_date selalu mirror dari date.
      if (status === BookingStatus.RESCHEDULED && rescheduleData) {
        updateData.date = rescheduleData.date;
        updateData.time_range = rescheduleData.time_range;

        if (isHotelBooking) {
          updateData.end_date = rescheduleData.end_date;

          // Recompute hotel pricing: service.price (per-night, possibly
          // admin-edited) × new nights. Addon and travel fee stay as-is;
          // total_discount is preserved so prior benefit/promo amounts carry
          // over after the reschedule.
          const nights = computeHotelNights(
            rescheduleData.date!,
            rescheduleData.end_date!,
          );
          const unitPrice =
            (existingBooking as any).edited_service_price ??
            existingBooking.service_snapshot?.price ??
            0;
          const serviceBase = unitPrice * nights;
          const addonBase = (
            (existingBooking as any).edited_addon_prices ?? []
          ).reduce((sum: number, a: any) => sum + (a.price ?? 0), 0);
          // Fall back to snapshot addons when no admin overrides exist
          const fallbackAddonBase =
            (existingBooking as any).edited_addon_prices?.length > 0
              ? 0
              : (existingBooking.service_snapshot?.addons ?? []).reduce(
                  (sum: number, a: any) => sum + (a.price ?? 0),
                  0,
                );
          const subTotalService = serviceBase + addonBase + fallbackAddonBase;
          const travelFee =
            (existingBooking as any).edited_travel_fee ??
            existingBooking.travel_fee ??
            0;
          const newOriginalTotal = subTotalService + travelFee;
          const totalDiscount = existingBooking.total_discount ?? 0;
          updateData.sub_total_service = subTotalService;
          updateData.original_total_price = newOriginalTotal;
          updateData.final_total_price = Math.max(
            0,
            newOriginalTotal - totalDiscount,
          );
        } else {
          // Non-hotel: keep end_date in lock-step with start_date so the field
          // is always present and predictable for downstream consumers.
          updateData.end_date = rescheduleData.date;
        }
      }

      // jika CANCELLED, simpan cancellation_reason
      if (status === BookingStatus.CANCELLED) {
        updateData.cancellation_reason = cancellation_reason ?? null;
      }

      // update booking status dan tambahkan ke status logs
      const updatedBooking = await this.bookingModel.findByIdAndUpdate(
        id,
        {
          $set: updateData,
          $push: { status_logs: statusLog },
        },
        { new: true },
      );

      // Kurangi StoreDailyUsage saat booking di-cancel
      if (
        status === BookingStatus.CANCELLED &&
        isBookingWithUsage &&
        serviceDuration > 0
      ) {
        try {
          await this.storeDailyUsageModel.findOneAndUpdate(
            {
              store_id: new ObjectId(existingBooking.store_id.toString()),
              date: existingBooking.date,
            },
            { $inc: { used_minutes: -serviceDuration } },
          );
        } catch {
          // Non-fatal: tidak memblokir status update
        }
      }

      // Restore benefit usage when booking is cancelled (soft-delete all usages for this booking)
      if (
        status === BookingStatus.CANCELLED &&
        updatedBooking?.applied_benefits?.length
      ) {
        try {
          await this.benefitUsageService.softDeleteByBookingId(id.toString());
        } catch {
          // Non-fatal: restoration failure should not block status update
        }
      }

      if (
        status === BookingStatus.CANCELLED &&
        updatedBooking?.applied_promotions?.length
      ) {
        try {
          await this.promotionUsageService.softDeleteByBookingId(id.toString());
        } catch {
          // Non-fatal: restoration failure should not block status update
        }
      }

      return updatedBooking;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Public: Preview benefit application (no booking required).
   * Prices are resolved from the DB — no price input required from the client.
   */
  async previewApplyBenefits(
    petId: string,
    selectedBenefitIds: string[],
    storeId?: string,
    serviceId?: string,
    addOnIds?: string[],
    originalTotalPrice?: number,
    bookingDate?: Date,
    pickUp?: boolean,
    delivery?: boolean,
    excludeBookingId?: string,
  ): Promise<{
    applied_benefits: any[];
    total_discount: number;
    final_price: number;
    breakdown: Array<{
      benefit: {
        _id: string;
        label: string | null;
        service: { name: string } | null;
      };
      applies_to: string;
      benefit_type: string;
      benefit_period: string;
      benefit_value: number | null;
      base_price: number;
      amount_deducted: number;
      description: string | null;
    }>;
  }> {
    const emptyResult = () => ({
      applied_benefits: [],
      total_discount: 0,
      final_price: 0,
      breakdown: [],
    });

    if (!selectedBenefitIds || selectedBenefitIds.length === 0) {
      return emptyResult();
    }

    return await this.applyBenefitsToBooking(
      petId,
      selectedBenefitIds,
      storeId,
      serviceId,
      addOnIds,
      originalTotalPrice,
      bookingDate,
      pickUp,
      delivery,
      excludeBookingId,
    );
  }

  /**
   * Public: Preview promotion application.
   */
  async previewApplyPromotions(dto: {
    selected_promotion_ids: string[];
    service_id: string;
    addon_ids?: string[];
    original_service_price?: number;
    travel_fee?: number;
    grand_total?: number;
    pick_up?: boolean;
    delivery?: boolean;
    has_active_membership?: boolean;
    addon_prices?: { _id: string; name: string; price: number }[];
    customer_id?: string;
    pet_id?: string;
    booking_date?: string;
    exclude_booking_id?: string;
  }) {
    if (
      !dto.selected_promotion_ids ||
      dto.selected_promotion_ids.length === 0
    ) {
      return { applied_promotions: [], total_discount: 0, breakdown: [] };
    }

    return await this.applyPromotionsToBooking(dto.selected_promotion_ids, {
      serviceId: dto.service_id,
      addonIds: dto.addon_ids,
      pickUp: dto.pick_up,
      delivery: dto.delivery,
      hasActiveMembership: dto.has_active_membership ?? false,
      originalServicePrice: dto.original_service_price ?? 0,
      addonPrices: dto.addon_prices ?? [],
      travelFee: dto.travel_fee ?? 0,
      grandTotal: dto.grand_total ?? 0,
      customerId: dto.customer_id,
      petId: dto.pet_id,
      bookingDate: dto.booking_date ? new Date(dto.booking_date) : new Date(),
      excludeBookingId: dto.exclude_booking_id,
    });
  }

  /**
   * Update the pricing of a booking: override per-item prices and/or apply membership benefits.
   * Does NOT touch: schedule, capacity, snapshots, or booking status.
   */
  async updatePricing(
    id: ObjectId,
    dto: {
      service_id?: string;
      service_price?: number;
      service_discount?: number;
      travel_fee?: number; // backward compatibility - will be split into pickup + delivery
      travel_fee_discount?: number; // backward compatibility
      pickup_fee?: number;
      pickup_fee_discount?: number;
      delivery_fee?: number;
      delivery_fee_discount?: number;
      addon_prices?: { addon_id: string; price?: number; discount?: number }[];
      selected_benefit_ids?: string[];
      selected_promotion_ids?: string[];
      service_addon_ids?: string[];
      pick_up?: boolean;
      delivery?: boolean;
    },
  ) {
    const existing = await this.bookingModel.findById(id);
    if (!existing || existing.isDeleted) {
      throw new NotFoundException('Booking not found');
    }

    // Guard: booking dengan status returned tidak bisa diubah
    if (existing.booking_status === BookingStatus.RETURNED) {
      throw new BadRequestException(
        "Booking dengan status 'returned' tidak dapat diubah lagi.",
      );
    }

    // ── -1. Handle main service change ───────────────────────────────────────
    if (dto.service_id && dto.service_id !== existing.service_id?.toString()) {
      const newServiceObjectId = new ObjectId(dto.service_id);
      const pet = existing.pet_snapshot;
      const addonIdsForSnapshot = (dto.service_addon_ids ?? []).map(
        (aid) => new ObjectId(aid),
      );

      const newSnapshot = (await this.serviceService.getServiceSnapshot(
        newServiceObjectId,
        pet?.pet_type?._id ? new ObjectId(pet.pet_type._id) : undefined,
        pet?.size?._id ? new ObjectId(pet.size._id) : undefined,
        pet?.hair?._id ? new ObjectId(pet.hair._id) : undefined,
        addonIdsForSnapshot,
      )) as any;

      // Update service on the document (in-memory + DB)
      existing.service_id = new Types.ObjectId(dto.service_id) as any;
      existing.service_snapshot = newSnapshot;

      // Reset addons if no new addon_ids were provided together with the new service
      if (dto.service_addon_ids === undefined) {
        existing.service_addon_ids = [] as any;
      }

      await this.bookingModel.findByIdAndUpdate(id, {
        $set: {
          service_id: new Types.ObjectId(dto.service_id),
          service_snapshot: newSnapshot,
          service_addon_ids: (dto.service_addon_ids ?? []).map(
            (aid) => new Types.ObjectId(aid),
          ),
        },
      });

      this.logger.log(
        `[updatePricing] service changed to ${dto.service_id} for booking ${id}`,
      );
    }

    // ── 0. Handle addon changes (add/remove) ─────────────────────────────────
    if (dto.service_addon_ids !== undefined) {
      const serviceId = existing.service_id?.toString();
      if (serviceId) {
        // Re-snapshot addons from the service
        const pet = existing.pet_snapshot;
        const newSnapshot = (await this.serviceService.getServiceSnapshot(
          new ObjectId(serviceId),
          pet?.pet_type?._id ? new ObjectId(pet.pet_type._id) : undefined,
          pet?.size?._id ? new ObjectId(pet.size._id) : undefined,
          pet?.hair?._id ? new ObjectId(pet.hair._id) : undefined,
          dto.service_addon_ids.map((aid) => new ObjectId(aid)),
        )) as any;

        // Update service_addon_ids and service_snapshot with new addons
        existing.service_addon_ids = dto.service_addon_ids.map(
          (aid) => new Types.ObjectId(aid),
        ) as any;
        existing.service_snapshot = newSnapshot;

        await this.bookingModel.findByIdAndUpdate(id, {
          $set: {
            service_addon_ids: dto.service_addon_ids.map(
              (aid) => new Types.ObjectId(aid),
            ),
            service_snapshot: newSnapshot,
          },
        });
      }
    }

    // ── 1. Per-item base prices and item-level discounts ──────────────────────
    // Handle pick_up / delivery changes
    if (dto.pick_up !== undefined) {
      existing.pick_up = dto.pick_up;
    }
    if (dto.delivery !== undefined) {
      existing.delivery = dto.delivery;
    }

    // Hotel pricing: service base is per-night. Detect via the service_type
    // title snapshot; fall back to the live service when absent (older bookings
    // before the snapshot included the title).
    const snapshotServiceTypeTitle = (existing.service_snapshot as any)
      ?.service_type?.title as string | undefined;
    const isHotelPricing = isHotelServiceType(snapshotServiceTypeTitle);
    const pricingStart = existing.date;
    const pricingEnd = (existing as any).end_date ?? existing.date;
    const pricingNights = isHotelPricing
      ? computeHotelNights(pricingStart, pricingEnd)
      : 1;
    const svcUnit = dto.service_price ?? existing.service_snapshot.price ?? 0;
    const svcBase = isHotelPricing ? svcUnit * pricingNights : svcUnit;
    const svcDisc = dto.service_discount ?? 0;
    const svcEffective = Math.max(0, svcBase - svcDisc);

    // Handle pickup/delivery fees
    let pickupFeeBase = 0;
    let pickupFeeDisc = 0;
    let deliveryFeeBase = 0;
    let deliveryFeeDisc = 0;
    let tFeeBase = 0;
    let tFeeDisc = 0;

    // Use new separate fees if provided
    if (dto.pickup_fee !== undefined || dto.delivery_fee !== undefined) {
      pickupFeeBase = existing.pick_up
        ? (dto.pickup_fee ?? existing.pickup_fee ?? 0)
        : 0;
      pickupFeeDisc = existing.pick_up ? (dto.pickup_fee_discount ?? 0) : 0;
      deliveryFeeBase = existing.delivery
        ? (dto.delivery_fee ?? existing.delivery_fee ?? 0)
        : 0;
      deliveryFeeDisc = existing.delivery
        ? (dto.delivery_fee_discount ?? 0)
        : 0;
      tFeeBase = pickupFeeBase + deliveryFeeBase;
      tFeeDisc = pickupFeeDisc + deliveryFeeDisc;
    }
    // Fallback to old travel_fee for backward compatibility
    else if (dto.travel_fee !== undefined) {
      tFeeBase =
        existing.pick_up || existing.delivery
          ? (dto.travel_fee ?? existing.travel_fee ?? 0)
          : 0;
      tFeeDisc =
        existing.pick_up || existing.delivery
          ? (dto.travel_fee_discount ?? 0)
          : 0;
      // If using old travel_fee, split it between pickup and delivery if both are set
      if (existing.pick_up && existing.delivery) {
        pickupFeeBase = tFeeBase / 2;
        deliveryFeeBase = tFeeBase / 2;
        pickupFeeDisc = tFeeDisc / 2;
        deliveryFeeDisc = tFeeDisc / 2;
      } else if (existing.pick_up) {
        pickupFeeBase = tFeeBase;
        pickupFeeDisc = tFeeDisc;
      } else if (existing.delivery) {
        deliveryFeeBase = tFeeBase;
        deliveryFeeDisc = tFeeDisc;
      }
    }
    // No fees provided, use existing
    else {
      pickupFeeBase = existing.pickup_fee ?? 0;
      deliveryFeeBase = existing.delivery_fee ?? 0;
      tFeeBase = existing.travel_fee ?? pickupFeeBase + deliveryFeeBase;
    }

    const pickupFeeEffective = Math.max(0, pickupFeeBase - pickupFeeDisc);
    const deliveryFeeEffective = Math.max(0, deliveryFeeBase - deliveryFeeDisc);
    const tFeeEffective = pickupFeeEffective + deliveryFeeEffective;

    const addonItems = (existing.service_snapshot.addons ?? []).map((addon) => {
      const entry = dto.addon_prices?.find(
        (a) => a.addon_id === addon._id?.toString(),
      );
      const base = entry?.price ?? addon.price ?? 0;
      const disc = entry?.discount ?? 0;
      return {
        addon_id: addon._id?.toString() ?? '',
        base,
        disc,
        effective: Math.max(0, base - disc),
      };
    });
    const addonBaseTotal = addonItems.reduce((s, a) => s + a.base, 0);
    const addonEffective = addonItems.reduce((s, a) => s + a.effective, 0);

    // original_total_price = sum of base prices (before any discounts)
    const newOriginalTotal = svcBase + tFeeBase + addonBaseTotal;
    // item-level discount total
    const itemDiscountTotal =
      svcDisc + tFeeDisc + addonItems.reduce((s, a) => s + a.disc, 0);
    // effective subtotal used as the base for membership benefit calculation
    const effectiveSubtotal = svcEffective + tFeeEffective + addonEffective;

    // ── 2. Apply membership benefits on the effective subtotal ────────────────
    const selectedBenefitIds = dto.selected_benefit_ids ?? [];
    const petId = existing.pet_id.toString();
    const storeId = existing.store_id?.toString();
    const serviceId = existing.service_id?.toString();
    const addonIds = (existing.service_addon_ids ?? []).map((i) =>
      i.toString(),
    );
    const bookingDate = existing.date;

    this.logger.log(
      `[updatePricing] booking=${id}, petId=${petId}, serviceId=${serviceId}, ` +
        `storeId=${storeId}, addonIds=[${addonIds}], bookingDate=${bookingDate}, ` +
        `selectedBenefitIds=[${selectedBenefitIds}], effectiveSubtotal=${effectiveSubtotal}`,
    );

    // ── 2a. Release old benefit usages BEFORE re-applying ─────────────────────
    // This ensures the usage count is fresh so can_apply is accurate
    await this.benefitUsageService.softDeleteByBookingId(id.toString());

    // ── 2a-2. Release old promotion usages BEFORE re-applying ─────────────────
    // This ensures limit checks are accurate and uncheck restores the slot
    await this.promotionUsageService.softDeleteByBookingId(id.toString());

    let benefitResult: {
      applied_benefits: any[];
      total_discount: number;
      final_price: number;
      breakdown: any[];
    };

    if (selectedBenefitIds.length > 0) {
      try {
        benefitResult = await this.applyBenefitsToBooking(
          petId,
          selectedBenefitIds,
          storeId,
          serviceId,
          addonIds,
          effectiveSubtotal,
          bookingDate,
          existing.pick_up === true,
          existing.delivery === true,
          id.toString(), // excludeBookingId: belt-and-suspenders safety
        );
      } catch (err) {
        this.logger.error(
          `[updatePricing] applyBenefitsToBooking THREW for booking ${id}:`,
          err instanceof Error ? err.stack : err,
        );
        benefitResult = {
          applied_benefits: [],
          total_discount: 0,
          final_price: effectiveSubtotal,
          breakdown: [],
        };
      }
    } else {
      benefitResult = {
        applied_benefits: [],
        total_discount: 0,
        final_price: effectiveSubtotal,
        breakdown: [],
      };
    }

    // total_discount = item discounts + membership benefit discounts + promotion discounts
    // ── 2b. Apply promotions ──────────────────────────────────────────────────
    const selectedPromotionIds = dto.selected_promotion_ids ?? [];

    let promotionResult: {
      applied_promotions: any[];
      total_discount: number;
      breakdown: any[];
    } = { applied_promotions: [], total_discount: 0, breakdown: [] };

    if (selectedPromotionIds.length > 0) {
      try {
        const promoAddonPrices = addonItems.map((a) => ({
          _id: a.addon_id,
          name:
            existing.service_snapshot?.addons?.find(
              (sn: any) => sn._id?.toString() === a.addon_id,
            )?.name ?? '',
          price: a.base, // use edited base price, not the post-discount effective
        }));

        promotionResult = await this.applyPromotionsToBooking(
          selectedPromotionIds,
          {
            serviceId,
            addonIds,
            pickUp: existing.pick_up === true,
            delivery: existing.delivery === true,
            hasActiveMembership: selectedBenefitIds.length > 0,
            originalServicePrice: svcBase, // before admin service discount
            addonPrices: promoAddonPrices,
            travelFee: tFeeBase, // before admin travel-fee discount
            grandTotal: newOriginalTotal, // sum of all base prices before discounts
            customerId: existing.customer_id?.toString(),
            petId: existing.pet_id?.toString(),
            bookingDate: bookingDate ? new Date(bookingDate) : new Date(),
            excludeBookingId: id.toString(), // belt-and-suspenders: already soft-deleted above
          },
        );
      } catch (err) {
        this.logger.error(
          `[updatePricing] applyPromotionsToBooking THREW for booking ${id}:`,
          err instanceof Error ? err.stack : err,
        );
      }
    }

    const totalDiscount =
      itemDiscountTotal +
      benefitResult.total_discount +
      promotionResult.total_discount;
    const finalTotalPrice = Math.max(0, newOriginalTotal - totalDiscount);

    this.logger.log(
      `[updatePricing] booking=${id}: itemDiscount=${itemDiscountTotal}, ` +
        `benefitDiscount=${benefitResult.total_discount}, ` +
        `promotionDiscount=${promotionResult.total_discount}, totalDiscount=${totalDiscount}, ` +
        `originalTotal=${newOriginalTotal}, finalTotal=${finalTotalPrice}, ` +
        `appliedBenefits=${benefitResult.applied_benefits.length}, ` +
        `appliedPromotions=${promotionResult.applied_promotions.length}`,
    );

    // ── 3. Persist update ─────────────────────────────────────────────────────
    await this.bookingModel.findByIdAndUpdate(
      id,
      {
        $set: {
          pick_up: existing.pick_up,
          delivery: existing.delivery,
          pickup_fee: pickupFeeBase,
          delivery_fee: deliveryFeeBase,
          travel_fee: tFeeBase, // backward compatibility
          original_total_price: newOriginalTotal,
          selected_benefit_ids: selectedBenefitIds.map(
            (sid) => new Types.ObjectId(sid),
          ),
          applied_benefits: benefitResult.breakdown,
          selected_promotion_ids: selectedPromotionIds.map(
            (sid) => new Types.ObjectId(sid),
          ),
          applied_promotions: promotionResult.breakdown,
          total_discount: totalDiscount,
          final_total_price: finalTotalPrice,
          edited_service_price: dto.service_price ?? null,
          edited_service_discount: svcDisc > 0 ? svcDisc : null,
          edited_travel_fee:
            existing.pick_up || existing.delivery
              ? (dto.travel_fee ?? null)
              : null,
          edited_travel_fee_discount:
            (existing.pick_up || existing.delivery) && tFeeDisc > 0
              ? tFeeDisc
              : null,
          edited_addon_prices: addonItems
            .filter((a) => {
              const snapshotAddon = (
                existing.service_snapshot.addons ?? []
              ).find((sa) => sa._id?.toString() === a.addon_id);
              return a.disc > 0 || a.base !== (snapshotAddon?.price ?? 0);
            })
            .map((a) => {
              const snapshotAddon = (
                existing.service_snapshot.addons ?? []
              ).find((sa) => sa._id?.toString() === a.addon_id);
              const priceChanged = a.base !== (snapshotAddon?.price ?? 0);
              return {
                addon_id: a.addon_id,
                price: priceChanged ? a.base : undefined,
                discount: a.disc || undefined,
              };
            }),
        },
      },
      { new: true },
    );

    // ── 5. Record new benefit usages ──────────────────────────────────────────
    if (benefitResult.applied_benefits.length > 0) {
      const bDate = new Date(bookingDate);
      const bookingIdStr = id.toString();
      for (const applied of benefitResult.applied_benefits) {
        if (applied.pet_membership_id && applied.benefit_id) {
          try {
            await this.benefitUsageService.recordUsage({
              pet_membership_id: applied.pet_membership_id,
              benefit_id: applied.benefit_id.toString(),
              booking_id: bookingIdStr,
              target_id: bookingIdStr,
              amount_used: 1,
              booking_date: bDate,
              period_key: BenefitUsageService.computePeriodKey(
                bDate,
                applied.benefit_period,
              ),
              benefit_period: applied.benefit_period,
            });
          } catch (err) {
            this.logger.error(
              `[updatePricing] recordUsage failed for benefit ${applied.benefit_id}, booking=${id}: ${err}`,
            );
          }
        }
      }
    }

    // ── 6. Record new promotion usages ────────────────────────────────────────
    if (promotionResult.applied_promotions.length > 0) {
      const bDate = new Date(bookingDate);
      const bookingIdStr = id.toString();
      const customerId = existing.customer_id?.toString();
      const petIdStr = existing.pet_id?.toString();
      for (const applied of promotionResult.applied_promotions) {
        try {
          await this.promotionUsageService.recordUsage({
            promotionId: applied.promotion_id.toString(),
            bookingId: bookingIdStr,
            bookingDate: bDate,
            limitType: applied.limit_type,
            usagePeriod: applied.usage_period,
            userId: customerId,
            petId: petIdStr,
          });
        } catch (err) {
          this.logger.error(
            `[updatePricing] recordUsage failed for promotion ${applied.promotion_id}, booking=${id}: ${err}`,
          );
        }
      }
    }

    return {
      message: 'Pricing updated successfully',
      total_discount: totalDiscount,
      final_total_price: finalTotalPrice,
      applied_benefits_count: benefitResult.applied_benefits.length,
      applied_promotions_count: promotionResult.applied_promotions.length,
    };
  }

  /**
   * Get daily usage statistics for admin dashboard
   * Returns usage data per store per day with capacity information
   */
  async getDailyUsages(query: GetDailyUsagesDto): Promise<any> {
    try {
      // Build query filter
      const filter: any = {};

      if (query.store_id) {
        filter.store_id = new Types.ObjectId(query.store_id);
      }

      if (query.date) {
        // Single date filter
        const targetDate = new Date(query.date);
        targetDate.setUTCHours(0, 0, 0, 0);
        const nextDay = new Date(targetDate);
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
        filter.date = { $gte: targetDate, $lt: nextDay };
      } else if (query.start_date || query.end_date) {
        // Date range filter
        filter.date = {};
        if (query.start_date) {
          const startDate = new Date(query.start_date);
          startDate.setUTCHours(0, 0, 0, 0);
          filter.date.$gte = startDate;
        }
        if (query.end_date) {
          const endDate = new Date(query.end_date);
          endDate.setUTCHours(23, 59, 59, 999);
          filter.date.$lte = endDate;
        }
      }

      // Fetch usage records
      const usageRecords = await this.storeDailyUsageModel
        .find(filter)
        .sort({ date: -1, store_id: 1 })
        .exec();

      // Process each usage record to calculate capacity and percentages
      const results = await Promise.all(
        usageRecords.map(async (usage) => {
          // Fetch store manually
          const store = await this.storeModel.findById(usage.store_id).exec();
          if (!store) {
            return null;
          }

          // Store the store_id
          const storeId = usage.store_id.toString();

          // Get capacity override for this date, if any
          const usageDate = new Date(usage.date);
          usageDate.setUTCHours(0, 0, 0, 0);
          const nextDay = new Date(usageDate);
          nextDay.setUTCDate(nextDay.getUTCDate() + 1);

          const capacityOverride = await this.storeDailyCapacityModel
            .findOne({
              store_id: new Types.ObjectId(storeId),
              date: { $gte: usageDate, $lt: nextDay },
            })
            .exec();

          // Determine total capacity (override or default)
          let totalCapacityMinutes =
            store.capacity?.default_daily_capacity_minutes || 960;

          if (capacityOverride) {
            totalCapacityMinutes = capacityOverride.total_capacity_minutes;
          }

          const overbookingLimit =
            store.capacity?.overbooking_limit_minutes || 120;
          const maxCapacity = totalCapacityMinutes + overbookingLimit;

          // Calculate metrics
          const usedMinutes = usage.used_minutes || 0;
          const remainingMinutes = Math.max(
            0,
            totalCapacityMinutes - usedMinutes,
          );
          // Calculate percentage with exactly 2 decimals without rounding
          const rawPercentage =
            totalCapacityMinutes > 0
              ? (usedMinutes / totalCapacityMinutes) * 100
              : 0;
          const usagePercentage = Math.floor(rawPercentage * 100) / 100;
          const isOverbooked = usedMinutes > totalCapacityMinutes;
          const isAtCapacity = usedMinutes >= maxCapacity;

          return {
            _id: usage._id,
            store_id: storeId,
            store_name: store.name,
            store_code: store.code,
            date: usage.date,
            used_minutes: usedMinutes,
            total_capacity_minutes: totalCapacityMinutes,
            remaining_minutes: remainingMinutes,
            overbooking_limit_minutes: overbookingLimit,
            max_capacity_minutes: maxCapacity,
            usage_percentage: usagePercentage,
            is_overbooked: isOverbooked,
            is_at_capacity: isAtCapacity,
            has_capacity_override: !!capacityOverride,
            capacity_notes: capacityOverride?.notes || null,
          };
        }),
      );

      // Filter out null results (stores not found)
      const validResults = results.filter((r) => r !== null);

      return {
        count: validResults.length,
        data: validResults,
      };
    } catch (error: any) {
      this.logger.error(`Error fetching daily usages: ${error.message}`);
      throw error;
    }
  }
}
