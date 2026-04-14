import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/test';
const DB_NAME = process.env.DB_NAME || 'db_pawship_grooming_development';

// Define minimal schema for PetMembership
const PetMembershipSchema = new mongoose.Schema(
  {
    pet_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet' },
    membership_plan_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Membership',
    },
    start_date: Date,
    end_date: Date,
    is_active: Boolean,
  },
  { timestamps: true },
);

const PetMembershipModel = mongoose.model(
  'PetMembership',
  PetMembershipSchema,
  'petmemberships',
);

async function checkDates() {
  console.log('============================================================');
  console.log('🔍 Checking Date Formats in PetMembership');
  console.log('============================================================\n');

  try {
    // Connect to MongoDB
    console.log(`Connecting to MongoDB: ${DB_NAME}...`);
    await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
    console.log('✓ Connected to MongoDB successfully\n');

    // Get sample pet memberships with dates
    const memberships = await PetMembershipModel.find()
      .limit(5)
      .select('start_date end_date createdAt')
      .lean();

    console.log(`Found ${memberships.length} pet memberships\n`);

    memberships.forEach((membership: any, index) => {
      console.log(`[${index + 1}]`);
      console.log(`  _id: ${membership._id}`);
      console.log(`  start_date (raw): ${membership.start_date}`);
      if (membership.start_date) {
        console.log(
          `  start_date (ISO): ${new Date(membership.start_date).toISOString()}`,
        );
        console.log(
          `  start_date (local): ${new Date(membership.start_date).toString()}`,
        );
        console.log(
          `  start_date (valueOf): ${new Date(membership.start_date).valueOf()}`,
        );
      }
      console.log(`  end_date (raw): ${membership.end_date}`);
      if (membership.end_date) {
        console.log(
          `  end_date (ISO): ${new Date(membership.end_date).toISOString()}`,
        );
      }
      if (membership.createdAt) {
        console.log(
          `  createdAt (ISO): ${new Date(membership.createdAt).toISOString()}`,
        );
      }
      console.log('');
    });

    // Disconnect
    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

checkDates();
