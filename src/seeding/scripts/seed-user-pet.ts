import * as path from 'path';
import * as mongoose from 'mongoose';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { connectDatabase, disconnectDatabase } from '../config/seeding.config';
import { hashPassword } from '../../helpers/bcrypt';

// ── Enums ────────────────────────────────────────────────────────────────────

enum UserRole {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
  GROOMER = 'groomer',
  OPS = 'ops',
}

enum MembershipEventType {
  PURCHASED = 'purchased',
  RENEWED = 'renewed',
  CANCELLED = 'cancelled',
  UPDATED = 'updated',
}

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

// ── Mongoose Schemas ─────────────────────────────────────────────────────────

// User Schema
const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone_number: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.CUSTOMER,
    },
    profile: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    is_active: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    refresh_token: { type: String },
    refresh_token_expires_at: { type: Date },
  },
  { timestamps: true },
);

// Pet Schema
const PetSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    internal_note: { type: String },
    profile_image: {
      type: {
        secure_url: { type: String },
        public_id: { type: String },
      },
      _id: false,
    },
    pet_type_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Option',
      required: true,
    },
    hair_category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Option',
    },
    birthday: { type: Date },
    size_category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Option',
      required: true,
    },
    breed_category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Option',
      required: true,
    },
    weight: { type: Number },
    tags: { type: [String], default: [] },
    last_grooming_at: { type: Date },
    last_visit_at: { type: Date },
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    is_active: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// PetMembership Schema
const PetMembershipSchema = new mongoose.Schema(
  {
    pet_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pet',
      required: true,
      index: true,
    },
    membership_plan_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Membership',
      required: true,
    },
    start_date: { type: Date, required: true, index: true },
    end_date: { type: Date, required: true, index: true },
    benefits_snapshot: {
      type: [
        {
          _id: { type: mongoose.Schema.Types.ObjectId },
          applies_to: { type: String, enum: Object.values(BenefitScope) },
          service_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
          label: { type: String },
          type: { type: String, enum: Object.values(BenefitType) },
          period: {
            type: String,
            enum: Object.values(BenefitPeriod),
            default: BenefitPeriod.UNLIMITED,
          },
          limit: { type: Number },
          value: { type: Number },
          used: { type: Number, default: 0 },
          period_reset_date: { type: Date, default: null },
        },
      ],
      default: [],
    },
    is_active: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// MembershipLog Schema
const MembershipLogSchema = new mongoose.Schema(
  {
    pet_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pet',
      required: true,
      index: true,
    },
    pet_membership_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PetMembership',
      required: true,
      index: true,
    },
    membership_plan_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Membership',
      required: true,
    },
    event_type: {
      type: String,
      enum: Object.values(MembershipEventType),
      required: true,
    },
    event_date: { type: Date, required: true, default: () => new Date() },
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
    benefits_snapshot_before: {
      type: [
        {
          _id: { type: mongoose.Schema.Types.ObjectId },
          applies_to: { type: String, enum: Object.values(BenefitScope) },
          service_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
          label: { type: String },
          type: { type: String, enum: Object.values(BenefitType) },
          period: { type: String, enum: Object.values(BenefitPeriod) },
          limit: { type: Number },
          value: { type: Number },
          used: { type: Number, default: 0 },
          period_reset_date: { type: Date, default: null },
        },
      ],
      default: [],
    },
    note: { type: String },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Option Schema (for lookups)
const OptionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category_options: { type: String, required: true },
    is_active: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Membership Schema (for lookups)
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
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// ── Models ───────────────────────────────────────────────────────────────────

const UserModel = mongoose.models.User || mongoose.model('User', UserSchema);
const PetModel = mongoose.models.Pet || mongoose.model('Pet', PetSchema);
const PetMembershipModel =
  mongoose.models.PetMembership ||
  mongoose.model('PetMembership', PetMembershipSchema);
const MembershipLogModel =
  mongoose.models.MembershipLog ||
  mongoose.model('MembershipLog', MembershipLogSchema);
const OptionModel =
  mongoose.models.Option || mongoose.model('Option', OptionSchema);
const MembershipModel =
  mongoose.models.Membership || mongoose.model('Membership', MembershipSchema);

// ── Interfaces ───────────────────────────────────────────────────────────────

