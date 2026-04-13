import * as path from 'path';
import * as fs from 'fs';
import * as mongoose from 'mongoose';
import * as XLSX from 'xlsx';
import { v2 as cloudinary } from 'cloudinary';
import * as dotenv from 'dotenv';
import { connectDatabase, disconnectDatabase } from '../config/seeding.config';
import {
  processImageForCloudinary,
  saveBufferToTempFile,
  deleteTempFile,
} from '../utils/image-processor.util';
import { uploadToCloudinary } from '../../helpers/cloudinary';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Define ServicePrice Sub-Schema
const ServicePriceSchema = new mongoose.Schema(
  {
    pet_type_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Option',
    },
    size_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Option',
    },
    hair_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Option',
    },
    price: { type: Number, required: true },
  },
  { _id: false },
);

// Define Service Schema
const ServiceSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String },
    image_url: { type: String },
    public_id: { type: String },
    service_type_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ServiceType',
      required: true,
    },
    pet_type_ids: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Option' }],
      default: [],
    },
    size_category_ids: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Option' }],
      required: true,
      default: [],
    },
    hair_category_ids: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Option' }],
      required: true,
      default: [],
    },
    prices: {
      type: [ServicePriceSchema],
      default: [],
    },
    price_type: { type: String, required: true, enum: ['single', 'multiple'] },
    price: { type: Number, default: 0 },
    duration: { type: Number, required: true },
    available_for_unlimited: { type: Boolean, required: true, default: true },
    available_store_ids: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Store' }],
      default: [],
    },
    addon_ids: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],
      default: [],
    },
    include: { type: [String], default: [] },
    show_in_homepage: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    service_location_type: {
      type: [String],
      enum: ['in home', 'in store'],
      required: true,
    },
    is_pickup_delivery_available: { type: Boolean, default: false },
    sessions: { type: [String], default: [] },
    is_active: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Define related schemas
const ServiceTypeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
  },
  { timestamps: true },
);

const OptionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category_options: { type: String, required: true },
  },
  { timestamps: true },
);

const StoreSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
  },
  { timestamps: true },
);

// Create models
const ServiceModel =
  mongoose.models.Service || mongoose.model('Service', ServiceSchema);
const ServiceTypeModel =
  mongoose.models.ServiceType ||
  mongoose.model('ServiceType', ServiceTypeSchema);
const OptionModel =
  mongoose.models.Option || mongoose.model('Option', OptionSchema);
const StoreModel =
  mongoose.models.Store || mongoose.model('Store', StoreSchema);

interface ExcelRow {
  code?: string;
  name?: string;
  description?: string;
  image_url?: string;
  service_type?: string;
  pet_type?: string;
  size_category?: string;
  hair_category?: string;
  price_type?: string;
  price?: string | number;
  duration?: string | number;
  available_for_unlimited?: string | boolean;
  available_store?: string;
  addon?: string;
  include?: string;
  show_in_homepage?: string | boolean;
  order?: string | number;
  service_location_type?: string;
  is_pick_up_available?: string | boolean;
  sessions?: string;
  is_active?: string | boolean;
}

interface SeedResult {
  total: number;
  services: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
}

interface SkippedRecord {
  row: number;
  code: string;
  reason: string;
}

/**
 * Read Excel file with custom headers (row 1 + row 2)
 * Handles merged cells in row 1 and detail headers in row 2
 */
