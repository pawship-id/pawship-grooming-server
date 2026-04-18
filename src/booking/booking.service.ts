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
import { ListBookingsDto } from './dto/list-bookings.dto';
import {
  ListGroomerMyJobsDto,
  ListGroomerOpenJobsDto,
} from './dto/list-groomer-bookings.dto';
import { GetDailyUsagesDto } from './dto/get-daily-usages.dto';

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

      let originalPrice = service.price || 0;
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
                used: b.used,
                remaining: b.remaining,
                can_apply: b.can_apply,
                period_reset_date: b.period_reset_date,
                next_reset_date: b.next_reset_date,
                amount_discount: b.can_apply
                  ? b.type === 'discount'
                    ? (b.value / 100) * discountBase
                    : discountBase // quota = full base price is free
                  : 0,
                description: this.getBenefitDescription(b),
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
        pricing: {
          original_service_price: originalPrice,
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
  private getBenefitDescription(benefit: any): string {
    const typeLabel =
      {
        discount: 'Discount',
        quota: 'Free Sessions',
      }[benefit.type] || 'Benefit';

    const valueStr =
      benefit.type === 'discount'
        ? `${benefit.value}%`
        : `${benefit.service?.name ?? benefit.label ?? 'Free'}`;

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
            addonDiscount = (benefit.value / 100) * addonBasePrice;
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
        discountAmount = (benefit.value / 100) * basePrice;
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

    const distance = this.calculateDistance(
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
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // 1. get pet snapshot
      const pet = await this.petService.getPetSnapshot(
        new ObjectId(body.pet_id),
      );

      body.pet_snapshot = {
        ...pet,
        _id: pet._id.toString(),
      };

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

      // 8. calculate service and addons price
      body.sub_total_service = service.price + addonsTotal;
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
            originalServicePrice: service.price,
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
        (body as any).sessions = service.sessions.map((sessionType, index) => ({
          type: sessionType,
          groomer_id: null,
          status: SessionStatus.NOT_STARTED,
          started_at: null,
          finished_at: null,
          notes: null,
          internal_note: null,
          order: index,
        }));
      } else {
        (body as any).sessions = [];
      }

      // 12. get capacity by store_id and date (override or default)
      const targetDate = new Date(body.date);
      targetDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);

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
      let overbookedMinutes = 0;

      if (usage.used_minutes > totalCapacity) {
        overbookedMinutes = usage.used_minutes - totalCapacity;
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

          if (
            limitType !== PromotionLimitType.NONE &&
            typeof maxUsage === 'number' &&
            maxUsage > 0
          ) {
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
          } else {
            this.logger.log(
              `[recordPromotionUsage] Skipping promo ${applied.code} - no limit configured (limitType=${limitType}, maxUsage=${maxUsage})`,
            );
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
   * Only returns confirmed/arrived bookings.
   * Filters by groomer's store placement and matches sessions by skill name
   * (case-insensitive, name-based — IDs are not compared).
   */
  async getGroomerOpenJobs(
    groomerId: ObjectId,
    query: ListGroomerOpenJobsDto = {},
  ) {
    const { page = 1, limit = 20 } = query;

    // Look up groomer's placement (store) and skills
    const groomer = await this.userModel
      .findById(groomerId)
      .select('profile.placement profile.groomer_skills')
      .lean();
    const groomerStoreId = groomer?.profile?.placement;
    const groomerSkills: string[] = groomer?.profile?.groomer_skills || [];

    const filter: any = {
      isDeleted: false,
      booking_status: {
        $in: [
          BookingStatus.CONFIRMED,
          BookingStatus.ARRIVED,
          BookingStatus.IN_PROGRESS,
        ],
      },
    };

    // Filter by groomer's store if they have a placement.
    // store_id in some bookings may be stored as a string (not ObjectId),
    // so we match against both the ObjectId and its string representation.
    if (groomerStoreId) {
      filter.store_id = {
        $in: [groomerStoreId, groomerStoreId.toString()],
      };
    }

    // Build session $elemMatch: unclaimed + matching groomer's skills (by name, case-insensitive)
    const elemMatchFilter: any = { groomer_id: null };
    if (groomerSkills.length > 0) {
      const skillsRegex = groomerSkills.map(
        (skill) =>
          new RegExp(`^${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      );
      elemMatchFilter.type = { $in: skillsRegex };
    }
    filter.sessions = { $elemMatch: elemMatchFilter };

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

    return { bookings, total, page, limit };
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
      store_id,
    } = query;

    const filter: any = { isDeleted: false };

    if (status) {
      filter.booking_status = status;
    }

    if (date_from || date_to) {
      filter.date = {};
      if (date_from) filter.date.$gte = date_from;
      if (date_to) filter.date.$lte = date_to;
    }

    if (created_by_role) {
      filter.created_by_role = created_by_role;
    }

    if (customer_id) {
      filter.customer_id = customer_id;
    }

    if (store_id) {
      filter.store_id = store_id;
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
        .exec(),
      this.bookingModel.countDocuments(filter),
    ]);

    return { bookings, total, page, limit };
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

      body.pet_snapshot = {
        ...pet,
        _id: pet._id.toString(),
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

      body.sub_total_service = service.price + addonsTotal;
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

      // If date or duration changed, update capacity tracking
      if (dateChanged || durationChanged) {
        // 1️⃣ Rollback old capacity usage
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

        // 2️⃣ Get store and check new capacity
        const store = await this.storeModel
          .findById(body.store_id)
          .session(session);

        if (!store) throw new NotFoundException('Store not found');

        const targetDate = new Date(newDate);
        targetDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);

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

          // Restore old capacity usage
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

  async updateStatus(
    id: ObjectId,
    status: BookingStatus,
    note?: string,
    rescheduleData?: { date?: Date; time_range?: string },
    user?: { username: string; role: string },
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

      // tambahkan log status baru
      const statusLog: BookingStatusLogDto = {
        status: status,
        timestamp: new Date(),
        note:
          note ||
          `Status updated to ${status} by ${user?.username || 'unknown'} (${user?.role || 'unknown'})`,
      };

      // prepare update data
      const updateData: any = {
        booking_status: status,
      };

      // jika RESCHEDULED, tambahkan date dan time_range ke update
      if (status === BookingStatus.RESCHEDULED && rescheduleData) {
        updateData.date = rescheduleData.date;
        updateData.time_range = rescheduleData.time_range;
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

    // ── 0. Handle addon changes (add/remove) ─────────────────────────────────
    if (dto.service_addon_ids !== undefined) {
      const serviceId = existing.service_id?.toString();
      if (serviceId) {
        // Re-snapshot addons from the service
        const pet = existing.pet_snapshot;
        const newSnapshot =
          (await this.serviceService.getServiceSnapshot(
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

    const svcBase = dto.service_price ?? existing.service_snapshot.price ?? 0;
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
          edited_addon_prices: addonItems.map((a) => ({
            addon_id: a.addon_id,
            price: a.base,
            discount: a.disc,
          })),
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
        targetDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);
        filter.date = { $gte: targetDate, $lt: nextDay };
      } else if (query.start_date || query.end_date) {
        // Date range filter
        filter.date = {};
        if (query.start_date) {
          const startDate = new Date(query.start_date);
          startDate.setHours(0, 0, 0, 0);
          filter.date.$gte = startDate;
        }
        if (query.end_date) {
          const endDate = new Date(query.end_date);
          endDate.setHours(23, 59, 59, 999);
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
          usageDate.setHours(0, 0, 0, 0);
          const nextDay = new Date(usageDate);
          nextDay.setDate(nextDay.getDate() + 1);

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
    } catch (error) {
      this.logger.error(`Error fetching daily usages: ${error.message}`);
      throw error;
    }
  }
}
