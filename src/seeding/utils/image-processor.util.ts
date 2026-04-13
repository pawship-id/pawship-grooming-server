import axios from 'axios';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Convert Google Drive share link to direct download URL
 * @param url - Google Drive share URL
 * @returns Direct download URL
 */
function convertGoogleDriveUrl(url: string): string {
  // Pattern: https://drive.google.com/file/d/{FILE_ID}/view?usp=sharing
  const match = url.match(/\/file\/d\/([^/]+)/);
  if (match && match[1]) {
    const fileId = match[1];
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }
  return url; // Return original if not a Google Drive link
}

/**
 * Download image from URL
 * @param url - Image URL (supports Google Drive links)
 * @returns Buffer containing image data
 */
export async function downloadImageFromUrl(url: string): Promise<Buffer> {
  try {
    // Convert Google Drive URL if needed
    const downloadUrl = convertGoogleDriveUrl(url);

    console.log(`  → Downloading image from URL...`);

    const response = await axios.get(downloadUrl, {
      responseType: 'arraybuffer',
      timeout: 30000, // 30 second timeout
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      },
    });

    if (response.status !== 200) {
      throw new Error(`Failed to download image: HTTP ${response.status}`);
    }

    const buffer = Buffer.from(response.data as ArrayBuffer);
    console.log(`  → Downloaded ${(buffer.length / 1024).toFixed(2)} KB`);

    return buffer;
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      throw new Error('Download timeout: Image took too long to download');
    }
    throw new Error(`Failed to download image: ${error.message}`);
  }
}

/**
 * Check if file is HEIC format based on buffer magic bytes or filename
 * @param buffer - Image buffer
 * @param filename - Original filename (optional)
 * @returns true if HEIC format
 */
function isHeicFormat(buffer: Buffer, filename?: string): boolean {
  // Check filename extension
  if (filename && /\.heic$/i.test(filename)) {
    return true;
  }

  // Check magic bytes for HEIC (ftyp box with heic/heix/hevc/hevx brand)
  const header = buffer.toString('ascii', 4, 12);
  return /ftyp(heic|heix|hevc|hevx|mif1)/.test(header);
}

/**
 * Convert HEIC image to PNG format
 * @param buffer - HEIC image buffer
 * @returns PNG image buffer
 */
export async function convertHeicToPng(buffer: Buffer): Promise<Buffer> {
  try {
    console.log(`  → Converting HEIC to PNG...`);
    const pngBuffer = await sharp(buffer).png().toBuffer();
    console.log(
      `  → Converted to PNG (${(pngBuffer.length / 1024).toFixed(2)} KB)`,
    );
    return pngBuffer;
  } catch (error) {
    throw new Error(`Failed to convert HEIC to PNG: ${error.message}`);
  }
}

/**
 * Compress image if larger than 2MB
 * @param buffer - Image buffer
 * @param maxSizeBytes - Maximum size in bytes (default: 2MB)
 * @returns Compressed image buffer
 */
export async function compressImage(
  buffer: Buffer,
  maxSizeBytes: number = 2 * 1024 * 1024, // 2MB
): Promise<Buffer> {
  try {
    const originalSize = buffer.length;

    // Check if compression is needed
    if (originalSize <= maxSizeBytes) {
      console.log(
        `  → Image size OK (${(originalSize / 1024).toFixed(2)} KB), no compression needed`,
      );
      return buffer;
    }

    console.log(
      `  → Image size ${(originalSize / 1024 / 1024).toFixed(2)} MB exceeds 2MB, compressing...`,
    );

    const metadata = await sharp(buffer).metadata();

    // Calculate compression quality based on size
    let quality = 80;
    const sizeRatio = originalSize / maxSizeBytes;

    if (sizeRatio > 4) {
      quality = 60;
    } else if (sizeRatio > 2) {
      quality = 70;
    }

    let compressedBuffer: Buffer;

    // Compress based on format
    if (metadata.format === 'jpeg' || metadata.format === 'jpg') {
      compressedBuffer = await sharp(buffer)
        .jpeg({ quality, progressive: true })
        .toBuffer();
    } else if (metadata.format === 'png') {
      compressedBuffer = await sharp(buffer)
        .png({ quality, compressionLevel: 9 })
        .toBuffer();
    } else if (metadata.format === 'webp') {
      compressedBuffer = await sharp(buffer).webp({ quality }).toBuffer();
    } else {
      // Convert to JPEG for other formats
      compressedBuffer = await sharp(buffer)
        .jpeg({ quality, progressive: true })
        .toBuffer();
    }

    // If still too large, resize the image
    if (compressedBuffer.length > maxSizeBytes) {
      console.log(`  → Still too large, resizing image...`);
      const maxDimension = 1920; // Max width or height

      compressedBuffer = await sharp(buffer)
        .resize(maxDimension, maxDimension, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 75, progressive: true })
        .toBuffer();
    }

    const finalSize = compressedBuffer.length;
    const savings = (((originalSize - finalSize) / originalSize) * 100).toFixed(
      1,
    );

    console.log(
      `  → Compressed from ${(originalSize / 1024 / 1024).toFixed(2)} MB to ${(finalSize / 1024 / 1024).toFixed(2)} MB (${savings}% reduction)`,
    );

    return compressedBuffer;
  } catch (error) {
    throw new Error(`Failed to compress image: ${error.message}`);
  }
}

/**
 * Process image for Cloudinary upload
 * - Downloads image from URL
 * - Converts HEIC to PNG if needed
 * - Compresses if larger than 2MB
 * @param imageUrl - URL or path to image
 * @returns Processed image buffer
 */
export async function processImageForCloudinary(
  imageUrl: string,
): Promise<Buffer> {
  try {
    // Download image
    let buffer = await downloadImageFromUrl(imageUrl);

    // Check if HEIC and convert to PNG
    if (isHeicFormat(buffer, imageUrl)) {
      buffer = await convertHeicToPng(buffer);
    }

    // Compress if needed
    buffer = await compressImage(buffer);

    return buffer;
  } catch (error) {
    throw new Error(`Failed to process image: ${error.message}`);
  }
}

/**
 * Save buffer to temporary file and return path
 * @param buffer - Image buffer
 * @param extension - File extension (e.g., 'jpg', 'png')
 * @returns Temporary file path
 */
export function saveBufferToTempFile(
  buffer: Buffer,
  extension: string = 'jpg',
): string {
  const tempDir = path.join(process.cwd(), 'temp');

  // Create temp directory if it doesn't exist
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const tempFilePath = path.join(tempDir, `upload-${Date.now()}.${extension}`);

  fs.writeFileSync(tempFilePath, buffer);

  return tempFilePath;
}

/**
 * Delete temporary file
 * @param filePath - Path to file to delete
 */
export function deleteTempFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn(
      `Warning: Could not delete temp file ${filePath}:`,
      error.message,
    );
  }
}