interface ExcelRow {
  username?: string;
  email?: string;
  phone_number?: string;
  password?: string;
  role?: string;
  is_active?: string | boolean;
  name?: string; // pet name
  pet_type_id?: string;
  breed_category_id?: string;
  size_category_id?: string;
  hair_category_id?: string;
  'Membership Type'?: string;
  'Membership Start Date'?: string;
  'Membership End Date'?: string;
  [key: string]: any;
}

interface UserGroup {
  email: string;
  username: string;
  phone_number: string;
  password: string;
  role: string;
  is_active: boolean;
  pets: PetData[];
}

interface PetData {
  name: string;
  pet_type_id: string;
  breed_category_id: string;
  size_category_id: string;
  hair_category_id?: string;
  membership_type?: string;
  membership_start_date?: string;
  membership_end_date?: string;
}

interface SeedResult {
  total: number;
  users_created: number;
  users_updated: number;
  pets_created: number;
  pets_updated: number;
  options_created: number;
  memberships_created: number;
  logs_created: number;
  skipped: number;
  errors: number;
}

interface SkippedRecord {
  row: number;
  user_email?: string;
  pet_name?: string;
  reason: string;
}

// ── Helper Functions ─────────────────────────────────────────────────────────

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
 * Escape special characters for regex
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find Option by name and category, create if not found
 */
async function findOrCreateOption(
  name: string,
  category: string,
): Promise<{ _id: mongoose.Types.ObjectId; created: boolean }> {
  if (!name || !name.trim()) {
    throw new Error(`Option name is required for category: ${category}`);
  }

  const trimmedName = name.trim();

  // Try to find existing option (case-insensitive)
  let option = await OptionModel.findOne({
    name: new RegExp(`^${escapeRegex(trimmedName)}$`, 'i'),
    category_options: category,
    isDeleted: false,
  }).select('_id');

  if (option) {
    return { _id: option._id, created: false };
  }

  // Create new option if not found
  const newOption = await OptionModel.create({
    name: trimmedName,
    category_options: category,
    is_active: true,
    isDeleted: false,
  });

  console.log(`      ℹ Created new option: "${trimmedName}" (${category})`);

  return { _id: newOption._id, created: true };
}

/**
 * Find Membership by name
 */
async function findMembership(name: string): Promise<{
  _id: mongoose.Types.ObjectId;
  duration_months: number;
  benefits: any[];
} | null> {
  if (!name || !name.trim()) {
    return null;
  }

  const membership = await MembershipModel.findOne({
    name: new RegExp(`^${escapeRegex(name.trim())}$`, 'i'),
    isDeleted: false,
  }).select('_id duration_months benefits');

  return membership;
}

/**
 * Normalize date to midnight (00:00:00.000) in UTC timezone
 * This ensures consistent date format in database without timezone offset issues
 */
function normalizeToMidnight(date: Date): Date {
  // Create date at UTC midnight to avoid timezone offset issues
  const normalized = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0),
  );
  return normalized;
}

/**
 * Parse date from Excel (handles text date strings and various formats)
 * Returns date normalized to midnight for consistent storage format
 * Supports: ISO (YYYY-MM-DD), DD/MM/YYYY, MM/DD/YYYY, and Excel serial numbers
 */
function parseDate(value: any, debugLabel?: string): Date | null {
  if (!value) {
    return null;
  }

  // Trim whitespace if it's a string
  const trimmedValue = typeof value === 'string' ? value.trim() : value;

  if (!trimmedValue) {
    return null;
  }

  let parsedDate: Date | null = null;

  // If it's already a Date object
  if (trimmedValue instanceof Date) {
    parsedDate = trimmedValue;
  }
  // If it's a number (Excel serial date - just in case)
  else if (typeof trimmedValue === 'number') {
    const excelEpoch = new Date(1900, 0, 1);
    const days = trimmedValue - 2;
    parsedDate = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
  }
  // If it's a string, try multiple formats
  else if (typeof trimmedValue === 'string') {
    let date: Date | null = null;

    // First, try DD-MM-YYYY or DD/MM/YYYY format (common in Indonesia/Excel)
    const ddmmyyyyMatch = trimmedValue.match(
      /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,
    );
    if (ddmmyyyyMatch) {
      const [, day, month, year] = ddmmyyyyMatch;
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

      // Validate the date is valid (e.g., not 31 February)
      if (
        date.getFullYear() === parseInt(year) &&
        date.getMonth() === parseInt(month) - 1 &&
        date.getDate() === parseInt(day)
      ) {
        parsedDate = date;
      }
    }

    // If DD-MM-YYYY failed, try ISO format (YYYY-MM-DD)
    if (!parsedDate) {
      date = new Date(trimmedValue);
      if (!isNaN(date.getTime())) {
        parsedDate = date;
      }
    }

    // Debug logging if parse failed
    if (!parsedDate && debugLabel) {
      console.warn(
        `      ⚠ Failed to parse date for ${debugLabel}: "${trimmedValue}" (type: ${typeof trimmedValue})`,
      );
    }
  }

  // Normalize to midnight (00:00:00.000) for consistent format
  return parsedDate ? normalizeToMidnight(parsedDate) : null;
}

