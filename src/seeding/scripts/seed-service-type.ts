import * as path from 'path';
import * as mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import * as dotenv from 'dotenv';
import { connectDatabase, disconnectDatabase } from '../config/seeding.config';
import {
  readExcelFile,
  validateExcelColumns,
} from '../utils/excel-reader.util';
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

// Define ServiceType Schema (matching the entity)
const ServiceTypeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    image_url: { type: String },
    public_id: { type: String },
    is_active: { type: Boolean, default: false },
    show_in_homepage: { type: Boolean, default: false },
    store_ids: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Store' }],
      default: [],
    },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Define Store Schema for lookups
const StoreSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
  },
  { timestamps: true },
);

// Create models
const ServiceTypeModel =
  mongoose.models.ServiceType ||
  mongoose.model('ServiceType', ServiceTypeSchema);
const StoreModel =
  mongoose.models.Store || mongoose.model('Store', StoreSchema);

interface ExcelRow {
  title?: string;
  description?: string;
  image_url?: string;
  store_ids?: string;
  is_active?: string | boolean;
  show_in_homepage?: string | boolean;
}

interface SeedResult {
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
}

interface SkippedRecord {
  row: number;
  title: string;
  reason: string;
}

/**
 * Parse boolean values from Excel (handles true/false/1/0/yes/ya)
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
 * Parse store IDs from comma-separated string
 * Finds stores by name/code (case-insensitive) and returns their ObjectIds
 * @param storeIdsString - Comma-separated store names/codes
 * @returns Array of store ObjectIds or null if any store not found
 */
async function parseStoreIds(
  storeIdsString: string,
): Promise<{ storeIds: mongoose.Types.ObjectId[]; notFound: string[] }> {
  if (!storeIdsString || !storeIdsString.trim()) {
    return { storeIds: [], notFound: [] };
  }

  // Split by comma and trim spaces
  const storeNames = storeIdsString
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  if (storeNames.length === 0) {
    return { storeIds: [], notFound: [] };
  }

  const storeIds: mongoose.Types.ObjectId[] = [];
  const notFound: string[] = [];

  // Find each store (case-insensitive)
  for (const storeName of storeNames) {
    const store = await StoreModel.findOne({
      $or: [
        { name: new RegExp(`^${escapeRegex(storeName)}$`, 'i') },
        { code: new RegExp(`^${escapeRegex(storeName)}$`, 'i') },
      ],
    }).select('_id');

    if (store) {
      storeIds.push(store._id);
    } else {
      notFound.push(storeName);
    }
  }

  return { storeIds, notFound };
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
 * Upload image to Cloudinary
 * @param imageUrl - URL or path to image
 * @returns Object with image_url and public_id, or null on failure
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
    const result = await uploadToCloudinary(tempFilePath, 'service-types');

    console.log(`  ✓ Image uploaded successfully`);

    return {
      image_url: result.secure_url,
      public_id: result.public_id,
    };
  } catch (error) {
    console.error(`  ✗ Image upload failed: ${error.message}`);
    return null;
  } finally {
    // Clean up temporary file
    if (tempFilePath) {
      deleteTempFile(tempFilePath);
    }
  }
}

/**
 * Process image field from Excel row
 * @param imageUrl - Image URL from Excel
 * @param existingRecord - Existing service type record (if any)
 * @returns Object with image_url and public_id, or null
 */
