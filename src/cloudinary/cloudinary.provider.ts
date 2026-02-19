// cloudinary.provider.ts
import { v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '@nestjs/config';

export const CLOUDINARY = 'CLOUDINARY';

export const cloudinaryProvider = {
  provide: CLOUDINARY,
  useFactory: (config: ConfigService) => {
    cloudinary.config({
      cloud_name: config.get('CLOUDINARY_CLOUD_NAME'),
      api_key: config.get('CLOUDINARY_API_KEY'),
      api_secret: config.get('CLOUDINARY_API_SECRET'),
    });

    return cloudinary;
  },
  inject: [ConfigService],
};