function readExcelFileWithCustomHeaders(filePath: string): any[] {
  try {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }

    const workbook = XLSX.readFile(absolutePath);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

    // Read both row 1 and row 2 to combine headers
    const headers: string[] = [];
    let currentMainHeader = '';

    for (let col = range.s.c; col <= range.e.c; col++) {
      const row1Cell = worksheet[XLSX.utils.encode_cell({ r: 0, c: col })];
      const row2Cell = worksheet[XLSX.utils.encode_cell({ r: 1, c: col })];

      // If row1 has a value, it's a main header (might be merged)
      if (row1Cell && row1Cell.v && String(row1Cell.v).trim()) {
        currentMainHeader = String(row1Cell.v).trim();
        if (row2Cell && row2Cell.v && String(row2Cell.v).trim()) {
          headers.push(String(row2Cell.v).trim());
        } else {
          headers.push(currentMainHeader);
        }
      }
      // If row1 is empty but row2 has value, use row2
      else if (row2Cell && row2Cell.v && String(row2Cell.v).trim()) {
        headers.push(String(row2Cell.v).trim());
      }
      // If both are empty, use placeholder
      else {
        headers.push(`__EMPTY_${col}`);
      }
    }

    // Read data starting from row 3 (index 2)
    const data: any[] = [];
    for (let row = 2; row <= range.e.r; row++) {
      const rowData: any = {};
      let hasData = false;

      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = worksheet[cellAddress];
        const headerName = headers[col];

        if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
          rowData[headerName] = String(cell.v);
          hasData = true;
        } else {
          rowData[headerName] = '';
        }
      }

      if (hasData) {
        data.push(rowData);
      }
    }

    console.log(`✓ Read ${data.length} rows from Excel`);
    return data;
  } catch (error) {
    throw new Error(`Failed to read Excel file: ${error.message}`);
  }
}

/**
 * Parse boolean values
 */
function parseBoolean(value: any): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const lowerValue = value.toLowerCase().trim();
    return (
      lowerValue === 'true' ||
      lowerValue === '1' ||
      lowerValue === 'yes' ||
      lowerValue === 'ya'
    );
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  return false;
}

/**
 * Parse number from string or number
 */
function parseNumber(value: any, defaultValue: number = 0): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value.trim());
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
}

/**
 * Parse array from comma or dash separated string
 */
