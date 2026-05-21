import { connect, connection } from 'mongoose';

/**
 * One-off script: populate Booking.completed_at for legacy rows.
 *
 * Reads the latest status_logs entry with status="completed" and copies its
 * timestamp into the new completed_at field. Falls back to updatedAt when
 * the log entry is missing.
 *
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/backfill-completed-at.ts
 */
async function backfillCompletedAt() {
  const mongoUri =
    process.env.MONGODB_URI || 'mongodb://localhost:27017/pawship-grooming';
  const dbName = process.env.MONGODB_DATABASE_NAME;

  await connect(mongoUri, dbName ? { dbName } : undefined);
  console.log('✅ Connected to MongoDB');

  const db = connection.db;
  if (!db) throw new Error('Database not connected');

  const collection = db.collection('bookings');

  const cursor = collection.find({
    booking_status: 'completed',
    $or: [{ completed_at: null }, { completed_at: { $exists: false } }],
  });

  let scanned = 0;
  let updated = 0;
  let fallback = 0;

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    if (!doc) break;
    scanned += 1;

    let completedAt: Date | null = null;

    if (Array.isArray(doc.status_logs)) {
      const completedLogs = doc.status_logs
        .filter((log: any) => log?.status === 'completed' && log?.timestamp)
        .map((log: any) => new Date(log.timestamp));

      if (completedLogs.length) {
        completedAt = new Date(
          Math.max(...completedLogs.map((d: Date) => d.getTime())),
        );
      }
    }

    if (!completedAt && doc.updatedAt) {
      completedAt = new Date(doc.updatedAt);
      fallback += 1;
    }

    if (!completedAt) {
      console.warn(
        `⚠️  Booking ${doc._id} has status=completed but no usable timestamp — skipped`,
      );
      continue;
    }

    await collection.updateOne(
      { _id: doc._id },
      { $set: { completed_at: completedAt } },
    );
    updated += 1;
  }

  console.log(`📊 Scanned ${scanned} legacy completed bookings`);
  console.log(`✅ Updated ${updated} (${fallback} used updatedAt fallback)`);

  const remaining = await collection.countDocuments({
    booking_status: 'completed',
    $or: [{ completed_at: null }, { completed_at: { $exists: false } }],
  });
  console.log(`🔎 Remaining without completed_at: ${remaining}`);

  await connection.close();
  process.exit(0);
}

backfillCompletedAt().catch((err) => {
  console.error('❌ Backfill failed:', err);
  process.exit(1);
});
