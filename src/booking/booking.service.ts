import {
  Injectable,
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

@Injectable()
export class BookingService {
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
    @InjectConnection()
    private readonly connection: Connection,
    private readonly petService: PetService,
    private readonly serviceService: ServiceService,
    private readonly petMembershipService: PetMembershipService,
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

      // 4. Resolve pick-up zone early (travel_fee is needed as discount base for pickup benefits)
      let pickUpResult: {
        is_available: boolean;
        zone: {
          area_name: string;
          min_radius_km: number;
          max_radius_km: number;
          travel_time_minutes: number;
          travel_fee: number;
        };
        distance_km: number;
      } | null = null;

      if (dto.pick_up === true) {
        if (!dto.store_id) {
          throw new BadRequestException(
            'store_id is required when pick_up is true',
          );
        }
        if (!dto.customer_id) {
          throw new BadRequestException(
            'customer_id is required when pick_up is true',
          );
        }

        const store = await this.storeModel.findOne({
          _id: new ObjectId(dto.store_id),
          isDeleted: false,
        });
        if (!store) {
          throw new NotFoundException('Store not found');
        }
        if (!store.is_pick_up_available) {
          throw new BadRequestException(
            'Pick-up service is not available for this store',
          );
        }

        const customer = await this.userModel
          .findById(new ObjectId(dto.customer_id))
          .select('profile.addresses')
          .lean();
        if (!customer) {
          throw new NotFoundException('Customer not found');
        }

        // Find main address
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
            'Customer profile must have location (latitude/longitude) to use pick-up service',
          );
        }
        const lat = mainAddress.latitude;
        const lon = mainAddress.longitude;

        // findPickUpZone validates store.location is properly set before we access it
        const matchedZone = await this.findPickUpZone(store, lat, lon);

        const distanceKm = this.calculateDistance(
          lat,
          lon,
          store.location!.latitude!,
          store.location!.longitude!,
        );

        pickUpResult = {
          is_available: true,
          zone: {
            area_name: matchedZone.area_name,
            min_radius_km: matchedZone.min_radius_km,
            max_radius_km: matchedZone.max_radius_km,
            travel_time_minutes: matchedZone.travel_time_minutes,
            travel_fee: matchedZone.travel_fee,
          },
          distance_km: +distanceKm.toFixed(2),
        };
      }

      const travelFee = pickUpResult?.zone.travel_fee ?? 0;

      // 5. Get available benefits filtered by context:
      //    - applies_to 'service' → only benefit whose service_id matches dto.service_id
      //    - applies_to 'addon'   → only benefit whose service_id is in dto.addon_ids (skipped when no addons)
      //    - applies_to 'pickup'  → only when pick_up is true
      const membershipData =
        await this.petMembershipService.getAvailableBenefits(dto.pet_id);

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
                return bServiceId === dto.service_id.toString();
              }
              if (b.applies_to === 'addon') {
                return hasAddons && addonIdSet.has(bServiceId);
              }
              if (b.applies_to === 'pickup') {
                return dto.pick_up === true;
              }
              return false;
            })
            .map((b: any) => {
              // Determine price base for this benefit type
              let discountBase = 0;
              if (b.applies_to === 'service') {
                discountBase = originalPrice;
              } else if (b.applies_to === 'addon') {
                const matchingAddon = addonPrices.find(
                  (a) => a._id.toString() === b.service_id?.toString(),
                );
                discountBase = matchingAddon?.price ?? 0;
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
                amount_discount:
                  b.can_apply && b.type === 'discount'
                    ? (b.value / 100) * discountBase
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

      // 7. Build response
      const response: any = {
        pet_id: dto.pet_id,
        pet_name: pet.name,
        service_id: dto.service_id,
        service_name: service.name,
        pricing: {
          original_service_price: originalPrice,
          addon_prices: addonPrices,
          subtotal_before_benefits: subtotalBeforeBenefits,
          has_active_membership: hasActiveMembership,
          available_benefits: availableBenefits,
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
          travel_fee: travelFee,
          grand_total: grandTotal,
          discount: estimatedTotalDiscount,
          final: estimatedFinalPrice,
        },
      };

      if (pickUpResult !== null) {
        response.pick_up = pickUpResult;
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
        : `${benefit.service.name}`;

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
    subtotalPrice: number,
  ): Promise<{
    applied_benefits: any[];
    total_discount: number;
    final_price: number;
  }> {
    const appliedBenefits: any[] = [];
    let totalDiscount = 0;

    // If no benefits selected or no membership, return original price
    if (!selectedBenefitIds || selectedBenefitIds.length === 0) {
      return {
        applied_benefits: [],
        total_discount: 0,
        final_price: subtotalPrice,
      };
    }

    // Get available benefits for the pet
    const membershipData =
      await this.petMembershipService.getAvailableBenefits(petId);

    if (!membershipData.has_active_membership) {
      return {
        applied_benefits: [],
        total_discount: 0,
        final_price: subtotalPrice,
      };
    }

    // Apply each selected benefit
    for (const benefitId of selectedBenefitIds) {
      const benefit = membershipData.benefits.find(
        (b: any) => b._id === benefitId,
      );

      if (!benefit) {
        continue; // Skip if benefit not found
      }

      // Check if benefit can be applied
      if (!benefit.can_apply) {
        continue; // Skip if benefit cannot be applied
      }

      let discountAmount = 0;

      // Calculate discount based on benefit type
      if (benefit.type === 'discount') {
        discountAmount = (benefit.value / 100) * subtotalPrice;
      }
      // quota type = free sessions counter; no monetary deduction

      if (discountAmount > 0) {
        totalDiscount += discountAmount;

        appliedBenefits.push({
          benefit_id: new Types.ObjectId(benefitId),
          benefit_type: benefit.type,
          benefit_period: benefit.period,
          benefit_value: benefit.value,
          amount_deducted: discountAmount,
          applied_at: new Date(),
        });
      }
    }

    const finalPrice = Math.max(0, subtotalPrice - totalDiscount);

    return {
      applied_benefits: appliedBenefits,
      total_discount: totalDiscount,
      final_price: finalPrice,
    };
  }

  /**
   * Find matching zone for pick-up based on customer location and store zones
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

    // Find zone that matches the distance
    const matchingZone = store.zones?.find(
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

      // 4. handle pick-up service validation and zone matching
      let pickUpZone = null;
      if (body.pick_up) {
        // 4.1 get customer location from profile
        const customer = await this.userModel.findById(body.customer_id);

        const addresses = (customer as any).profile?.addresses || [];
        let mainAddress = addresses.find((a: any) => a.is_main_address);
        if (!mainAddress && addresses.length > 0) {
          mainAddress = addresses[0];
        }
        if (!mainAddress || !mainAddress.latitude || !mainAddress.longitude) {
          throw new BadRequestException(
            'Customer profile must have location (latitude/longitude) to use pick-up service',
          );
        }

        // 4.2 check if store and service support pick-up
        if (!store.is_pick_up_available) {
          throw new BadRequestException(
            'This store does not support pick-up service',
          );
        }

        const serviceDoc = await this.serviceModel.findById(body.service_id);
        if (!serviceDoc?.is_pick_up_available) {
          throw new BadRequestException(
            'This service does not support pick-up',
          );
        }

        pickUpZone = await this.findPickUpZone(
          store,
          mainAddress.latitude,
          mainAddress.longitude,
        );
      }

      // 5. attach pick_up_zone to booking if determined
      if (pickUpZone) {
        (body as any).pick_up_zone = pickUpZone;
      }

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
        (body.sub_total_service || 0) + (body.travel_fee || 0);
      body.original_total_price = originalTotalPrice;

      // 9. apply benefits if selected
      let appliedBenefitsData: any = {
        applied_benefits: [],
        total_discount: 0,
        final_price: originalTotalPrice,
      };

      if (body.selected_benefit_ids && body.selected_benefit_ids.length > 0) {
        appliedBenefitsData = await this.applyBenefitsToBooking(
          body.pet_id,
          body.selected_benefit_ids,
          originalTotalPrice,
        );
      }

      body.final_total_price = appliedBenefitsData.final_price;
      body.total_price = appliedBenefitsData.final_price; // For backward compatibility
      (body as any).applied_benefits = appliedBenefitsData.applied_benefits;

      // 10. assign body.type base on service.service_location_type
      body.type = service.service_location_type as GroomingType;

      // 11. auto-generate sessions from service.sessions array for all booking types
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
      const dailyOverride = await this.storeDailyCapacityModel
        .findOne({
          store_id: new ObjectId(body.store_id),
          date: new Date(body.date),
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

      const booking = await this.bookingModel.create([body], { session });

      await session.commitTransaction();
      session.endSession();

      return booking[0];
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  async findAll() {
    const bookings = await this.bookingModel
      .find({ isDeleted: false })
      .populate('customer', 'username email phone_number')
      .populate('store', 'name')
      .exec();

    return bookings;
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
      const originalTotalPriceGuest =
        (body.sub_total_service || 0) + (body.travel_fee || 0);
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
            originalTotalPriceGuest,
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

      body.final_total_price = appliedBenefitsDataGuest.final_price;
      body.total_price = appliedBenefitsDataGuest.final_price; // For backward compatibility
      (body as any).applied_benefits =
        appliedBenefitsDataGuest.applied_benefits;

      // assign body.type base on service.service_location_type
      body.type = service.service_location_type as GroomingType;

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

        const dailyOverride = await this.storeDailyCapacityModel
          .findOne({
            store_id: new ObjectId(body.store_id),
            date: newDate,
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
      // status yang diupdate dari API ini hanya untuk CONFIRMED, RESCHEDULED, CANCELLED, GROOMER ON THE WAY, DRIVER ON THE WAY

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

      return updatedBooking;
    } catch (error) {
      throw error;
    }
  }
}