function parseArray(
  value: string | undefined,
  separator: string = ',',
): string[] {
  if (!value || !value.trim()) {
    return [];
  }

  return value
    .split(separator)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * Escape special characters for regex
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if string is a URL
 */
function isUrl(str: string): boolean {
  return /^https?:\/\//i.test(str);
}

/**
 * Find ServiceType by title (case-insensitive)
 */
async function findServiceTypeId(
  title: string,
): Promise<mongoose.Types.ObjectId | null> {
  if (!title || !title.trim()) {
    return null;
  }

  const serviceType = await ServiceTypeModel.findOne({
    title: new RegExp(`^${escapeRegex(title.trim())}$`, 'i'),
  }).select('_id');

  return serviceType ? serviceType._id : null;
}

/**
 * Find Option IDs by names and category
 */
async function findOptionIds(
  names: string[],
  category: string,
): Promise<{ ids: mongoose.Types.ObjectId[]; notFound: string[] }> {
  if (!names || names.length === 0) {
    return { ids: [], notFound: [] };
  }

  const ids: mongoose.Types.ObjectId[] = [];
  const notFound: string[] = [];

  for (const name of names) {
    const option = await OptionModel.findOne({
      name: new RegExp(`^${escapeRegex(name)}$`, 'i'),
      category_options: new RegExp(`^${escapeRegex(category)}$`, 'i'),
    }).select('_id');

    if (option) {
      ids.push(option._id);
    } else {
      notFound.push(name);
    }
  }

  return { ids, notFound };
}

/**
 * Find Store IDs by names/codes
 */
async function findStoreIds(
  storeNames: string[],
): Promise<{ ids: mongoose.Types.ObjectId[]; notFound: string[] }> {
  if (!storeNames || storeNames.length === 0) {
    return { ids: [], notFound: [] };
  }

  const ids: mongoose.Types.ObjectId[] = [];
  const notFound: string[] = [];

  for (const storeName of storeNames) {
    const store = await StoreModel.findOne({
      $or: [
        { name: new RegExp(`^${escapeRegex(storeName)}$`, 'i') },
        { code: new RegExp(`^${escapeRegex(storeName)}$`, 'i') },
      ],
    }).select('_id');

    if (store) {
      ids.push(store._id);
    } else {
      notFound.push(storeName);
    }
  }

  return { ids, notFound };
}

/**
 * Upload image to Cloudinary
 */
async function uploadImageToCloudinary(
  imageUrl: string,
): Promise<{ image_url: string; public_id: string } | null> {
  let tempFilePath: string | null = null;

  try {
    console.log(`  → Processing image...`);

    // Process image (download, convert HEIC, compress)
    const imageBuffer = await processImageForCloudinary(imageUrl);

    // Save to temporary file
    tempFilePath = saveBufferToTempFile(imageBuffer, 'jpg');

    // Upload to Cloudinary
    console.log(`  → Uploading to Cloudinary...`);
    const result = await uploadToCloudinary(tempFilePath, 'services');

    console.log(`  ✓ Image uploaded successfully`);

    return {
      image_url: result.secure_url,
      public_id: result.public_id,
    };
  } catch (error) {
    console.error(`  ✗ Image upload failed: ${error.message}`);
    return null;
  } finally {
    if (tempFilePath) {
      deleteTempFile(tempFilePath);
    }
  }
}

/**
 * Process image field
 */
async function processImageField(
  imageUrl: string | undefined,
  existingRecord: any | null,
): Promise<{ image_url: string; public_id: string } | null> {
  // If no image URL provided
  if (!imageUrl || !imageUrl.trim()) {
    // Keep existing image if updating
    if (existingRecord && existingRecord.image_url) {
      return {
        image_url: existingRecord.image_url,
        public_id: existingRecord.public_id || '',
      };
    }
    return null;
  }

  // If updating existing record with image, keep the old image
  if (existingRecord && existingRecord.image_url) {
    console.log(`  → Keeping existing image (skipping update)`);
    return {
      image_url: existingRecord.image_url,
      public_id: existingRecord.public_id || '',
    };
  }

  // For new records or records without image, upload the new image
  if (isUrl(imageUrl)) {
    return await uploadImageToCloudinary(imageUrl);
  }

  console.log(`  ⚠ Image URL is not a valid URL: ${imageUrl}`);
  return null;
}

/**
 * Group rows by code
 */
function groupRowsByCode(rows: ExcelRow[]): Map<string, ExcelRow[]> {
  const grouped = new Map<string, ExcelRow[]>();

  for (const row of rows) {
    if (row.code && row.code.trim()) {
      const code = row.code.trim();
      if (!grouped.has(code)) {
        grouped.set(code, []);
      }
      grouped.get(code)!.push(row);
    }
  }

  return grouped;
}

/**
 * Main seeding function
 */
async function seedServices(): Promise<void> {
  const result: SeedResult = {
    total: 0,
    services: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  const skippedRecords: SkippedRecord[] = [];

  try {
    // Verify Cloudinary configuration
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
      throw new Error('Cloudinary credentials not configured in .env file');
    }

    // Connect to database
    await connectDatabase();

    // Path to Excel file
    const excelPath = path.resolve(process.cwd(), 'data/Data Service.xlsx');

    // Read Excel file
    console.log('\n📖 Reading Excel file...');
    const data = readExcelFileWithCustomHeaders(excelPath);

    result.total = data.length;
    console.log(`\n🔄 Processing ${result.total} rows...\n`);

    // Group rows by code
    const groupedData = groupRowsByCode(data as ExcelRow[]);
    result.services = groupedData.size;

    console.log(`📦 Found ${result.services} unique service(s)\n`);

    // Process each service group
    for (const [code, rows] of groupedData) {
      const firstRow = rows[0];
      const rowNumber = data.indexOf(firstRow) + 3; // Row number in Excel (header at 1-2)

      try {
        console.log(
          `\n${'='.repeat(60)}\n📝 Processing Service: ${code} (${rows.length} row(s))\n${'='.repeat(60)}`,
        );

        // Validate required fields from first row
        if (!firstRow.name || !firstRow.name.trim()) {
          console.warn(`⚠ Row ${rowNumber}: Missing required field (name)`);
          skippedRecords.push({
            row: rowNumber,
            code: code,
            reason: 'Missing name',
          });
          result.skipped++;
          continue;
        }

        if (!firstRow.service_type || !firstRow.service_type.trim()) {
          console.warn(
            `⚠ Row ${rowNumber}: Missing required field (service_type)`,
          );
          skippedRecords.push({
            row: rowNumber,
            code: code,
            reason: 'Missing service_type',
          });
          result.skipped++;
          continue;
        }

        if (!firstRow.price_type || !firstRow.price_type.trim()) {
          console.warn(
            `⚠ Row ${rowNumber}: Missing required field (price_type)`,
          );
          skippedRecords.push({
            row: rowNumber,
            code: code,
            reason: 'Missing price_type',
          });
          result.skipped++;
          continue;
        }

        if (
          !firstRow.service_location_type ||
          !firstRow.service_location_type.trim()
        ) {
          console.warn(
            `⚠ Row ${rowNumber}: Missing required field (service_location_type)`,
          );
          skippedRecords.push({
            row: rowNumber,
            code: code,
            reason: 'Missing service_location_type',
          });
          result.skipped++;
          continue;
        }

        const name = firstRow.name.trim();
        const priceType = firstRow.price_type.trim().toLowerCase();

        // Find ServiceType
        console.log(
          `  → Looking up ServiceType: "${firstRow.service_type.trim()}"`,
        );
        const serviceTypeId = await findServiceTypeId(
          firstRow.service_type.trim(),
        );

        if (!serviceTypeId) {
          console.warn(
            `  ✗ ServiceType not found: "${firstRow.service_type.trim()}" - Skipping service`,
          );
          skippedRecords.push({
            row: rowNumber,
            code: code,
            reason: `ServiceType not found: ${firstRow.service_type.trim()}`,
          });
          result.skipped++;
          continue;
        }

        console.log(`  ✓ Found ServiceType`);

        // Check if service exists
        const existingService = await ServiceModel.findOne({
          code: new RegExp(`^${escapeRegex(code)}$`, 'i'),
        });

        // Process image (only from first row)
        const imageData = await processImageField(
          firstRow.image_url,
          existingService,
        );

        // Parse common fields
        const include = parseArray(firstRow.include || '', '-');
        const serviceLocationTypes = parseArray(
          firstRow.service_location_type || '',
          ',',
        );
        const sessions = parseArray(firstRow.sessions || '', ',');

        // Parse available stores
        let availableStoreIds: mongoose.Types.ObjectId[] = [];
        if (firstRow.available_store && firstRow.available_store.trim()) {
          const storeNames = parseArray(firstRow.available_store, ',');
          const { ids, notFound } = await findStoreIds(storeNames);

          if (notFound.length > 0) {
            console.warn(
              `  ⚠ Stores not found: ${notFound.join(', ')} - Continuing with found stores`,
            );
          }

          availableStoreIds = ids;
          console.log(`  ✓ Found ${ids.length} store(s)`);
        }

        // Prepare base data
        const updateData: any = {
          code: code,
          name: name,
          service_type_id: serviceTypeId,
          price_type: priceType,
          duration: parseNumber(firstRow.duration, 60),
          available_for_unlimited: parseBoolean(
            firstRow.available_for_unlimited ?? true,
          ),
          available_store_ids: availableStoreIds,
          include: include,
          show_in_homepage: parseBoolean(firstRow.show_in_homepage),
          order: parseNumber(firstRow.order, 0),
          service_location_type: serviceLocationTypes,
          is_pickup_delivery_available: parseBoolean(
            firstRow.is_pick_up_available,
          ),
          sessions: sessions,
          is_active: parseBoolean(firstRow.is_active ?? true),
          isDeleted: false,
          deletedAt: null,
        };

        // Add optional fields
        if (firstRow.description && firstRow.description.trim()) {
          updateData.description = firstRow.description.trim();
        }

        // Add image data if available
        if (imageData) {
          updateData.image_url = imageData.image_url;
          updateData.public_id = imageData.public_id;
        }

        // Handle price type: single or multiple
        if (priceType === 'single') {
          console.log(`  → Processing as SINGLE price service`);

          // Parse pet_type, size_category, hair_category as arrays
          const petTypeNames = parseArray(firstRow.pet_type || '', ',');
          const sizeCategoryNames = parseArray(
            firstRow.size_category || '',
            ',',
          );
          const hairCategoryNames = parseArray(
            firstRow.hair_category || '',
            ',',
          );

          // Lookup Option IDs
          const { ids: petTypeIds, notFound: petTypesNotFound } =
            await findOptionIds(petTypeNames, 'pet type');
          const { ids: sizeIds, notFound: sizesNotFound } =
            await findOptionIds(sizeCategoryNames, 'size category');
          const { ids: hairIds, notFound: hairsNotFound } =
            await findOptionIds(hairCategoryNames, 'hair category');

          // Log warnings for not found options
          if (petTypesNotFound.length > 0) {
            console.warn(
              `  ⚠ Pet types not found: ${petTypesNotFound.join(', ')}`,
            );
          }
          if (sizesNotFound.length > 0) {
            console.warn(
              `  ⚠ Size categories not found: ${sizesNotFound.join(', ')}`,
            );
          }
          if (hairsNotFound.length > 0) {
            console.warn(
              `  ⚠ Hair categories not found: ${hairsNotFound.join(', ')}`,
            );
          }

          updateData.pet_type_ids = petTypeIds;
          updateData.size_category_ids = sizeIds;
          updateData.hair_category_ids = hairIds;
          updateData.price = parseNumber(firstRow.price, 0);
          updateData.prices = [];

          console.log(
            `  ✓ Price: ${updateData.price}, Pet types: ${petTypeIds.length}, Sizes: ${sizeIds.length}, Hair: ${hairIds.length}`,
          );
        } else if (priceType === 'multiple') {
          console.log(
            `  → Processing as MULTIPLE price service (${rows.length} combinations)`,
          );

          const prices: any[] = [];
          const allPetTypeIds = new Set<string>();
          const allSizeIds = new Set<string>();
          const allHairIds = new Set<string>();

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const currentRowNum = data.indexOf(row) + 3;

            console.log(`    → Processing price combination ${i + 1}/${rows.length}`);

            // Each row must have pet_type, size_category, hair_category, price
            if (
              !row.pet_type ||
              !row.size_category ||
              !row.hair_category ||
              !row.price
            ) {
              console.warn(
                `    ⚠ Row ${currentRowNum}: Missing price combination fields - skipping this combination`,
              );
              continue;
            }

            // Find individual option IDs
            const { ids: petTypeIds } = await findOptionIds(
              [row.pet_type.trim()],
              'pet type',
            );
            const { ids: sizeIds } = await findOptionIds(
              [row.size_category.trim()],
              'size category',
            );
            const { ids: hairIds } = await findOptionIds(
              [row.hair_category.trim()],
              'hair category',
            );

            if (petTypeIds.length === 0) {
              console.warn(
                `    ⚠ Pet type not found: "${row.pet_type.trim()}" - skipping this combination`,
              );
              continue;
            }
            if (sizeIds.length === 0) {
              console.warn(
                `    ⚠ Size category not found: "${row.size_category.trim()}" - skipping this combination`,
              );
              continue;
            }
            if (hairIds.length === 0) {
              console.warn(
                `    ⚠ Hair category not found: "${row.hair_category.trim()}" - skipping this combination`,
              );
              continue;
            }

            // Add to prices array
            prices.push({
              pet_type_id: petTypeIds[0],
              size_id: sizeIds[0],
              hair_id: hairIds[0],
              price: parseNumber(row.price, 0),
            });

            // Collect unique IDs for the service-level arrays
            allPetTypeIds.add(petTypeIds[0].toString());
            allSizeIds.add(sizeIds[0].toString());
            allHairIds.add(hairIds[0].toString());

            console.log(
              `    ✓ Added: ${row.pet_type.trim()} / ${row.size_category.trim()} / ${row.hair_category.trim()} = ${parseNumber(row.price, 0)}`,
            );
          }

          updateData.prices = prices;
          updateData.price = 0;
          updateData.pet_type_ids = Array.from(allPetTypeIds).map(
            (id) => new mongoose.Types.ObjectId(id),
          );
          updateData.size_category_ids = Array.from(allSizeIds).map(
            (id) => new mongoose.Types.ObjectId(id),
          );
          updateData.hair_category_ids = Array.from(allHairIds).map(
            (id) => new mongoose.Types.ObjectId(id),
          );

          console.log(
            `  ✓ Created ${prices.length} price combinations, Pet types: ${updateData.pet_type_ids.length}, Sizes: ${updateData.size_category_ids.length}, Hair: ${updateData.hair_category_ids.length}`,
          );
        } else {
          console.warn(
            `  ⚠ Invalid price_type: "${priceType}" - Skipping service`,
          );
          skippedRecords.push({
            row: rowNumber,
            code: code,
            reason: `Invalid price_type: ${priceType}`,
          });
          result.skipped++;
          continue;
        }

        // Upsert service
        const filter = {
          code: new RegExp(`^${escapeRegex(code)}$`, 'i'),
        };

        const updateResult = await ServiceModel.updateOne(
          filter,
          { $set: updateData },
          { upsert: true },
        );

        if (updateResult.upsertedCount > 0) {
          console.log(`\n✓ INSERTED service: "${name}" (${code})`);
          result.inserted++;
        } else if (updateResult.modifiedCount > 0) {
          console.log(`\n✓ UPDATED service: "${name}" (${code})`);
          result.updated++;
        } else {
          console.log(`\n- NO CHANGES for service: "${name}" (${code})`);
        }
      } catch (error) {
        console.error(`\n✗ Error processing service ${code}: ${error.message}`);
        console.error(error.stack);
        skippedRecords.push({
          row: rowNumber,
          code: code,
          reason: `Error: ${error.message}`,
        });
        result.errors++;
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SEEDING SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total rows processed:     ${result.total}`);
    console.log(`Total services processed: ${result.services}`);
    console.log(`✓ Inserted:               ${result.inserted}`);
    console.log(`✓ Updated:                ${result.updated}`);
    console.log(`- Skipped:                ${result.skipped}`);
    console.log(`✗ Errors:                 ${result.errors}`);
    console.log('='.repeat(60));

    // Print skipped records details
    if (skippedRecords.length > 0) {
      console.log('\n📋 SKIPPED RECORDS DETAILS:');
      console.log('='.repeat(60));

      // Group by reason
      const groupedByReason = skippedRecords.reduce(
        (acc, record) => {
          if (!acc[record.reason]) {
            acc[record.reason] = [];
          }
          acc[record.reason].push(record);
          return acc;
        },
        {} as Record<string, SkippedRecord[]>,
      );

      for (const [reason, records] of Object.entries(groupedByReason)) {
        console.log(`\n⚠ ${reason} (${records.length} record(s)):`);
        records.forEach((record) => {
          console.log(`   - Row ${record.row}: ${record.code}`);
        });
      }
      console.log('='.repeat(60));
    }

    if (result.errors > 0) {
      console.warn(
        '\n⚠ Warning: Some services failed to process. Check the logs above for details.\n',
      );
    } else if (result.skipped > 0) {
      console.log('\n✓ Seeding completed with some skipped records.\n');
    } else {
      console.log('\n✓ Seeding completed successfully!\n');
    }
  } catch (error) {
    console.error('\n❌ Seeding failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

// Run seeding
seedServices()
  .then(() => {
    console.log('🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
