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
  folder: string,
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

export interface CloudinarySignaturePayload {
  signature: string;
  timestamp: number;
  api_key: string;
  cloud_name: string;
  folder: string;
}

/**
 * Generate signed upload params for browser → Cloudinary direct upload.
 * Folder is enforced server-side and included in the signature so the
 * client cannot redirect the upload to a different folder.
 */
export function signCloudinaryUploadParams(
  folder: string,
): CloudinarySignaturePayload {
  const config = cloudinary.config();
  if (!config.api_key || !config.api_secret || !config.cloud_name) {
    throw new Error('Cloudinary credentials are not configured');
  }

  const fullFolder = `pawship-grooming/${folder}`;
  const timestamp = Math.floor(Date.now() / 1000);

  const signature = cloudinary.utils.api_sign_request(
    { folder: fullFolder, timestamp },
    config.api_secret,
  );

  return {
    signature,
    timestamp,
    api_key: config.api_key,
    cloud_name: config.cloud_name,
    folder: fullFolder,
  };
}

export interface CloudinaryResourceInfo {
  public_id: string;
  secure_url: string;
  folder?: string;
  bytes: number;
  format: string;
}

/**
 * Look up a Cloudinary resource by public_id. Returns null when the
 * resource is missing (used after signed direct uploads to verify the
 * client actually uploaded what they claim).
 */
export async function getCloudinaryResource(
  publicId: string,
): Promise<CloudinaryResourceInfo | null> {
  try {
    const result = await cloudinary.api.resource(publicId);
    return {
      public_id: result.public_id,
      secure_url: result.secure_url,
      folder: result.folder,
      bytes: result.bytes,
      format: result.format,
    };
  } catch (error) {
    if (error?.http_code === 404 || error?.error?.http_code === 404) {
      return null;
    }
    throw new Error(`Failed to fetch Cloudinary resource: ${error.message ?? error}`);
  }
}
