import * as path from 'path';
import * as mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/seeding.config';
import { validateExcelColumns } from '../utils/excel-reader.util';
import * as XLSX from 'xlsx';
import * as fs from 'fs';

// Define Store Schema (matching the entity)
const StoreSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String },
    location: {
      type: {
        address: { type: String },
        city: { type: String },
        province: { type: String },
        postal_code: { type: String },
        latitude: { type: Number },
        longitude: { type: Number },
      },
      _id: false,
    },
    contact: {
      type: {
        phone_number: { type: String },
        whatsapp: { type: String },
        email: { type: String },
      },
      _id: false,
    },
    operational: {
      type: {
        opening_time: { type: String },
        closing_time: { type: String },
        operational_days: { type: [String] },
        timezone: { type: String, default: 'Asia/Jakarta' },
      },
      _id: false,
    },
    capacity: {
      type: {
        default_daily_capacity_minutes: { type: Number, default: 960 },
        overbooking_limit_minutes: { type: Number, default: 120 },
      },
      _id: false,
      default: () => ({
        default_daily_capacity_minutes: 960,
        overbooking_limit_minutes: 120,
      }),
    },
    zones: {
      type: [
        {
          area_name: { type: String, required: true },
          min_radius_km: { type: Number, required: true },
          max_radius_km: { type: Number, required: true },
          travel_time_minutes: { type: Number, required: true },
          travel_fee: { type: Number, required: true },
        },
      ],
      default: [],
      _id: false,
    },
    sessions: { type: [String], default: [] },
    is_default_store: { type: Boolean, default: false },
    is_pick_up_available: { type: Boolean, default: false },
    is_active: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Create model
const StoreModel =
  mongoose.models.Store || mongoose.model('Store', StoreSchema);

interface ExcelRow {
  code?: string;
  name?: string;
  description?: string;
  // Location fields
  address?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  latitude?: string | number;
  longitude?: string | number;
  // Contact fields
  phone_number?: string;
  whatsapp?: string;
  email?: string;
  // Operational fields
  opening_time?: string;
  closing_time?: string;
  operational_days?: string;
  timezone?: string;
  // Capacity fields
  default_daily_capacity_minutes?: string | number;
  overbooking_limit_minutes?: string | number;
  // Other fields
  zones?: string;
  sessions?: string;
  is_default_store?: string | boolean;
  is_pick_up_available?: string | boolean;
  is_active?: string | boolean;
}

interface SeedResult {
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
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
 * Parse number values from Excel with default value
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
 * Parse array from comma or semicolon separated string
 */
function parseArray(value: any): string[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    return value
      .split(/[,;]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return [];
}

/**
 * Parse zones array from JSON string
 */
function parseZones(value: any): any[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('Failed to parse zones JSON:', error.message);
      return [];
    }
  }
  return [];
}

/**
 * Read Excel file with custom header row handling
 * (Excel has headers in rows 1-2 with merged cells, data starts from row 3)
 */
function readExcelFileWithCustomHeaders(filePath: string): any[] {
  try {
    // Resolve absolute path
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);

    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }

    // Read Excel file
    const workbook = XLSX.readFile(absolutePath);

    // Get first sheet
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Get the range of the worksheet
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
        // If row2 also has a value, combine them
        if (row2Cell && row2Cell.v && String(row2Cell.v).trim()) {
          headers.push(String(row2Cell.v).trim());
        } else {
          headers.push(currentMainHeader);
        }
      }
      // If row1 is empty but row2 has value, use row2 (it's under the merged header)
      else if (row2Cell && row2Cell.v && String(row2Cell.v).trim()) {
        headers.push(String(row2Cell.v).trim());
      }
      // If both are empty, skip or use placeholder
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

      // Only add row if it has some data
      if (hasData) {
        data.push(rowData);
      }
    }

    console.log(
      `✓ Successfully read ${data.length} rows from ${path.basename(absolutePath)}`,
    );
    console.log(
      `✓ Headers detected: ${headers
        .filter((h) => !h.startsWith('__EMPTY'))
        .slice(0, 10)
        .join(', ')}...`,
    );
    return data;
  } catch (error) {
    console.error('Error reading Excel file:', error.message);
    throw error;
  }
}

/**
 * Seeding data Store from Excel
 */
