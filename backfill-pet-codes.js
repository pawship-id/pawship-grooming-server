// Script untuk mengisi field `code` (format "PET-0001") pada semua pet
// yang BELUM punya code dan BELUM dihapus (isDeleted bukan true).
// Nomor diambil dari koleksi `counters` (name: "pet", field: seq),
// di-increment per pet secara atomik. Mengikuti pola yang dipakai
// aplikasi di src/pet/pet.service.ts.
// Run: node backfill-pet-codes.js

require('dotenv').config();
const { MongoClient } = require('mongodb');

async function backfillPetCodes() {
    const uri =
        process.env.MONGODB_URI || 'mongodb://localhost:27017/pawship-grooming';
    const client = new MongoClient(uri);

    try {
        console.log('🔌 Connecting to MongoDB...');
        await client.connect();
        console.log('✅ Connected to MongoDB\n');

        const db = client.db(process.env.MONGODB_DATABASE_NAME);
        const pets = db.collection('pets');
        const counters = db.collection('counters');

        // Hanya pet yang belum dihapus (isDeleted bukan true, termasuk false/tidak ada field)
        const baseFilter = { isDeleted: { $ne: true } };

        // Pet (belum dihapus) yang belum punya code (tidak ada field, null, atau string kosong)
        const filter = {
            ...baseFilter,
            $or: [{ code: { $exists: false } }, { code: null }, { code: '' }],
        };

        // Preview state
        const totalPets = await pets.countDocuments(baseFilter);
        const toProcess = await pets.countDocuments(filter);
        const withCode = totalPets - toProcess;
        const counterDoc = await counters.findOne({ name: 'pet' });
        const startSeq = counterDoc ? counterDoc.seq : 0;

        console.log('📊 Current state:');
        console.log(`   Total pet (aktif)         : ${totalPets}`);
        console.log(`   Sudah punya code          : ${withCode}`);
        console.log(`   Akan diproses (tanpa code): ${toProcess}`);
        console.log(`   Counter "pet" seq         : ${startSeq}\n`);

        if (toProcess === 0) {
            console.log('✅ Tidak ada pet tanpa code. Tidak ada yang perlu diproses.');
            return;
        }

        // Proses sekuensial (terlama dulu) agar nomor urut konsisten
        const cursor = pets.find(filter).sort({ createdAt: 1 });

        let updated = 0;
        console.log('🔧 Generating codes...');
        while (await cursor.hasNext()) {
            const pet = await cursor.next();

            const result = await counters.findOneAndUpdate(
                { name: 'pet' },
                { $inc: { seq: 1 } },
                { upsert: true, returnDocument: 'after' },
            );
            const seq = result.seq;
            const code = `PET-${String(seq).padStart(4, '0')}`;

            await pets.updateOne({ _id: pet._id }, { $set: { code } });
            updated++;

            console.log(`   ${pet.name || '(no name)'} | ${pet._id} -> ${code}`);
        }

        const finalCounter = await counters.findOne({ name: 'pet' });
        console.log('\n📊 Selesai:');
        console.log(`   Pet di-update     : ${updated}`);
        console.log(`   Counter "pet" seq : ${startSeq} -> ${finalCounter.seq}`);
        console.log('\n🎉 Success!');
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    } finally {
        await client.close();
        console.log('\n🔌 Connection closed.');
    }
}

backfillPetCodes();
