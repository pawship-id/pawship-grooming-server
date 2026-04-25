import { connect, connection } from 'mongoose';

/**
 * Script to fix existing users with empty string emails
 * Converts email = "" to email = null/undefined for sparse unique index to work
 */
async function fixEmptyEmails() {
  try {
    // Connect to MongoDB
    const mongoUri =
      process.env.MONGODB_URI || 'mongodb://localhost:27017/pawship-grooming';
    await connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const db = connection.db;
    if (!db) throw new Error('Database not connected');

    // First, check how many users have empty email
    const emptyEmailCount = await db.collection('users').countDocuments({
      $or: [
        { email: '' },
        { email: { $exists: true, $type: 'string', $eq: '' } },
      ],
    });
    console.log(`📊 Found ${emptyEmailCount} users with empty email strings`);

    if (emptyEmailCount === 0) {
      console.log('✅ No users with empty email found. Nothing to fix.');
      await connection.close();
      process.exit(0);
    }

    // Update all documents where email is empty string to null
    const result = await db.collection('users').updateMany(
      {
        $or: [
          { email: '' },
          { email: { $exists: true, $type: 'string', $eq: '' } },
        ],
      },
      {
        $set: { email: null },
      },
    );

    console.log(
      `✅ Fixed ${result.modifiedCount} users with empty email strings`,
    );

    // Verify the fix
    const remainingEmpty = await db.collection('users').countDocuments({
      email: '',
    });
    console.log(`📊 Remaining users with empty string: ${remainingEmpty}`);

    // Close connection
    await connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing empty emails:', error);
    await connection.close();
    process.exit(1);
  }
}

// Run the script
fixEmptyEmails();
