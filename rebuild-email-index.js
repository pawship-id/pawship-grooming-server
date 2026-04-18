// Script to rebuild email index as sparse unique
// This fixes the issue where multiple null emails are not allowed
// Run: node rebuild-email-index.js

const { MongoClient } = require('mongodb');

async function rebuildEmailIndex() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pawship-grooming';
    const client = new MongoClient(uri);

    try {
        console.log('🔌 Connecting to MongoDB...');
        await client.connect();
        console.log('✅ Connected to MongoDB\n');

        const db = client.db();
        const users = db.collection('users');

        // 1. Check existing indexes
        console.log('📋 Current indexes:');
        const indexes = await users.indexes();
        indexes.forEach(idx => {
            console.log(`   - ${idx.name}:`, JSON.stringify(idx.key), idx.sparse ? '(sparse)' : '');
        });
        console.log('');

        // 2. Drop old email_1 index if exists
        try {
            console.log('🗑️  Dropping old email_1 index...');
            await users.dropIndex('email_1');
            console.log('✅ Old index dropped\n');
        } catch (error) {
            if (error.code === 27) {
                console.log('⚠️  Index email_1 does not exist, skipping drop\n');
            } else {
                throw error;
            }
        }

        // 3. Create new sparse unique index
        console.log('🔨 Creating new sparse unique index on email...');
        await users.createIndex(
            { email: 1 },
            {
                unique: true,
                sparse: true,
                name: 'email_1'
            }
        );
        console.log('✅ New sparse unique index created\n');

        // 4. Verify new indexes
        console.log('📋 Updated indexes:');
        const newIndexes = await users.indexes();
        newIndexes.forEach(idx => {
            console.log(`   - ${idx.name}:`, JSON.stringify(idx.key), idx.sparse ? '(sparse)' : '');
        });
        console.log('');

        // 5. Test: Count users with null email
        const nullEmailCount = await users.countDocuments({ email: null });
        console.log(`📊 Users with email = null: ${nullEmailCount}`);

        const undefinedEmailCount = await users.countDocuments({ email: { $exists: false } });
        console.log(`📊 Users without email field: ${undefinedEmailCount}`);

        console.log('\n🎉 Success! Email index is now sparse unique.');
        console.log('   Multiple users can now have null/undefined email values.');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    } finally {
        await client.close();
        console.log('\n👋 Connection closed');
    }
}

rebuildEmailIndex();
