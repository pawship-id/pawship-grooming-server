import { v2 as cloudinary } from 'cloudinary';
import { MediaType } from 'src/booking/dto/booking.dto';

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
}

/**
 * Upload image to Cloudinary
 * @param file - File path or base64 string
 * @param folder - Cloudinary folder name (optional)
 * @returns Promise with upload result
 */
export async function uploadToCloudinary(
  file: string,
  folder?: string,
): Promise<CloudinaryUploadResult> {
  try {
    const result = await cloudinary.uploader.upload(file, {
      folder: `pawship-grooming/${folder}`,
      resource_type: 'auto',
    });

    return {
      secure_url: result.secure_url,
      public_id: result.public_id,
    };
  } catch (error) {
    throw new Error(`Failed to upload image: ${error.message}`);
  }
}

/**
 * Delete image from Cloudinary
 * @param publicId - Cloudinary public ID
 * @returns Promise with deletion result
 */
export async function deleteFromCloudinary(publicId: string): Promise<boolean> {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === 'ok';
  } catch (error) {
    throw new Error(`Failed to delete image: ${error.message}`);
  }
}

export function generateGroomingSessionFolder(
  petName: string,
  type: MediaType,
) {
  const slugPetName = petName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // spasi → -
    .replace(/[^a-z0-9-]/g, ''); // hapus karakter aneh

  const today = new Date();
  const dateFolder = `${today.getFullYear()}-${String(
    today.getMonth() + 1,
  ).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return `grooming-session/${slugPetName}/${dateFolder}/${type}`;
}
