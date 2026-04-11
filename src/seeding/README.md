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
│   └── seed-option.ts         # Script seeding untuk Option data
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