/**
 * Add months to a date and normalize to midnight
 */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  // Normalize to midnight for consistent format
  return normalizeToMidnight(result);
}

/**
 * Read Excel file with custom header row handling
 * (Excel has headers in rows 1-2 with merged cells, data starts from row 3)
 */
function readExcelFile(filePath: string): any[] {
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

    // Get the range of the worksheet
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

    // Read both row 1 and row 2 to combine headers
    const headers: string[] = [];
    for (let col = range.s.c; col <= range.e.c; col++) {
      const row1Cell = worksheet[XLSX.utils.encode_cell({ r: 0, c: col })];
      const row2Cell = worksheet[XLSX.utils.encode_cell({ r: 1, c: col })];

      const row1Value = row1Cell ? String(row1Cell.v || '').trim() : '';
      const row2Value = row2Cell ? String(row2Cell.v || '').trim() : '';

      // Combine both rows: prefer row2 if it exists, otherwise use row1
      if (row2Value) {
        headers.push(row2Value);
      } else if (row1Value) {
        headers.push(row1Value);
      } else {
        headers.push(`__EMPTY_${col}`);
      }
    }

    console.log('📋 Parsed headers:', headers.join(', '));

    // Read data rows starting from row 3 (index 2)
    const data: any[] = [];
    for (let row = 2; row <= range.e.r; row++) {
      const rowData: any = {};
      let hasData = false;

      for (let col = range.s.c; col <= range.e.c; col++) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: col })];
        const value = cell ? cell.v : '';

        if (value !== '' && value !== null && value !== undefined) {
          hasData = true;
        }

        rowData[headers[col]] = value;
      }

      // Only include rows that have at least some data
      if (hasData) {
        data.push(rowData);
      }
    }

    return data;
  } catch (error) {
    throw new Error(`Failed to read Excel file: ${error.message}`);
  }
}

/**
 * Group Excel rows by user (handle merged rows for users with multiple pets)
 */
function groupRowsByUser(rows: ExcelRow[]): UserGroup[] {
  const userGroups: UserGroup[] = [];
  let currentGroup: UserGroup | null = null;

  for (const row of rows) {
    // Check if this row starts a new user (has user fields filled)
    const hasUserData =
      row.email && row.email.trim() && row.username && row.username.trim();

    if (hasUserData) {
      // Start a new user group
      if (currentGroup) {
        userGroups.push(currentGroup);
      }

      currentGroup = {
        email: row.email!.trim(),
        username: row.username!.trim(),
        phone_number: row.phone_number?.trim() || '',
        password: row.password?.trim() || '',
        role: row.role?.trim().toLowerCase() || 'customer',
        is_active: parseBoolean(row.is_active),
        pets: [],
      };
    }

    // Add pet data to current group if it exists
    if (currentGroup && row.name && String(row.name).trim()) {
      currentGroup.pets.push({
        name: String(row.name).trim(),
        pet_type_id: row.pet_type_id ? String(row.pet_type_id).trim() : '',
        breed_category_id: row.breed_category_id
          ? String(row.breed_category_id).trim()
          : '',
        size_category_id: row.size_category_id
          ? String(row.size_category_id).trim()
          : '',
        hair_category_id: row.hair_category_id
          ? String(row.hair_category_id).trim()
          : '',
        membership_type: row['Membership Type']
          ? String(row['Membership Type']).trim()
          : '',
        membership_start_date: row['Membership Start Date']
          ? String(row['Membership Start Date'])
          : '',
        membership_end_date: row['Membership End Date']
          ? String(row['Membership End Date'])
          : '',
      });
    }
  }

  // Push the last group
  if (currentGroup) {
    userGroups.push(currentGroup);
  }

  return userGroups;
}

/**
 * Create benefits snapshot from membership benefits
 */
