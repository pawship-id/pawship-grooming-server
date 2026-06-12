// Script untuk mengisi field `code` (format "CUST-0005") pada semua user
// dengan role "customer" yang BELUM punya code.
// Nomor diambil dari koleksi `counters` (name: "customer", field: seq),
// di-increment per customer secara atomik. Mengikuti pola yang dipakai
// aplikasi di src/user/user.service.ts.
// Run: node backfill-customer-codes.js

require('dotenv').config();
const { MongoClient } = require('mongodb');

async function backfillCustomerCodes() {
    const uri =
        process.env.MONGODB_URI || 'mongodb://localhost:27017/pawship-grooming';
    const client = new MongoClient(uri);

    try {
        console.log('🔌 Connecting to MongoDB...');
        await client.connect();
        console.log('✅ Connected to MongoDB\n');

        const db = client.db(process.env.MONGODB_DATABASE_NAME);
        const users = db.collection('users');
        const counters = db.collection('counters');

        // Hanya customer yang belum dihapus (isDeleted bukan true, termasuk false/tidak ada field)
        const baseFilter = { role: 'customer', isDeleted: { $ne: true } };

        // Customer (belum dihapus) yang belum punya code (tidak ada field, null, atau string kosong)
        const filter = {
            ...baseFilter,
            $or: [{ code: { $exists: false } }, { code: null }, { code: '' }],
        };

        // Preview state
        const totalCustomers = await users.countDocuments(baseFilter);
        const toProcess = await users.countDocuments(filter);
        const withCode = totalCustomers - toProcess;
        const counterDoc = await counters.findOne({ name: 'customer' });
        const startSeq = counterDoc ? counterDoc.seq : 0;

        console.log('📊 Current state:');
        console.log(`   Total customer (aktif)    : ${totalCustomers}`);
        console.log(`   Sudah punya code          : ${withCode}`);
        console.log(`   Akan diproses (tanpa code): ${toProcess}`);
        console.log(`   Counter "customer" seq    : ${startSeq}\n`);

        if (toProcess === 0) {
            console.log('✅ Tidak ada customer tanpa code. Tidak ada yang perlu diproses.');
            return;
        }

        // Proses sekuensial (terlama dulu) agar nomor urut konsisten
        const cursor = users.find(filter).sort({ createdAt: 1 });

        let updated = 0;
        console.log('🔧 Generating codes...');
        while (await cursor.hasNext()) {
            const user = await cursor.next();

            const result = await counters.findOneAndUpdate(
                { name: 'customer' },
                { $inc: { seq: 1 } },
                { upsert: true, returnDocument: 'after' },
            );
            const seq = result.seq;
            const code = `CUST-${String(seq).padStart(4, '0')}`;

            await users.updateOne({ _id: user._id }, { $set: { code } });
            updated++;

            console.log(`   ${user.username || '(no username)'} | ${user._id} -> ${code}`);
        }

        const finalCounter = await counters.findOne({ name: 'customer' });
        console.log('\n📊 Selesai:');
        console.log(`   Customer di-update     : ${updated}`);
        console.log(`   Counter "customer" seq : ${startSeq} -> ${finalCounter.seq}`);
        console.log('\n🎉 Success!');
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    } finally {
        await client.close();
        console.log('\n🔌 Connection closed.');
    }
}

backfillCustomerCodes();
