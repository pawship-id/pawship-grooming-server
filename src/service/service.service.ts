import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { GetServicesQueryDto } from './dto/get-services-query.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Service, ServiceDocument } from './entities/service.entity';
import { ObjectId } from 'mongodb';
import { capitalizeWords } from 'src/helpers/string.helper';
import { Option, OptionDocument } from 'src/option/entities/option.entity';
import { Store, StoreDocument } from 'src/store/entities/store.entity';

@Injectable()
export class ServiceService {
  constructor(
    @InjectModel(Service.name)
    private readonly serviceModel: Model<ServiceDocument>,
    @InjectModel(Option.name)
    private readonly optionModel: Model<OptionDocument>,
    @InjectModel(Store.name)
    private readonly storeModel: Model<StoreDocument>,
  ) {}

  async create(body: CreateServiceDto) {
    try {
      body.name = capitalizeWords(body.name);

      const user = new this.serviceModel(body);

      return await user.save();
    } catch (error) {
      if (error.code === 11000) {
        const duplicatedField = Object.keys(error.keyPattern)[0]; // ambil field yang duplicate
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
    } = query;

    const filter: any = { isDeleted: false };

    if (is_active !== undefined) {
      filter.is_active = is_active;
    }

    if (available_for_unlimited !== undefined) {
      filter.available_for_unlimited = available_for_unlimited;
    }

    if (service_type_id) {
      filter.service_type_id = service_type_id;
    }

    if (pet_type_id) {
      filter.pet_type_ids = pet_type_id;
    }

    if (size_category_id) {
      filter.size_category_ids = size_category_id;
    }

    if (store_id) {
      filter.available_store_ids = store_id;
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
    try {
      if (body.name) {
        body.name = capitalizeWords(body.name);
      }

      const service = await this.serviceModel.findByIdAndUpdate(
        id,
        { $set: body },
        { new: true },
      );

      return service;
    } catch (error) {
      if (error.code === 11000) {
        const duplicatedField = Object.keys(error.keyPattern)[0]; // ambil field yang duplicate
        throw new BadRequestException(`${duplicatedField} already exists`);
      }
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
      .select('code name price price_type prices isDeleted duration')
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
      code: service.code,
      name: service.name,
      price: resolvedPrice,
      duration: service.duration,
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

  // method to retrieve service based on service type and store
  async findAllForGuest(storeId?: string, service_type_id?: string) {
    const filter: any = { isDeleted: false };

    // Filter by service type if provided
    if (service_type_id) {
      // Assuming 'grooming' or 'addon' is stored in service_type or a separate field
      // You may need to adjust this based on your actual schema
      // For now, we'll filter by a field called 'type' or you can populate service_type
      filter.service_type_id = service_type_id;
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
