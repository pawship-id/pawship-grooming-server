// Simple JavaScript script to verify date formats (no TypeScript issues)
const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/test';
const DB_NAME = process.env.DB_NAME || 'db_pawship_grooming_development';

const PetMembershipSchema = new mongoose.Schema({
    pet_id: mongoose.Schema.Types.ObjectId,
    membership_plan_id: mongoose.Schema.Types.ObjectId,
    start_date: Date,
    end_date: Date,
    is_active: Boolean,
}, { timestamps: true });

const PetMembershipModel = mongoose.model('PetMembership', PetMembershipSchema, 'petmemberships');

async function verifyDates() {
    console.log('============================================================');
    console.log('🔍 Verifying Date Formats in PetMembership');
    console.log('============================================================\n');

    try {
        // Connect to MongoDB
        console.log(`Connecting to MongoDB: ${DB_NAME}...`);
        await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
        console.log('✓ Connected to MongoDB successfully\n');

        // Get sample pet memberships with dates
        const memberships = await PetMembershipModel.find()
            .sort({ createdAt: -1 }) // Get most recent
            .limit(10)
            .select('start_date end_date createdAt updatedAt')
            .populate('pet_id', 'name')
            .lean();

        console.log(`Found ${memberships.length} pet memberships (showing most recent)\n`);

        memberships.forEach((membership, index) => {
            const startDate = new Date(membership.start_date);
            const endDate = new Date(membership.end_date);

            console.log(`[${index + 1}] Pet: ${membership.pet_id?.name || 'Unknown'}`);
            console.log(`  start_date:`);
            console.log(`    - ISO: ${startDate.toISOString()}`);
            console.log(`    - Local: ${startDate.toString()}`);
            console.log(`    - Date only: ${startDate.toISOString().split('T')[0]}`);
            console.log(`    - Time: ${startDate.toISOString().split('T')[1]}`);
            console.log(`    - Hours: ${startDate.getHours()}h ${startDate.getMinutes()}m ${startDate.getSeconds()}s`);

            console.log(`  end_date:`);
            console.log(`    - ISO: ${endDate.toISOString()}`);
            console.log(`    - Date only: ${endDate.toISOString().split('T')[0]}`);
            console.log(`    - Hours: ${endDate.getHours()}h ${endDate.getMinutes()}m ${endDate.getSeconds()}s`);

            // Check if normalized to midnight
            const isStartMidnight = startDate.getHours() === 0 &&
                startDate.getMinutes() === 0 &&
                startDate.getSeconds() === 0 &&
                startDate.getMilliseconds() === 0;
            const isEndMidnight = endDate.getHours() === 0 &&
                endDate.getMinutes() === 0 &&
                endDate.getSeconds() === 0 &&
                endDate.getMilliseconds() === 0;

            console.log(`  ✓ Normalized to midnight: start=${isStartMidnight}, end=${isEndMidnight}`);
            console.log('');
        });

        // Disconnect
        await mongoose.disconnect();
        console.log('✓ Disconnected from MongoDB');
        console.log('🎉 Done!\n');
    } catch (error) {
        console.error('❌ Error:', error.message);
        await mongoose.disconnect();
        process.exit(1);
    }
}

verifyDates();
