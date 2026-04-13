import * as path from 'path';
import * as mongoose from 'mongoose';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { connectDatabase, disconnectDatabase } from '../config/seeding.config';

// Define Benefit enums
enum BenefitType {
  DISCOUNT = 'discount',
  QUOTA = 'quota',
}

enum BenefitScope {
  SERVICE = 'service',
  ADDON = 'addon',
  PICKUP = 'pickup',
}

enum BenefitPeriod {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  UNLIMITED = 'unlimited',
}

// Define MembershipBenefit Schema
const MembershipBenefitSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
    },
    applies_to: {
      type: String,
      enum: Object.values(BenefitScope),
      required: true,
    },
    service_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
    label: { type: String },
    type: { type: String, enum: Object.values(BenefitType), required: true },
    period: {
      type: String,
      enum: Object.values(BenefitPeriod),
      default: BenefitPeriod.UNLIMITED,
    },
    limit: { type: Number },
    value: { type: Number },
  },
  { _id: false },
);

// Define Membership Schema
const MembershipSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String },
    duration_months: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    note: { type: String },
    is_active: { type: Boolean, default: true },
    pet_type_ids: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Option' }],
      default: [],
    },
    benefits: {
      type: [MembershipBenefitSchema],
      default: [],
    },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Define Option Schema (for lookups)
const OptionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category_options: { type: String, required: true },
    is_active: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Define Service Schema (for lookups)
const ServiceSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    is_active: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Create models
const MembershipModel =
  mongoose.models.Membership || mongoose.model('Membership', MembershipSchema);
const OptionModel =
  mongoose.models.Option || mongoose.model('Option', OptionSchema);
const ServiceModel =
  mongoose.models.Service || mongoose.model('Service', ServiceSchema);

