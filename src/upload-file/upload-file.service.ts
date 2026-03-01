import { Injectable } from '@nestjs/common';
import { uploadToCloudinary } from 'src/helpers/cloudinary';

@Injectable()
export class UploadFileService {
  async uploadImage(
    file: Express.Multer.File,
    folder: string,
  ): Promise<{ image_url: string; public_id: string }> {
    const base64Image = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    const result = await uploadToCloudinary(base64Image, folder);

    return {
      image_url: result.secure_url,
      public_id: result.public_id,
    };
  }
}
