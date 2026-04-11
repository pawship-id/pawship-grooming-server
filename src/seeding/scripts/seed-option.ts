import * as path from 'path';
import * as mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/seeding.config';
import {
  readExcelFile,
  validateExcelColumns,
} from '../utils/excel-reader.util';
import { CategoryOption } from '../../option/dto/option.dto';
import { capitalizeWords } from '../../helpers/string.helper';

// Define Option Schema (sama dengan entity)
const OptionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category_options: { type: String, required: true },
    is_active: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Create model
const OptionModel =
  mongoose.models.Option || mongoose.model('Option', OptionSchema);

interface ExcelRow {
  name: string;
  category_options: string;
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
 * Validasi apakah category_options valid
 */
function isValidCategory(category: string): boolean {
  const validCategories = Object.values(CategoryOption);
  return validCategories.includes(category as CategoryOption);
}

/**
 * Parse nilai is_active dari Excel
 */
function parseIsActive(value: any): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const lowerValue = value.toLowerCase().trim();
    return lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes';
  }
  return true; // Default value
}

/**
 * Seeding data Option dari Excel
 */
async function seedOptions(): Promise<void> {
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

    // Path ke file Excel
    const excelPath = path.resolve(process.cwd(), 'data/Data Option.xlsx');

    // Baca file Excel
    console.log('\n📖 Reading Excel file...');
    const data = readExcelFile(excelPath);

    // Validasi kolom
    const requiredColumns = ['name', 'category_options'];
    if (!validateExcelColumns(data, requiredColumns)) {
      throw new Error('Excel file validation failed');
    }

    result.total = data.length;
    console.log(`\n🔄 Processing ${result.total} rows...\n`);

    // Process setiap row
    for (let i = 0; i < data.length; i++) {
      const row = data[i] as ExcelRow;
      const rowNumber = i + 2; // Excel row number (header di row 1)

      try {
        // Validasi data
        if (!row.name || !row.category_options) {
          console.warn(
            `⚠ Row ${rowNumber}: Missing required fields (name or category_options)`,
          );
          result.skipped++;
          continue;
        }

        // Validasi category
        const category = row.category_options.trim();
        if (!isValidCategory(category)) {
          console.warn(
            `⚠ Row ${rowNumber}: Invalid category "${category}". Valid categories: ${Object.values(CategoryOption).join(', ')}`,
          );
          result.skipped++;
          continue;
        }

        // Prepare data
        const name = capitalizeWords(row.name.trim());
        const is_active = parseIsActive(row.is_active);

        // Upsert (update jika ada, insert jika tidak ada)
        const filter = {
          name: name,
          category_options: category,
        };

        const updateData = {
          $set: {
            name: name,
            category_options: category,
            is_active: is_active,
            isDeleted: false,
            deletedAt: null,
          },
        };

        const updateResult = await OptionModel.updateOne(filter, updateData, {
          upsert: true,
        });

        if (updateResult.upsertedCount > 0) {
          console.log(`✓ Row ${rowNumber}: Inserted "${name}" (${category})`);
          result.inserted++;
        } else if (updateResult.modifiedCount > 0) {
          console.log(`✓ Row ${rowNumber}: Updated "${name}" (${category})`);
          result.updated++;
        } else {
          console.log(
            `- Row ${rowNumber}: No changes for "${name}" (${category})`,
          );
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
seedOptions()
  .then(() => {
    console.log('🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
