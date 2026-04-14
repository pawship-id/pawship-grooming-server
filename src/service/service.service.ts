import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { GetServicesQueryDto } from './dto/get-services-query.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Service, ServiceDocument } from './entities/service.entity';
import { ObjectId } from 'mongodb';
import { capitalizeWords } from 'src/helpers/string.helper';
import { Option, OptionDocument } from 'src/option/entities/option.entity';
import { Store, StoreDocument } from 'src/store/entities/store.entity';
import {
  ServiceType,
  ServiceTypeDocument,
} from 'src/service-type/entities/service-type.entity';

@Injectable()
export class ServiceService {
  constructor(
    @InjectModel(Service.name)
    private readonly serviceModel: Model<ServiceDocument>,
    @InjectModel(Option.name)
    private readonly optionModel: Model<OptionDocument>,
    @InjectModel(Store.name)
    private readonly storeModel: Model<StoreDocument>,
    @InjectModel(ServiceType.name)
    private readonly serviceTypeModel: Model<ServiceTypeDocument>,
  ) {}

  private async isAddonServiceType(serviceTypeId: string): Promise<boolean> {
    const st = await this.serviceTypeModel
      .findById(serviceTypeId)
      .select('title')
      .lean();
    return !!st && st.title.toLowerCase().includes('addon');
  }

  async create(body: CreateServiceDto) {
    const isAddon = await this.isAddonServiceType(body.service_type_id);
    if (!isAddon && (!body.sessions || body.sessions.length === 0)) {
      throw new BadRequestException(
        'sessions must contain at least 1 item for non-addon service types',
      );
    }

    try {
      body.name = capitalizeWords(body.name);

      // Convert service_type_id to ObjectId
      const serviceData: any = {
        ...body,
        service_type_id: new Types.ObjectId(body.service_type_id),
      };

      // Convert array of IDs to ObjectId arrays if they exist
      if (body.pet_type_ids && body.pet_type_ids.length > 0) {
        serviceData.pet_type_ids = body.pet_type_ids.map(
          (id) => new Types.ObjectId(id),
        );
      }
      if (body.size_category_ids && body.size_category_ids.length > 0) {
        serviceData.size_category_ids = body.size_category_ids.map(
          (id) => new Types.ObjectId(id),
        );
      }
      if (body.hair_category_ids && body.hair_category_ids.length > 0) {
        serviceData.hair_category_ids = body.hair_category_ids.map(
          (id) => new Types.ObjectId(id),
        );
      }
      if (body.addon_ids && body.addon_ids.length > 0) {
        serviceData.addon_ids = body.addon_ids.map((id) => new Types.ObjectId(id));
      }
      if (body.available_store_ids && body.available_store_ids.length > 0) {
        serviceData.available_store_ids = body.available_store_ids.map(
          (id) => new Types.ObjectId(id),
        );
      }

      // Convert prices ObjectIds if price_type is multiple
      if (body.price_type === 'multiple' && body.prices) {
        serviceData.prices = body.prices.map((price: any) => ({
          ...price,
          pet_type_id: price.pet_type_id
            ? new Types.ObjectId(price.pet_type_id)
            : undefined,
          size_id: price.size_id ? new Types.ObjectId(price.size_id) : undefined,
          hair_id: price.hair_id ? new Types.ObjectId(price.hair_id) : undefined,
        }));
      }

      const user = new this.serviceModel(serviceData);

      return await user.save();
    } catch (error: any) {
      if (error.code === 11000) {
        const duplicatedField = Object.keys(error.keyPattern)[0];
        throw new BadRequestException(`${duplicatedField} already exists`);
      }
      throw error;
    }
  }

