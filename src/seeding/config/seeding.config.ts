import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Koneksi ke MongoDB untuk seeding scripts
 * @returns Promise<mongoose.Connection>
 */
export async function connectDatabase(): Promise<mongoose.Connection> {
  try {
    const uri = process.env.MONGODB_URI;
    const dbName = process.env.MONGODB_DATABASE_NAME;

    if (!uri) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    if (!dbName) {
      throw new Error(
        'MONGODB_DATABASE_NAME is not defined in environment variables',
      );
    }

    console.log(`Connecting to MongoDB: ${dbName}...`);

    await mongoose.connect(uri, {
      dbName: dbName,
    });

    console.log('✓ Connected to MongoDB successfully');

    return mongoose.connection;
  } catch (error) {
    console.error('Error connecting to MongoDB:', error.message);
    throw error;
  }
}

/**
 * Tutup koneksi MongoDB
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB');
  } catch (error) {
    // Ignore errors - connection might already be closed
    console.log('✓ MongoDB connection closed');
  }
}
