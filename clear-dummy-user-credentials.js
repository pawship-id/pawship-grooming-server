// Script to unset email and password fields for dummy customer accounts
// whose email starts with "customerpawship"
// Run: node clear-dummy-user-credentials.js

require('dotenv').config();
const { MongoClient } = require('mongodb');

async function clearDummyUserCredentials() {
    const uri =
        process.env.MONGODB_URI || 'mongodb://localhost:27017/pawship-grooming';
    const client = new MongoClient(uri);

    try {
        console.log('🔌 Connecting to MongoDB...');
        await client.connect();
        console.log('✅ Connected to MongoDB\n');

        const db = client.db(process.env.MONGODB_DATABASE_NAME);
        const users = db.collection('users');

        const filter = { email: { $regex: '^customerpawship', $options: 'i' } };

        // Preview affected documents
        const affected = await users.countDocuments(filter);
        console.log(
            `📊 Found ${affected} user(s) with email starting with "customerpawship"\n`,
        );

        if (affected === 0) {
            console.log('✅ No matching users found. Nothing to do.');
            return;
        }

        // Show preview
        const preview = await users
            .find(filter)
            .project({ _id: 1, username: 1, email: 1, role: 1 })
            .toArray();

        console.log('📋 Users to be updated:');
        preview.forEach((u) => {
            console.log(`   - [${u._id}] ${u.username} | ${u.email} | ${u.role}`);
        });
        console.log('');

        // Remove email and password fields
        const result = await users.updateMany(filter, {
            $unset: { email: '', password: '' },
            $set: { refresh_token: null, refresh_token_expires_at: null },
        });

        console.log(`✅ Done! ${result.modifiedCount} user(s) updated.`);
        console.log(
            '   Fields removed: email, password, refresh_token, refresh_token_expires_at',
        );
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    } finally {
        await client.close();
        console.log('\n🔌 Connection closed.');
    }
}

clearDummyUserCredentials();