  async findAll(query: GetServicesQueryDto) {
    const {
      page = 1,
      limit = 10,
      search,
      is_active,
      available_for_unlimited,
      service_type_id,
      pet_type_id,
      size_category_id,
      store_id,
      service_location_type,
    } = query;

    const filter: any = { isDeleted: false };

    if (is_active !== undefined) {
      filter.is_active = is_active;
    }

    if (available_for_unlimited !== undefined) {
      filter.available_for_unlimited = available_for_unlimited;
    }

    if (service_type_id) {
      filter.service_type_id = new Types.ObjectId(service_type_id);
    }

    if (pet_type_id) {
      filter.pet_type_ids = new Types.ObjectId(pet_type_id);
    }

    if (size_category_id) {
      filter.size_category_ids = new Types.ObjectId(size_category_id);
    }

    if (store_id) {
      filter.available_store_ids = new Types.ObjectId(store_id);
    }

    if (service_location_type) {
      filter.service_location_type = service_location_type;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const total = await this.serviceModel.countDocuments(filter).exec();

    const services = await this.serviceModel
      .find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate('service_type', 'title')
      .populate('size_categories', 'name')
      .populate('pet_types', 'name')
      .populate('hair_categories', 'name')
      .populate('avaiable_store', 'name')
      .populate('addons', 'code name image_url')
      .populate({
        path: 'prices.pet_type_id',
        model: 'Option',
        select: 'name',
      })
      .populate({
        path: 'prices.size_id',
        model: 'Option',
        select: 'name',
      })
      .populate({
        path: 'prices.hair_id',
        model: 'Option',
        select: 'name',
      })
      .exec();

    return {
      services,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: ObjectId) {
    const service = await this.serviceModel
      .findById(id)
      .populate('service_type', 'title')
      .populate('size_categories', 'name')
      .populate('pet_types', 'name')
      .populate('hair_categories', 'name')
      .populate('avaiable_store', 'name')
      .populate('addons', 'code name image_url')
      .populate({
        path: 'prices.pet_type_id',
        model: 'Option',
        select: 'name',
      })
      .populate({
        path: 'prices.size_id',
        model: 'Option',
        select: 'name',
      })
      .populate({
        path: 'prices.hair_id',
        model: 'Option',
        select: 'name',
      })
      .exec();
    return service;
  }

  async update(id: ObjectId, body: UpdateServiceDto) {
    // Only validate sessions when they are explicitly provided in the update
    if (body.sessions !== undefined) {
      const serviceTypeId =
        body.service_type_id ??
        (
          (await this.serviceModel
            .findById(id)
            .select('service_type_id')
            .lean()) as any
        )?.service_type_id?.toString();

      if (serviceTypeId) {
        const isAddon = await this.isAddonServiceType(serviceTypeId);
        if (!isAddon && body.sessions.length === 0) {
          throw new BadRequestException(
            'sessions must contain at least 1 item for non-addon service types',
          );
        }
      }
    }

    try {
      if (body.name) {
        body.name = capitalizeWords(body.name);
      }

      // Convert ObjectId fields using Mongoose Types.ObjectId
      // (mongodb@7 ObjectId is incompatible with Mongoose 9's internal mongodb@6 ObjectId)
      const updateData: any = { ...body };

      if (body.service_type_id) {
        updateData.service_type_id = new Types.ObjectId(body.service_type_id);
      }

      // Convert array of IDs to ObjectId arrays if they exist
      if (body.pet_type_ids && body.pet_type_ids.length > 0) {
        updateData.pet_type_ids = body.pet_type_ids.map(
          (id) => new Types.ObjectId(id),
        );
      }
      if (body.size_category_ids && body.size_category_ids.length > 0) {
        updateData.size_category_ids = body.size_category_ids.map(
          (id) => new Types.ObjectId(id),
        );
      }
      if (body.hair_category_ids && body.hair_category_ids.length > 0) {
        updateData.hair_category_ids = body.hair_category_ids.map(
          (id) => new Types.ObjectId(id),
        );
      }
      if (body.addon_ids && body.addon_ids.length > 0) {
        updateData.addon_ids = body.addon_ids.map((id) => new Types.ObjectId(id));
      }
      if (body.available_store_ids && body.available_store_ids.length > 0) {
        updateData.available_store_ids = body.available_store_ids.map(
          (id) => new Types.ObjectId(id),
        );
      }

      // Convert prices ObjectIds if they exist
      if (body.prices) {
        updateData.prices = body.prices.map((price: any) => ({
          ...price,
          pet_type_id: price.pet_type_id
            ? new Types.ObjectId(price.pet_type_id)
            : undefined,
          size_id: price.size_id ? new Types.ObjectId(price.size_id) : undefined,
          hair_id: price.hair_id ? new Types.ObjectId(price.hair_id) : undefined,
        }));
      }

      const service = await this.serviceModel.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true },
      );

      return service;
    } catch (error: any) {
      if (error.code === 11000) {
        const duplicatedField = Object.keys(error.keyPattern)[0];
        throw new BadRequestException(`${duplicatedField} already exists`);
      }
      throw error;
    }
  }

