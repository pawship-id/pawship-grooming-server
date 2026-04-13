# Seeding Scripts

Folder ini berisi script-script untuk import data awal (seeding) ke database MongoDB dari file Excel.

## 📁 Struktur Folder

```
src/seeding/
├── config/
│   └── seeding.config.ts      # Konfigurasi koneksi MongoDB untuk seeding
├── utils/
│   └── excel-reader.util.ts   # Utility untuk membaca file Excel
├── scripts/
│   ├── seed-option.ts         # Script seeding untuk Option data
│   └── seed-store.ts          # Script seeding untuk Store data
└── README.md                  # Dokumentasi ini
```

## 🚀 Cara Menggunakan

### Prerequisites

1. Pastikan file `.env` sudah dikonfigurasi dengan variabel:

   ```env
   MONGODB_URI=your_mongodb_connection_string
   MONGODB_DATABASE_NAME=your_database_name
   ```

2. Pastikan file Excel yang akan di-import sudah ada di folder `data/`

### Menjalankan Seeding

#### Option Data

```bash
npm run seed:option
```

Script ini akan:

- Membaca data dari `data/Data Option.xlsx`
- Memvalidasi data (nama, category_options)
- Melakukan **upsert** (update jika sudah ada, insert jika belum ada)
- Menampilkan summary hasil seeding

**Output contoh:**

```
✓ Successfully read 50 rows from Data Option.xlsx

🔄 Processing 50 rows...

✓ Row 2: Inserted "Short Hair" (hair category)
✓ Row 3: Updated "Long Hair" (hair category)
- Row 4: No changes for "Medium Hair" (hair category)
⚠ Row 5: Missing required fields (name or category_options)
✗ Row 6: Error - Invalid category

==================================================
📊 SEEDING SUMMARY
==================================================
Total rows processed: 50
✓ Inserted: 20
✓ Updated: 15
- Skipped: 10
✗ Errors: 5
==================================================
```

## 📝 Format File Excel

### Option Data (`Data Option.xlsx`)

| Kolom              | Tipe           | Wajib | Deskripsi                           | Contoh                                       |
| ------------------ | -------------- | ----- | ----------------------------------- | -------------------------------------------- |
| `name`             | String         | Ya    | Nama option                         | "Short Hair", "Small", "Dog"                 |
| `category_options` | String         | Ya    | Kategori option (harus sesuai enum) | "hair category", "size category", "pet type" |
| `is_active`        | Boolean/String | Tidak | Status aktif (default: true)        | true, false, "true", "false", "1", "0"       |

#### Valid Category Options

- `hair category` - Jenis bulu hewan (contoh: Short Hair, Long Hair)
- `size category` - Ukuran hewan (contoh: Small, Medium, Large)
- `breed category` - Keturunan hewan (contoh: Pom, Ras Mix)
- `member category` - Kategori member (contoh: Regular, VIP)
- `customer category` - Kategori customer (contoh: Prioritas)
- `pet type` - Jenis hewan (contoh: Dog, Cat, Other)

**Contoh data Excel:**

| name       | category_options | is_active |
| ---------- | ---------------- | --------- |
| Short Hair | hair category    | true      |
| Long Hair  | hair category    | true      |
| Small      | size category    | true      |
| Medium     | size category    | true      |
| Dog        | pet type         | true      |
| Cat        | pet type         | true      |

#### Store Data

```bash
npm run seed:store
```

Script ini akan:

- Membaca data dari `data/Data Store.xlsx` (header di row 1-2, data mulai row 3)
- Memvalidasi data (code, name)
- Melakukan **upsert** berdasarkan `code`
- Menampilkan summary hasil seeding

**Output contoh:**

