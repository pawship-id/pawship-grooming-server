import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Membaca file Excel dan mengembalikan data sebagai array of objects
 * @param filePath - Path relatif atau absolut ke file Excel
 * @returns Array of objects dimana setiap object merepresentasikan satu baris data
 */
export function readExcelFile(filePath: string): any[] {
  try {
    // Resolve path absolut
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);

    // Cek apakah file ada
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }

    // Baca file Excel
    const workbook = XLSX.readFile(absolutePath);

    // Ambil sheet pertama
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Convert ke JSON (array of objects)
    const data = XLSX.utils.sheet_to_json(worksheet, {
      raw: false, // Convert all cells to strings
      defval: '', // Default value untuk cell kosong
    });

    console.log(
      `✓ Successfully read ${data.length} rows from ${path.basename(absolutePath)}`,
    );
    return data;
  } catch (error) {
    console.error('Error reading Excel file:', error.message);
    throw error;
  }
}

/**
 * Validasi apakah data Excel memiliki kolom yang diperlukan
 * @param data - Array of objects dari Excel
 * @param requiredColumns - Array of required column names
 * @returns Boolean indicating if all required columns exist
 */
export function validateExcelColumns(
  data: any[],
  requiredColumns: string[],
): boolean {
  if (!data || data.length === 0) {
    console.error('Excel data is empty');
    return false;
  }

  const firstRow = data[0];
  const existingColumns = Object.keys(firstRow);

  const missingColumns = requiredColumns.filter(
    (col) => !existingColumns.includes(col),
  );

  if (missingColumns.length > 0) {
    console.error('Missing required columns:', missingColumns.join(', '));
    console.error('Existing columns:', existingColumns.join(', '));
    return false;
  }

  return true;
}