  async remove(id: ObjectId) {
    const service = await this.serviceModel.findByIdAndUpdate(id, {
      isDeleted: true,
      deletedAt: new Date(),
    });

    return service;
  }

  // method to retrieve service duration and price based on service id
  async getServiceForBooking(
    serviceId: ObjectId,
    sizeCategoryId?: ObjectId,
    petTypeId?: ObjectId,
    hairCategoryId?: ObjectId,
  ) {
    const service = await this.serviceModel
      .findById(serviceId)
      .select(
        'code name price price_type prices isDeleted duration service_location_type sessions',
      )
      .lean();

    if (!service || service.isDeleted) {
      throw new NotFoundException('service not found');
    }

    const priceType = (service as any).price_type;
    let resolvedPrice = 0;

    if (priceType === 'single') {
      resolvedPrice = (service as any).price ?? 0;
    } else {
      // multiple: cari entry yang cocok persis berdasarkan size_id, hair_id, dan pet_type_id
      const prices: any[] = (service as any).prices ?? [];

      const exactMatch = prices.find((p) => {
        const sizeMatch = sizeCategoryId
          ? p.size_id?.toString() === sizeCategoryId.toString()
          : !p.size_id;
        const petTypeMatch = petTypeId
          ? p.pet_type_id?.toString() === petTypeId.toString()
          : !p.pet_type_id;
        const hairMatch = hairCategoryId
          ? p.hair_id?.toString() === hairCategoryId.toString()
          : !p.hair_id;
        return sizeMatch && petTypeMatch && hairMatch;
      });

      if (!exactMatch) {
        throw new NotFoundException(
          `Harga tidak ditemukan untuk hewan dengan jenis, ukuran, dan jenis bulu yang dipilih`,
        );
      }

      resolvedPrice = exactMatch.price ?? 0;
    }

    return {
      _id: service._id,
      code: service.code,
      name: service.name,
      price: resolvedPrice,
      duration: service.duration,
      service_location_type: service.service_location_type,
      sessions: (service as any).sessions || [],
    };
  }