async function processImageField(
  imageUrl: string | undefined,
  existingRecord: any | null,
): Promise<{ image_url: string; public_id: string } | null> {
  // If no image URL provided in Excel
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

  // If updating existing record with image, keep the old image (per user preference)
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
 * Seeding data ServiceType from Excel
 */
async function seedServiceTypes(): Promise<void> {
  const result: SeedResult = {
    total: 0,
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
    const excelPath = path.resolve(
      process.cwd(),
      'data/Data Service Type.xlsx',
    );

    // Read Excel file
    console.log('\n📖 Reading Excel file...');
    const data = readExcelFile(excelPath);

    // Validate columns
    const requiredColumns = ['title'];
    if (!validateExcelColumns(data, requiredColumns)) {
      throw new Error('Excel file validation failed');
    }

    result.total = data.length;
    console.log(`\n🔄 Processing ${result.total} rows...\n`);

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i] as ExcelRow;
      const rowNumber = i + 2; // Excel row number (header in row 1)

      try {
        // Validate required fields
        if (!row.title || !row.title.trim()) {
          console.warn(`⚠ Row ${rowNumber}: Missing required field (title)`);
          skippedRecords.push({
            row: rowNumber,
            title: 'N/A',
            reason: 'Missing title',
          });
          result.skipped++;
          continue;
        }

        const title = row.title.trim();
        console.log(`\n📝 Row ${rowNumber}: Processing "${title}"`);

        // Parse store_ids
        let storeIds: mongoose.Types.ObjectId[] = [];
        if (row.store_ids && row.store_ids.trim()) {
          const { storeIds: foundStoreIds, notFound } = await parseStoreIds(
            row.store_ids,
          );

          if (notFound.length > 0) {
            console.warn(
              `  ✗ Stores not found: ${notFound.join(', ')} - Skipping record`,
            );
            skippedRecords.push({
              row: rowNumber,
              title: title,
              reason: `Store(s) not found: ${notFound.join(', ')}`,
            });
            result.skipped++;
            continue;
          }

          storeIds = foundStoreIds;
          console.log(`  ✓ Found ${storeIds.length} store(s)`);
        }

        // Check if record exists (case-insensitive by title)
        const existingRecord = await ServiceTypeModel.findOne({
          title: new RegExp(`^${escapeRegex(title)}$`, 'i'),
        });

        const isUpdate = !!existingRecord;

        // Process image
        const imageData = await processImageField(
          row.image_url,
          existingRecord,
        );

        // Prepare data for upsert
        const updateData: any = {
          title: title,
          is_active: parseBoolean(row.is_active),
          show_in_homepage: parseBoolean(row.show_in_homepage),
          store_ids: storeIds,
          isDeleted: false,
          deletedAt: null,
        };

        // Add optional fields
        if (row.description && row.description.trim()) {
          updateData.description = row.description.trim();
        }

        // Add image data if available
        if (imageData) {
          updateData.image_url = imageData.image_url;
          updateData.public_id = imageData.public_id;
        }

        // Upsert (update if exists, insert if not)
        const filter = {
          title: new RegExp(`^${escapeRegex(title)}$`, 'i'),
        };

        const updateResult = await ServiceTypeModel.updateOne(
          filter,
          { $set: updateData },
          { upsert: true },
        );

        if (updateResult.upsertedCount > 0) {
          console.log(`  ✓ Inserted "${title}"`);
          result.inserted++;
        } else if (updateResult.modifiedCount > 0) {
          console.log(`  ✓ Updated "${title}"`);
          result.updated++;
        } else {
          console.log(`  - No changes for "${title}"`);
          result.skipped++;
          skippedRecords.push({
            row: rowNumber,
            title: title,
            reason: 'No changes detected',
          });
        }
      } catch (error) {
        console.error(`  ✗ Row ${rowNumber}: Error - ${error.message}`);
        skippedRecords.push({
          row: rowNumber,
          title: row.title || 'N/A',
          reason: `Error: ${error.message}`,
        });
        result.errors++;
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SEEDING SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total rows processed:  ${result.total}`);
    console.log(`✓ Inserted:            ${result.inserted}`);
    console.log(`✓ Updated:             ${result.updated}`);
    console.log(`- Skipped:             ${result.skipped}`);
    console.log(`✗ Errors:              ${result.errors}`);
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
          console.log(`   - Row ${record.row}: "${record.title}"`);
        });
      }
      console.log('='.repeat(60));
    }

    if (result.errors > 0) {
      console.warn(
        '\n⚠ Warning: Some rows failed to process. Check the logs above for details.\n',
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
    // Disconnect from database
    await disconnectDatabase();
  }
}

// Run seeding
seedServiceTypes()
  .then(() => {
    console.log('🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