interface ExcelRow {
  name?: string;
  description?: string;
  duration_months?: string | number;
  price?: string | number;
  note?: string;
  pet_type_ids?: string; // Comma-separated pet type names
  pet_types?: string; // Also support this column name
  is_active?: string | boolean;
  // Benefit fields (support both with and without 'benefit_' prefix)
  applies_to?: string;
  type?: string;
  service_id?: string;
  label?: string;
  period?: string;
  limit?: string | number;
  value?: string | number;
  [key: string]: any; // For dynamic column names
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
  name: string;
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
  return true; // Default to active
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
 * Escape special characters for regex
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parse pet type IDs from comma-separated string
 * @param petTypesString - Comma-separated pet type names
 * @returns Object with pet type IDs and not found names
 */
async function parsePetTypes(
  petTypesString: string,
): Promise<{ petTypeIds: mongoose.Types.ObjectId[]; notFound: string[] }> {
  if (!petTypesString || !petTypesString.trim()) {
    return { petTypeIds: [], notFound: [] };
  }

  // Split by comma and trim spaces
  const petTypeNames = petTypesString
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  if (petTypeNames.length === 0) {
    return { petTypeIds: [], notFound: [] };
  }

  const petTypeIds: mongoose.Types.ObjectId[] = [];
  const notFound: string[] = [];

  // Find each pet type (case-insensitive)
  for (const typeName of petTypeNames) {
    const option = await OptionModel.findOne({
      name: new RegExp(`^${escapeRegex(typeName)}$`, 'i'),
      category_options: 'pet type',
      isDeleted: false,
    }).select('_id');

    if (option) {
      petTypeIds.push(option._id);
    } else {
      notFound.push(typeName);
    }
  }

  return { petTypeIds, notFound };
}

/**
 * Parse service ID from service code
 * @param serviceCode - Service code
 * @returns Service ObjectId or null if not found
 */
async function parseServiceId(
  serviceCode: string,
): Promise<mongoose.Types.ObjectId | null> {
  if (!serviceCode || !serviceCode.trim()) {
    return null;
  }

  const service = await ServiceModel.findOne({
    name: new RegExp(`^${escapeRegex(serviceCode.trim())}$`, 'i'),
    isDeleted: false,
  }).select('_id');

  return service ? service._id : null;
}

/**
 * Validate benefit scope enum
 */
function isValidBenefitScope(value: string): value is BenefitScope {
  return Object.values(BenefitScope).includes(value as BenefitScope);
}

/**
 * Validate benefit type enum
 */
function isValidBenefitType(value: string): value is BenefitType {
  return Object.values(BenefitType).includes(value as BenefitType);
}

/**
 * Validate benefit period enum
 */
function isValidBenefitPeriod(value: string): value is BenefitPeriod {
  return Object.values(BenefitPeriod).includes(value as BenefitPeriod);
}

/**
 * Parse benefit from Excel row
 * @param row - Excel row
 * @param rowNumber - Excel row number for error reporting
 * @returns Benefit object or null if no benefit data
 */
async function parseBenefit(
  row: ExcelRow,
  rowNumber: number,
): Promise<{ benefit: any; error: string | null }> {
  // Check if row has benefit data
  const appliesTo = row.applies_to;
  const benefitType = row.type;

  if (!appliesTo || !benefitType) {
    return { benefit: null, error: null };
  }

  const applies_to = appliesTo.trim().toLowerCase();
  const type = benefitType.trim().toLowerCase();

  // Validate applies_to
  if (!isValidBenefitScope(applies_to)) {
    return {
      benefit: null,
      error: `Row ${rowNumber}: Invalid benefit applies_to: "${appliesTo}". Must be: service, addon, or pickup`,
    };
  }

  // Validate type
  if (!isValidBenefitType(type)) {
    return {
      benefit: null,
      error: `Row ${rowNumber}: Invalid benefit type: "${benefitType}". Must be: discount or quota`,
    };
  }

  const benefit: any = {
    _id: new mongoose.Types.ObjectId(),
    applies_to,
    type,
    period: BenefitPeriod.UNLIMITED,
  };

  // Handle service_id or label
  const serviceId = row.service_id;
  const label = row.label;

  if (serviceId && serviceId.trim()) {
    // Look up service by code
    const foundServiceId = await parseServiceId(serviceId);
    if (!foundServiceId) {
      return {
        benefit: null,
        error: `Row ${rowNumber}: Service not found: "${serviceId}"`,
      };
    }
    benefit.service_id = foundServiceId;
  } else if (label && label.trim()) {
    // Use label
    benefit.label = label.trim();
  } else {
    return {
      benefit: null,
      error: `Row ${rowNumber}: Benefit must have either service_id or label`,
    };
  }

  // Handle period
  const periodValue = row.period;
  if (periodValue && periodValue.trim()) {
    const period = periodValue.trim().toLowerCase();
    if (!isValidBenefitPeriod(period)) {
      return {
        benefit: null,
        error: `Row ${rowNumber}: Invalid benefit period: "${periodValue}". Must be: weekly, monthly, or unlimited`,
      };
    }
    benefit.period = period;
  }

  // Handle limit
  const limitValue = row.limit;
  if (limitValue !== undefined && limitValue !== null && limitValue !== '') {
    benefit.limit = parseNumber(limitValue);
  }

  // Handle value (required for discount type)
  const valueField = row.value;
  if (type === BenefitType.DISCOUNT) {
    if (valueField === undefined || valueField === null || valueField === '') {
      return {
        benefit: null,
        error: `Row ${rowNumber}: Discount benefit must have a value (percentage)`,
      };
    }
    benefit.value = parseNumber(valueField);
  } else if (
    valueField !== undefined &&
    valueField !== null &&
    valueField !== ''
  ) {
    benefit.value = parseNumber(valueField);
  }

  return { benefit, error: null };
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
        // If row2 also has a value, use row2 as the actual column name
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
 * Group Excel rows by membership name
 * Rows without a name belong to the previous membership (additional benefits)
 */
function groupRowsByMembership(
  data: ExcelRow[],
): Map<string, { rows: ExcelRow[]; startRow: number }> {
  const membershipGroups = new Map<
    string,
    { rows: ExcelRow[]; startRow: number }
  >();
  let currentMembershipName = '';

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNumber = i + 3; // Excel row number (1-2 are headers, data starts at 3)

    // If row has a name, it's a new membership
    if (row.name && row.name.trim()) {
      currentMembershipName = row.name.trim();
      if (!membershipGroups.has(currentMembershipName)) {
        membershipGroups.set(currentMembershipName, {
          rows: [],
          startRow: rowNumber,
        });
      }
      membershipGroups.get(currentMembershipName)!.rows.push(row);
    }
    // If no name but has data, belongs to current membership
    else if (currentMembershipName) {
      // Check if row has any benefit data or other relevant fields
      const hasRelevantData =
        row.applies_to ||
        row.type ||
        Object.values(row).some((v) => v && String(v).trim());
      if (hasRelevantData) {
        membershipGroups.get(currentMembershipName)!.rows.push(row);
      }
    }
    // Otherwise, skip empty rows
  }

  return membershipGroups;
}

/**
 * Parse all benefits from grouped rows
 */
async function parseAllBenefits(
  rows: ExcelRow[],
  startRow: number,
): Promise<{ benefits: any[]; errors: string[] }> {
  const benefits: any[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = startRow + i;
    const { benefit, error } = await parseBenefit(row, rowNumber);

    if (error) {
      errors.push(error);
    } else if (benefit) {
      benefits.push(benefit);
    }
  }

  return { benefits, errors };
}

/**
 * Seeding data Membership from Excel
 */
async function seedMemberships(): Promise<void> {
  const result: SeedResult = {
    total: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  const skippedRecords: SkippedRecord[] = [];

  try {
    // Connect to database
    await connectDatabase();

    // Path to Excel file
    const excelPath = path.resolve(process.cwd(), 'data/Data Membership.xlsx');

    // Read Excel file with custom header handling
    console.log('\n📖 Reading Excel file...');
    const data = readExcelFileWithCustomHeaders(excelPath);

    // Group rows by membership name
    console.log('\n🔄 Grouping rows by membership...');
    const membershipGroups = groupRowsByMembership(data);

    result.total = membershipGroups.size;
    console.log(`\n🔄 Processing ${result.total} memberships...\n`);

    // Process each membership group
    for (const [
      membershipName,
      { rows, startRow },
    ] of membershipGroups.entries()) {
      const firstRow = rows[0];
      const rowNumber = startRow;

      try {
        console.log(`\n📝 Row ${rowNumber}: Processing "${membershipName}"`);
        console.log(`  → ${rows.length} row(s) in group`);

        // Validate required fields from first row
        if (!firstRow.duration_months || !firstRow.price) {
          console.warn(
            `  ⚠ Missing required fields (duration_months or price)`,
          );
          skippedRecords.push({
            row: rowNumber,
            name: membershipName,
            reason: 'Missing required fields: duration_months or price',
          });
          result.skipped++;
          continue;
        }

        // Parse basic fields
        const duration_months = parseNumber(firstRow.duration_months);
        const price = parseNumber(firstRow.price);

        if (duration_months < 1) {
          console.warn(
            `  ⚠ Invalid duration_months: ${duration_months} (must be >= 1)`,
          );
          skippedRecords.push({
            row: rowNumber,
            name: membershipName,
            reason: `Invalid duration_months: ${duration_months}`,
          });
          result.skipped++;
          continue;
        }

        if (price < 0) {
          console.warn(`  ⚠ Invalid price: ${price} (must be >= 0)`);
          skippedRecords.push({
            row: rowNumber,
            name: membershipName,
            reason: `Invalid price: ${price}`,
          });
          result.skipped++;
          continue;
        }

        // Parse pet_type_ids (support both column names)
        let petTypeIds: mongoose.Types.ObjectId[] = [];
        const petTypesValue = firstRow.pet_types || firstRow.pet_type_ids;
        if (petTypesValue && petTypesValue.trim()) {
          const { petTypeIds: foundPetTypeIds, notFound } =
            await parsePetTypes(petTypesValue);

          if (notFound.length > 0) {
            console.warn(
              `  ✗ Pet type(s) not found: ${notFound.join(', ')} - Skipping record`,
            );
            skippedRecords.push({
              row: rowNumber,
              name: membershipName,
              reason: `Pet type(s) not found: ${notFound.join(', ')}`,
            });
            result.skipped++;
            continue;
          }

          petTypeIds = foundPetTypeIds;
          console.log(`  ✓ Found ${petTypeIds.length} pet type(s)`);
        }

        // Parse all benefits from grouped rows
        const { benefits, errors: benefitErrors } = await parseAllBenefits(
          rows,
          startRow,
        );

        if (benefitErrors.length > 0) {
          console.warn(`  ✗ Benefit errors:`);
          benefitErrors.forEach((error) => console.warn(`    - ${error}`));
          skippedRecords.push({
            row: rowNumber,
            name: membershipName,
            reason: `Benefit errors: ${benefitErrors.join('; ')}`,
          });
          result.skipped++;
          continue;
        }

        console.log(`  ✓ Parsed ${benefits.length} benefit(s)`);

        // Check if membership exists (case-insensitive by name)
        const existingMembership = await MembershipModel.findOne({
          name: new RegExp(`^${escapeRegex(membershipName)}$`, 'i'),
        });

        // Prepare data for upsert
        const updateData: any = {
          name: membershipName,
          duration_months,
          price,
          is_active: parseBoolean(firstRow.is_active),
          pet_type_ids: petTypeIds,
          benefits,
          isDeleted: false,
          deletedAt: null,
        };

        // Add optional fields
        if (firstRow.description && firstRow.description.trim()) {
          updateData.description = firstRow.description.trim();
        }
        if (firstRow.note && firstRow.note.trim()) {
          updateData.note = firstRow.note.trim();
        }

        // Upsert (update if exists, insert if not)
        const filter = {
          name: new RegExp(`^${escapeRegex(membershipName)}$`, 'i'),
        };

        const updateResult = await MembershipModel.updateOne(
          filter,
          { $set: updateData },
          { upsert: true },
        );

        if (updateResult.upsertedCount > 0) {
          console.log(`  ✓ Inserted "${membershipName}"`);
          result.inserted++;
        } else if (updateResult.modifiedCount > 0) {
          console.log(`  ✓ Updated "${membershipName}"`);
          result.updated++;
        } else {
          console.log(`  - No changes for "${membershipName}"`);
          result.skipped++;
          skippedRecords.push({
            row: rowNumber,
            name: membershipName,
            reason: 'No changes detected',
          });
        }
      } catch (error) {
        console.error(`  ✗ Row ${rowNumber}: Error - ${error.message}`);
        skippedRecords.push({
          row: rowNumber,
          name: membershipName,
          reason: `Error: ${error.message}`,
        });
        result.errors++;
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SEEDING SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total memberships processed: ${result.total}`);
    console.log(`✓ Inserted:                  ${result.inserted}`);
    console.log(`✓ Updated:                   ${result.updated}`);
    console.log(`- Skipped:                   ${result.skipped}`);
    console.log(`✗ Errors:                    ${result.errors}`);
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
          console.log(`   - Row ${record.row}: "${record.name}"`);
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
seedMemberships()
  .then(() => {
    console.log('🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