```
✓ Successfully read 5 rows from Data Store.xlsx

🔄 Processing 5 rows...

✓ Row 3: Inserted "Store Jakarta Pusat" (JKT-001)
✓ Row 4: Updated "Store Bandung" (BDG-001)
- Row 5: No changes for "Store Surabaya" (SBY-001)

==================================================
📊 SEEDING SUMMARY
==================================================
Total rows processed: 5
✓ Inserted: 2
✓ Updated: 2
- Skipped: 1
✗ Errors: 0
==================================================
```

### Store Data (`Data Store.xlsx`)

**Note:** Excel file memiliki header di row 1 & 2, data mulai dari row 3.

| Kolom                            | Tipe           | Wajib | Deskripsi                                   | Contoh                                 |
| -------------------------------- | -------------- | ----- | ------------------------------------------- | -------------------------------------- |
| `code`                           | String         | Ya    | Kode store (unique)                         | "JKT-001", "BDG-001"                   |
| `name`                           | String         | Ya    | Nama store                                  | "Store Jakarta Pusat"                  |
| `description`                    | String         | Tidak | Deskripsi store                             | "Store utama di Jakarta"               |
| `address`                        | String         | Tidak | Alamat lengkap                              | "Jl. Sudirman No. 123"                 |
| `city`                           | String         | Tidak | Kota                                        | "Jakarta"                              |
| `province`                       | String         | Tidak | Provinsi                                    | "DKI Jakarta"                          |
| `postal_code`                    | String         | Tidak | Kode pos                                    | "12190"                                |
| `latitude`                       | Number         | Tidak | Koordinat latitude                          | -6.2088                                |
| `longitude`                      | Number         | Tidak | Koordinat longitude                         | 106.8456                               |
| `phone_number`                   | String         | Tidak | Nomor telepon                               | "021-12345678"                         |
| `whatsapp`                       | String         | Tidak | Nomor WhatsApp                              | "628123456789"                         |
| `email`                          | String         | Tidak | Email                                       | "store@example.com"                    |
| `opening_time`                   | String         | Tidak | Jam buka                                    | "09:00"                                |
| `closing_time`                   | String         | Tidak | Jam tutup                                   | "18:00"                                |
| `operational_days`               | String         | Tidak | Hari operasional (comma-separated)          | "Monday,Tuesday,Wednesday"             |
| `timezone`                       | String         | Tidak | Timezone (default: "Asia/Jakarta")          | "Asia/Jakarta"                         |
| `default_daily_capacity_minutes` | Number         | Tidak | Kapasitas harian dalam menit (default: 960) | 960                                    |
| `overbooking_limit_minutes`      | Number         | Tidak | Limit overbooking (default: 120)            | 120                                    |
| `zones`                          | String (JSON)  | Tidak | Zones dalam format JSON array               | (lihat contoh di bawah)                |
| `sessions`                       | String         | Tidak | Sessions (comma-separated)                  | "morning,afternoon,evening"            |
| `is_default_store`               | Boolean/String | Tidak | Default store (default: false)              | true, false, "true", "false", "1", "0" |
| `is_pick_up_available`           | Boolean/String | Tidak | Pickup tersedia (default: false)            | true, false, "true", "false", "1", "0" |
| `is_active`                      | Boolean/String | Tidak | Status aktif (default: true)                | true, false, "true", "false", "1", "0" |

**Contoh zones JSON:**

```json
[
  {
    "area_name": "Zone A",
    "min_radius_km": 0,
    "max_radius_km": 5,
    "travel_time_minutes": 30,
    "travel_fee": 50000
  },
  {
    "area_name": "Zone B",
    "min_radius_km": 5,
    "max_radius_km": 10,
    "travel_time_minutes": 60,
    "travel_fee": 100000
  }
]
```

**Contoh data Excel:**

| code    | name                | city     | opening_time | closing_time | operational_days         | is_active |
| ------- | ------------------- | -------- | ------------ | ------------ | ------------------------ | --------- |
| JKT-001 | Store Jakarta Pusat | Jakarta  | 09:00        | 18:00        | Monday,Tuesday,Wednesday | true      |
| BDG-001 | Store Bandung       | Bandung  | 10:00        | 19:00        | Monday,Tuesday,Friday    | true      |
| SBY-001 | Store Surabaya      | Surabaya | 08:00        | 17:00        | Monday,Tuesday,Thursday  | true      |