function createBenefitsSnapshot(benefits: any[]): any[] {
  if (!benefits || benefits.length === 0) {
    return [];
  }

  return benefits.map((benefit) => ({
    _id: benefit._id || new mongoose.Types.ObjectId(),
    applies_to: benefit.applies_to,
    service_id: benefit.service_id || null,
    label: benefit.label || null,
    type: benefit.type,
    period: benefit.period || BenefitPeriod.UNLIMITED,
    limit: benefit.limit || null,
    value: benefit.value || null,
    used: 0,
    period_reset_date: null,
  }));
}

// ── Main Seeding Function ────────────────────────────────────────────────────

async function seedUserPet(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('🌱 SEEDING USERS & PETS');
  console.log('='.repeat(60) + '\n');

  try {
    // Connect to database
    await connectDatabase();
    console.log('✓ Connected to database\n');

    // Read Excel file
    const excelFilePath = 'data/Data User dan Pet.xlsx';
    console.log(`📖 Reading Excel file: ${excelFilePath}`);
    const excelData = readExcelFile(excelFilePath);
    console.log(`✓ Read ${excelData.length} rows from Excel\n`);

    // Validate required columns
    const requiredColumns = [
      'username',
      'email',
      'phone_number',
      'password',
      'role',
      'is_active',
      'name',
      'pet_type_id',
      'breed_category_id',
      'size_category_id',
    ];

    if (excelData.length > 0) {
      const firstRow = excelData[0];
      console.log(
        '📋 Available columns in Excel:',
        Object.keys(firstRow).join(', '),
      );

      const missingColumns = requiredColumns.filter(
        (col) => !(col in firstRow),
      );

      if (missingColumns.length > 0) {
        console.error(
          `❌ Missing required columns: ${missingColumns.join(', ')}`,
        );
        console.log(
          'Note: Column names are case-sensitive. Please check the Excel file.',
        );
        throw new Error(
          `Missing required columns: ${missingColumns.join(', ')}`,
        );
      }
    }

    // Group rows by user
    console.log('📊 Grouping rows by user...');
    const userGroups = groupRowsByUser(excelData);
    console.log(`✓ Found ${userGroups.length} users\n`);

    // Initialize results tracking
    const result: SeedResult = {
      total: userGroups.length,
      users_created: 0,
      users_updated: 0,
      pets_created: 0,
      pets_updated: 0,
      options_created: 0,
      memberships_created: 0,
      logs_created: 0,
      skipped: 0,
      errors: 0,
    };

    const skippedRecords: SkippedRecord[] = [];

    // Process each user group
    console.log('🔄 Processing users and pets sequentially...');
    console.log('ℹ️  Each row will be completed before moving to the next\n');

    for (let idx = 0; idx < userGroups.length; idx++) {
      const userGroup = userGroups[idx];
      const userIndex = idx + 1;

      try {
        console.log('─'.repeat(60));
        console.log(
          `[${userIndex}/${userGroups.length}] 🔄 Processing user: ${userGroup.email}`,
        );

        // Validate user data
        if (!userGroup.email || !userGroup.username || !userGroup.password) {
          console.error(
            `  ✗ Skipped: Missing required user fields (email, username, or password)`,
          );
          skippedRecords.push({
            row: userIndex,
            user_email: userGroup.email,
            reason: 'Missing required user fields',
          });
          result.skipped++;
          continue;
        }

        if (!userGroup.phone_number) {
          console.error(`  ✗ Skipped: Missing phone_number`);
          skippedRecords.push({
            row: userIndex,
            user_email: userGroup.email,
            reason: 'Missing phone_number',
          });
          result.skipped++;
          continue;
        }

        // Validate role
        if (!Object.values(UserRole).includes(userGroup.role as UserRole)) {
          console.error(`  ✗ Skipped: Invalid role "${userGroup.role}"`);
          skippedRecords.push({
            row: userIndex,
            user_email: userGroup.email,
            reason: `Invalid role: ${userGroup.role}`,
          });
          result.skipped++;
          continue;
        }

        // Hash password
        const hashedPassword = await hashPassword(userGroup.password);

        // Upsert user
        const userUpdateResult = await UserModel.updateOne(
          { email: userGroup.email },
          {
            $set: {
              username: userGroup.username,
              phone_number: userGroup.phone_number,
              password: hashedPassword,
              role: userGroup.role,
              is_active: userGroup.is_active,
            },
          },
          { upsert: true },
        );

        // Get user ID
        const user = await UserModel.findOne({ email: userGroup.email }).select(
          '_id',
        );

        if (!user) {
          throw new Error('Failed to create/find user');
        }

        if (userUpdateResult.upsertedCount > 0) {
          console.log(`  ✓ User created`);
          result.users_created++;
        } else if (userUpdateResult.modifiedCount > 0) {
          console.log(`  ✓ User updated`);
          result.users_updated++;
        } else {
          console.log(`  - User already exists (no changes)`);
        }

        // Process pets for this user
        for (let petIdx = 0; petIdx < userGroup.pets.length; petIdx++) {
          const petData = userGroup.pets[petIdx];
          const petIndex = petIdx + 1;

          try {
            console.log(
              `  [Pet ${petIndex}/${userGroup.pets.length}] Processing pet: ${petData.name}`,
            );

            // Validate pet data
            if (
              !petData.name ||
              !petData.pet_type_id ||
              !petData.breed_category_id ||
              !petData.size_category_id
            ) {
              console.error(
                `    ✗ Skipped: Missing required pet fields (name, pet_type_id, breed_category_id, or size_category_id)`,
              );
              skippedRecords.push({
                row: userIndex,
                user_email: userGroup.email,
                pet_name: petData.name,
                reason: 'Missing required pet fields',
              });
              result.skipped++;
              continue;
            }

            // Lookup or Create Option IDs
            const petTypeResult = await findOrCreateOption(
              petData.pet_type_id,
              'pet type',
            );
            if (petTypeResult.created) result.options_created++;

            const breedCategoryResult = await findOrCreateOption(
              petData.breed_category_id,
              'breed category',
            );
            if (breedCategoryResult.created) result.options_created++;

            const sizeCategoryResult = await findOrCreateOption(
              petData.size_category_id,
              'size category',
            );
            if (sizeCategoryResult.created) result.options_created++;

            // Lookup hair category (optional)
            let hairCategoryId: mongoose.Types.ObjectId | null = null;
            if (petData.hair_category_id) {
              try {
                const hairCategoryResult = await findOrCreateOption(
                  petData.hair_category_id,
                  'hair category',
                );
                hairCategoryId = hairCategoryResult._id;
                if (hairCategoryResult.created) result.options_created++;
              } catch (error) {
                console.warn(
                  `    ⚠ Hair category error: "${petData.hair_category_id}" - ${error.message} (continuing without it)`,
                );
              }
            }

            // Upsert pet
            const petUpdateData: any = {
              name: petData.name,
              pet_type_id: petTypeResult._id,
              breed_category_id: breedCategoryResult._id,
              size_category_id: sizeCategoryResult._id,
              customer_id: user._id,
            };

            if (hairCategoryId) {
              petUpdateData.hair_category_id = hairCategoryId;
            }

            const petUpdateResult = await PetModel.updateOne(
              { name: petData.name, customer_id: user._id },
              { $set: petUpdateData },
              { upsert: true },
            );

            // Get pet ID
            const pet = await PetModel.findOne({
              name: petData.name,
              customer_id: user._id,
            }).select('_id');

            if (!pet) {
              throw new Error('Failed to create/find pet');
            }

            if (petUpdateResult.upsertedCount > 0) {
              console.log(`    ✓ Pet created`);
              result.pets_created++;
            } else if (petUpdateResult.modifiedCount > 0) {
              console.log(`    ✓ Pet updated`);
              result.pets_updated++;
            } else {
              console.log(`    - Pet already exists (no changes)`);
            }

            // Process membership (skip if "reguler" or "regular")
            const membershipTypeLower =
              petData.membership_type?.toLowerCase() || '';
            const isRegularMembership =
              membershipTypeLower === 'reguler' ||
              membershipTypeLower === 'regular';

            if (petData.membership_type && !isRegularMembership) {
              console.log(
                `    [Membership] Processing membership: ${petData.membership_type}`,
              );
              console.log(
                `      - Start Date (raw): "${petData.membership_start_date}" (type: ${typeof petData.membership_start_date})`,
              );
              console.log(
                `      - End Date (raw): "${petData.membership_end_date}" (type: ${typeof petData.membership_end_date})`,
              );

              // Find membership
              const membership = await findMembership(petData.membership_type);

              if (!membership) {
                console.warn(
                  `      ⚠ Membership not found: "${petData.membership_type}" (skipping pet membership creation)`,
                );
                // Membership not found, skip - but don't add to skipped records
                // User & Pet already created successfully
                continue;
              }

              // Membership found, check for start date
              const startDate = parseDate(
                petData.membership_start_date,
                'Start Date',
              );

              if (!startDate) {
                console.warn(
                  `      ⚠ Membership found but no start date (skipping pet membership creation)`,
                );
                // No start date, skip - but don't add to skipped records
                // User & Pet already created successfully
                continue;
              }

              // Both membership found AND start date exists - proceed with creation
              console.log(
                `      ✓ Membership found with start date - creating pet membership`,
              );
              console.log(
                `      - Parsed Start Date: ${startDate.toISOString().split('T')[0]}`,
              );

              // Calculate end date
              let endDate = parseDate(petData.membership_end_date, 'End Date');
              if (!endDate) {
                // Auto-calculate: start_date + duration_months
                endDate = addMonths(startDate, membership.duration_months);
                console.log(
                  `      ℹ Auto-calculated end date: ${endDate.toISOString().split('T')[0]} (${membership.duration_months} months from start)`,
                );
              } else {
                console.log(
                  `      - Parsed End Date: ${endDate.toISOString().split('T')[0]}`,
                );
              }

              // Create benefits snapshot
              const benefitsSnapshot = createBenefitsSnapshot(
                membership.benefits,
              );

              // Upsert pet membership
              const membershipUpdateResult = await PetMembershipModel.updateOne(
                {
                  pet_id: pet._id,
                  membership_plan_id: membership._id,
                  start_date: startDate,
                },
                {
                  $set: {
                    end_date: endDate,
                    benefits_snapshot: benefitsSnapshot,
                    is_active: true,
                  },
                },
                { upsert: true },
              );

              // Get pet membership ID
              const petMembership = await PetMembershipModel.findOne({
                pet_id: pet._id,
                membership_plan_id: membership._id,
                start_date: startDate,
              }).select('_id');

              if (!petMembership) {
                throw new Error('Failed to create/find pet membership');
              }

              if (membershipUpdateResult.upsertedCount > 0) {
                console.log(`      ✓ Pet membership created`);
                result.memberships_created++;

                // Create membership log (only for new memberships)
                const logData = {
                  pet_id: pet._id,
                  pet_membership_id: petMembership._id,
                  membership_plan_id: membership._id,
                  event_type: MembershipEventType.PURCHASED,
                  event_date: new Date(),
                  start_date: startDate,
                  end_date: endDate,
                  benefits_snapshot_before: createBenefitsSnapshot(
                    membership.benefits,
                  ),
                };

                await MembershipLogModel.create(logData);
                console.log(`      ✓ Membership log created (purchased)`);
                result.logs_created++;
              } else if (membershipUpdateResult.modifiedCount > 0) {
                console.log(`      ✓ Pet membership updated`);
              } else {
                console.log(
                  `      - Pet membership already exists (no changes)`,
                );
              }
            } else if (petData.membership_type) {
              console.log(
                `    - Skipping membership creation (type: ${petData.membership_type} - regular membership)`,
              );
            } else {
              console.log(`    - No membership data`);
            }
          } catch (error) {
            console.error(`    ✗ Error processing pet: ${error.message}`);
            skippedRecords.push({
              row: userIndex,
              user_email: userGroup.email,
              pet_name: petData.name,
              reason: `Error: ${error.message}`,
            });
            result.errors++;
          }
        }

        console.log(`  ✅ Completed row ${userIndex} (${userGroup.email})\n`);
      } catch (error) {
        console.error(`  ✗ Error processing user: ${error.message}`);
        skippedRecords.push({
          row: userIndex,
          user_email: userGroup.email,
          reason: `Error: ${error.message}`,
        });
        result.errors++;
        console.log(`  ❌ Failed row ${userIndex} (${userGroup.email})\n`);
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SEEDING SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total users processed:       ${result.total}`);
    console.log(`✓ Users created:             ${result.users_created}`);
    console.log(`✓ Users updated:             ${result.users_updated}`);
    console.log(`✓ Pets created:              ${result.pets_created}`);
    console.log(`✓ Pets updated:              ${result.pets_updated}`);
    console.log(`✓ Options created:           ${result.options_created}`);
    console.log(`✓ Memberships created:       ${result.memberships_created}`);
    console.log(`✓ Membership logs created:   ${result.logs_created}`);
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
          const petInfo = record.pet_name ? ` - Pet: ${record.pet_name}` : '';
          console.log(`   - Row ${record.row}: ${record.user_email}${petInfo}`);
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
seedUserPet()
  .then(() => {
    console.log('🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