async function seedStores(): Promise<void> {
  const result: SeedResult = {
    total: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    // Connect to database
    await connectDatabase();

    // Path to Excel file
    const excelPath = path.resolve(process.cwd(), 'data/Data Store.xlsx');

    // Read Excel file (data starts from row 3)
    console.log('\n📖 Reading Excel file...');
    const data = readExcelFileWithCustomHeaders(excelPath);

    // Validate columns
    const requiredColumns = ['code', 'name'];
    if (!validateExcelColumns(data, requiredColumns)) {
      throw new Error('Excel file validation failed');
    }

    result.total = data.length;
    console.log(`\n🔄 Processing ${result.total} rows...\n`);

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i] as ExcelRow;
      const rowNumber = i + 3; // Excel row number (headers in rows 1-2, data starts from row 3)

      try {
        // Validate required fields
        if (!row.code || !row.name) {
          console.warn(
            `⚠ Row ${rowNumber}: Missing required fields (code or name)`,
          );
          result.skipped++;
          continue;
        }

        const code = row.code.trim();
        const name = row.name.trim();

        // Parse location object
        const location: any = {};
        if (row.address) location.address = row.address.trim();
        if (row.city) location.city = row.city.trim();
        if (row.province) location.province = row.province.trim();
        if (row.postal_code) location.postal_code = row.postal_code.trim();
        if (row.latitude) location.latitude = parseNumber(row.latitude);
        if (row.longitude) location.longitude = parseNumber(row.longitude);

        // Parse contact object
        const contact: any = {};
        if (row.phone_number) contact.phone_number = row.phone_number.trim();
        if (row.whatsapp) contact.whatsapp = row.whatsapp.trim();
        if (row.email) contact.email = row.email.trim();

        // Parse operational object
        const operational: any = {};
        if (row.opening_time)
          operational.opening_time = row.opening_time.trim();
        if (row.closing_time)
          operational.closing_time = row.closing_time.trim();
        if (row.operational_days)
          operational.operational_days = parseArray(row.operational_days);
        operational.timezone = row.timezone
          ? row.timezone.trim()
          : 'Asia/Jakarta';

        // Parse capacity object
        const capacity = {
          default_daily_capacity_minutes: row.default_daily_capacity_minutes
            ? parseNumber(row.default_daily_capacity_minutes, 960)
            : 960,
          overbooking_limit_minutes: row.overbooking_limit_minutes
            ? parseNumber(row.overbooking_limit_minutes, 120)
            : 120,
        };

        // Parse zones array (from JSON string)
        const zones = parseZones(row.zones);

        // Parse sessions array (from comma/semicolon separated string)
        const sessions = parseArray(row.sessions);

        // Parse boolean fields
        const is_default_store = row.is_default_store
          ? parseBoolean(row.is_default_store)
          : false;
        const is_pick_up_available = row.is_pick_up_available
          ? parseBoolean(row.is_pick_up_available)
          : false;
        const is_active = row.is_active ? parseBoolean(row.is_active) : true;

        // Prepare update data
        const updateData: any = {
          $set: {
            code: code,
            name: name,
            location: Object.keys(location).length > 0 ? location : undefined,
            contact: Object.keys(contact).length > 0 ? contact : undefined,
            operational:
              Object.keys(operational).length > 0 ? operational : undefined,
            capacity: capacity,
            zones: zones,
            sessions: sessions,
            is_default_store: is_default_store,
            is_pick_up_available: is_pick_up_available,
            is_active: is_active,
            isDeleted: false,
            deletedAt: null,
          },
        };

        // Add description if provided
        if (row.description) {
          updateData.$set.description = row.description.trim();
        }

        // Upsert based on code (unique identifier)
        const filter = { code: code };

        const updateResult = await StoreModel.updateOne(filter, updateData, {
          upsert: true,
        });

        if (updateResult.upsertedCount > 0) {
          console.log(`✓ Row ${rowNumber}: Inserted "${name}" (${code})`);
          result.inserted++;
        } else if (updateResult.modifiedCount > 0) {
          console.log(`✓ Row ${rowNumber}: Updated "${name}" (${code})`);
          result.updated++;
        } else {
          console.log(`- Row ${rowNumber}: No changes for "${name}" (${code})`);
          result.skipped++;
        }
      } catch (error) {
        console.error(`✗ Row ${rowNumber}: Error - ${error.message}`);
        result.errors++;
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 SEEDING SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total rows processed: ${result.total}`);
    console.log(`✓ Inserted: ${result.inserted}`);
    console.log(`✓ Updated: ${result.updated}`);
    console.log(`- Skipped: ${result.skipped}`);
    console.log(`✗ Errors: ${result.errors}`);
    console.log('='.repeat(50) + '\n');

    if (result.errors > 0) {
      console.warn(
        '⚠ Warning: Some rows failed to process. Check the logs above for details.\n',
      );
    } else {
      console.log('✓ Seeding completed successfully!\n');
    }
  } catch (error) {
    console.error('\n❌ Seeding failed:', error.message);
    process.exit(1);
  } finally {
    // Disconnect from database
    await disconnectDatabase();
  }
}

// Run seeding
seedStores()
  .then(() => {
    console.log('🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
