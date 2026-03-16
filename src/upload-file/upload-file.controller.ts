import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadFileService } from './upload-file.service';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('upload-file')
@UseGuards(AuthGuard)
export class UploadFileController {
  constructor(private readonly uploadFileService: UploadFileService) {}

  @Post()
  @UseInterceptors(FileInterceptor('image'))
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('folder') folder: string,
  ) {
    if (!file) throw new BadRequestException('image file is required');
    if (!folder)
      throw new BadRequestException('folder file location is required');

    const result = await this.uploadFileService.uploadImage(file, folder);

    return {
      message: 'Upload image successfully',
      ...result,
    };
  }
}