  // method to build a service snapshot matched to pet's pet_type, size, and hair
  async getServiceSnapshot(
    serviceId: ObjectId,
    petTypeId?: ObjectId,
    sizeCategoryId?: ObjectId,
    hairCategoryId?: ObjectId,
    addonIds?: ObjectId[],
  ) {
    const service = await this.serviceModel
      .findById(serviceId)
      .select(
        '_id code name description service_type_id price price_type prices duration service_addon_ids isDeleted',
      )
      .populate('service_type', '_id title')
      .lean();

    if (!service || service.isDeleted) {
      throw new NotFoundException('service not found');
    }

    const priceType = (service as any).price_type;
    let resolvedPrice = 0;

    if (priceType === 'single') {
      resolvedPrice = (service as any).price ?? 0;
    } else {
      const prices: any[] = (service as any).prices || [];

      const exactMatch = prices.find((p) => {
        const sizeMatch = sizeCategoryId
          ? p.size_id?.toString() === sizeCategoryId.toString()
          : !p.size_id;
        const petTypeMatch = petTypeId
          ? p.pet_type_id?.toString() === petTypeId.toString()
          : !p.pet_type_id;
        const hairMatch = hairCategoryId
          ? p.hair_id?.toString() === hairCategoryId.toString()
          : !p.hair_id;
        return sizeMatch && petTypeMatch && hairMatch;
      });

      if (!exactMatch) {
        throw new NotFoundException(
          `Harga tidak ditemukan untuk hewan dengan jenis, ukuran, dan jenis bulu yang dipilih`,
        );
      }

      resolvedPrice = exactMatch.price ?? 0;
    }

    const serviceType = (service as any).service_type;

    // Resolve addons snapshot
    let addonsSnapshot: any[] = [];
    const idsToFetch =
      addonIds && addonIds.length > 0
        ? addonIds
        : (service as any).addon_ids || [];

    if (idsToFetch.length > 0) {
      const addonDocs = await this.serviceModel
        .find({ _id: { $in: idsToFetch }, isDeleted: false })
        .select('_id code name price price_type prices duration')
        .lean();

      addonsSnapshot = addonDocs.map((addon: any) => {
        let addonPrice = 0;
        if (addon.price_type === 'single') {
          addonPrice = addon.price ?? 0;
        } else {
          const prices: any[] = addon.prices || [];
          const exactMatch = prices.find((p) => {
            const sizeMatch = sizeCategoryId
              ? p.size_id?.toString() === sizeCategoryId.toString()
              : !p.size_id;
            const petTypeMatch = petTypeId
              ? p.pet_type_id?.toString() === petTypeId.toString()
              : !p.pet_type_id;
            const hairMatch = hairCategoryId
              ? p.hair_id?.toString() === hairCategoryId.toString()
              : !p.hair_id;
            return sizeMatch && petTypeMatch && hairMatch;
          });
          if (!exactMatch) {
            throw new NotFoundException(
              `Harga addon tidak ditemukan untuk hewan dengan jenis, ukuran, dan jenis bulu yang dipilih`,
            );
          }
          addonPrice = exactMatch.price ?? 0;
        }
        return {
          _id: addon._id,
          code: addon.code,
          name: addon.name,
          price: addonPrice,
          duration: addon.duration ?? 0,
        };
      });
    }

    return {
      _id: service._id,
      code: service.code,
      name: service.name,
      description: (service as any).description ?? null,
      service_type: serviceType
        ? { _id: serviceType._id, title: serviceType.title }
        : null,
      price: resolvedPrice,
      duration: (service as any).duration ?? 0,
      addons: addonsSnapshot.length > 0 ? addonsSnapshot : undefined,
    };
  }

  async findAllForHomepage() {
    return await this.serviceModel
      .find({ isDeleted: false, is_active: true, show_in_homepage: true })
      .populate('service_type', 'title')
      .populate('pet_types', 'name')
      .populate({
        path: 'prices.pet_type_id',
        model: 'Option',
        select: 'name',
      })
      .populate({
        path: 'prices.size_id',
        model: 'Option',
        select: 'name',
      })
      .populate({
        path: 'prices.hair_id',
        model: 'Option',
        select: 'name',
      })
      .sort({ order: 1, createdAt: -1 })
      .exec();
  }

  // method to retrieve service based on service type and store
  async findAllForGuest(storeId?: string, service_type_id?: string) {
    const filter: any = { isDeleted: false };

    // Filter by service type if provided
    if (service_type_id) {
      // Assuming 'grooming' or 'addon' is stored in service_type or a separate field
      // You may need to adjust this based on your actual schema
      // For now, we'll filter by a field called 'type' or you can populate service_type
      filter.service_type_id = new Types.ObjectId(service_type_id);
    }

    let services = await this.serviceModel
      .find(filter)
      .populate('service_type', 'title')
      .populate('size_categories', 'name')
      .populate('pet_types', 'name')
      .populate('avaiable_store', 'name')
      .populate({
        path: 'addons',
        select: 'code name description price duration',
      })
      .populate({
        path: 'prices.pet_type_id',
        model: 'Option',
        select: 'name',
      })
      .populate({
        path: 'prices.size_id',
        model: 'Option',
        select: 'name',
      })
      .populate({
        path: 'prices.hair_id',
        model: 'Option',
        select: 'name',
      })
      // .lean()
      .exec();

    // Filter by store if provided
    if (storeId) {
      services = services.filter((service: any) => {
        // If available_store_ids is empty, service is available at all stores
        if (
          !service.available_store_ids ||
          service.available_store_ids.length === 0
        ) {
          return true;
        }
        // Otherwise, check if storeId is in available_store_ids
        return service.available_store_ids.some(
          (id: any) => id.toString() === storeId,
        );
      });
    }

    return services;
  }
}
