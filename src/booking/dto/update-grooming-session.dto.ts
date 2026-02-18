import { PartialType } from '@nestjs/mapped-types';
import { CreateGroomingSessionDto } from './create-grooming-session.dto';

export class UpdateGroomingSessionDto extends PartialType(
  CreateGroomingSessionDto,
) {}
