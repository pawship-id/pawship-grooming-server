// Script to clean empty email strings from database
// Run: node fix-emails.js

const { MongoClient } = require('mongodb');

async function cleanEmptyEmails() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pawship-grooming';
    const client = new MongoClient(uri);

    try {
        console.log('🔌 Connecting to MongoDB...');
        await client.connect();
        console.log('✅ Connected to MongoDB\n');

        const db = client.db();
        const users = db.collection('users');

        // Check current state
        console.log('📊 Current database state:');
        const totalUsers = await users.countDocuments({});
        console.log(`   Total users: ${totalUsers}`);

        const emptyStringEmails = await users.countDocuments({ email: '' });
        console.log(`   Users with email = "" (empty string): ${emptyStringEmails}`);

        const nullEmails = await users.countDocuments({ email: null });
        console.log(`   Users with email = null: ${nullEmails}`);

        const undefinedEmails = await users.countDocuments({ email: { $exists: false } });
        console.log(`   Users without email field: ${undefinedEmails}\n`);

        if (emptyStringEmails === 0) {
            console.log('✅ No empty string emails found. Database is clean!');
            return;
        }

        // Fix empty emails
        console.log('🔧 Fixing empty string emails...');
        const result = await users.updateMany(
            { email: '' },
            { $set: { email: null } }
        );

        console.log(`✅ Updated ${result.modifiedCount} documents\n`);

        // Verify the fix
        console.log('📊 After cleanup:');
        const remainingEmpty = await users.countDocuments({ email: '' });
        console.log(`   Users with email = "" (empty string): ${remainingEmpty}`);

        const newNullEmails = await users.countDocuments({ email: null });
        console.log(`   Users with email = null: ${newNullEmails}\n`);

        if (remainingEmpty === 0) {
            console.log('🎉 Success! All empty email strings have been cleaned!');
        } else {
            console.log('⚠️  Warning: Some empty strings remain');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await client.close();
        console.log('\n👋 Connection closed');
    }
}

cleanEmptyEmails();