## ⚙️ Cara Kerja Upsert

Script menggunakan strategi **upsert** dengan kombinasi `name` + `category_options` sebagai unique identifier:

- **Insert**: Jika data dengan kombinasi `name` dan `category_options` belum ada
- **Update**: Jika data dengan kombinasi tersebut sudah ada
- **Skip**: Jika data tidak berubah

Ini berarti Anda bisa menjalankan script berkali-kali tanpa membuat data duplikat.

## 🔧 Membuat Seeding Script Baru

Untuk membuat seeding script baru (misal untuk Entity lain):

1. **Buat file script baru** di `src/seeding/scripts/`

   ```typescript
   // src/seeding/scripts/seed-your-entity.ts
   import {
     connectDatabase,
     disconnectDatabase,
   } from '../config/seeding.config';
   import {
     readExcelFile,
     validateExcelColumns,
   } from '../utils/excel-reader.util';

   async function seedYourEntity(): Promise<void> {
     await connectDatabase();

     // Read Excel
     const data = readExcelFile('data/Your Data.xlsx');

     // Validate columns
     validateExcelColumns(data, ['column1', 'column2']);

     // Process data...

     await disconnectDatabase();
   }

   seedYourEntity()
     .then(() => process.exit(0))
     .catch((error) => {
       console.error(error);
       process.exit(1);
     });
   ```

2. **Tambahkan NPM script** di `package.json`

   ```json
   {
     "scripts": {
       "seed:your-entity": "ts-node -r tsconfig-paths/register src/seeding/scripts/seed-your-entity.ts"
     }
   }
   ```

3. **Siapkan file Excel** di folder `data/`

4. **Jalankan script**
   ```bash
   npm run seed:your-entity
   ```

## 🛠️ Utilities

### `readExcelFile(filePath: string)`

Membaca file Excel dan mengembalikan array of objects.

```typescript
const data = readExcelFile('data/Data Option.xlsx');
// Returns: [{ name: "Short Hair", category_options: "hair category", ... }, ...]
```

### `validateExcelColumns(data: any[], requiredColumns: string[])`

Validasi apakah Excel memiliki kolom yang diperlukan.

```typescript
const isValid = validateExcelColumns(data, ['name', 'category_options']);
// Returns: true/false
```

### `connectDatabase()` & `disconnectDatabase()`

Mengelola koneksi MongoDB untuk seeding scripts.

```typescript
await connectDatabase();
// ... do seeding ...
await disconnectDatabase();
```

## 📋 Troubleshooting

### Error: File not found

Pastikan file Excel ada di folder `data/` dan path-nya benar.

### Error: MONGODB_URI is not defined

Pastikan file `.env` ada dan memiliki variabel `MONGODB_URI` dan `MONGODB_DATABASE_NAME`.

### Error: Missing required columns

Periksa nama kolom di Excel file. Harus sesuai dengan yang diperlukan (case-sensitive).

### Error: Invalid category

Category option harus sesuai dengan enum yang sudah didefinisikan. Lihat daftar valid categories di atas.

## 📦 Dependencies

- `xlsx` - Library untuk membaca file Excel
- `mongoose` - MongoDB ODM
- `dotenv` - Load environment variables

## 👨‍💻 Development

Untuk menambahkan fitur baru atau memodifikasi seeding script:

1. Edit file di `src/seeding/`
2. Test dengan menjalankan script: `npm run seed:option`
3. Periksa output dan database untuk memastikan hasil sesuai

---

**Note:** Seeding scripts ini dirancang untuk development dan initial data setup. Untuk production data migration, pertimbangkan menggunakan proper migration tools atau database backup/restore.
