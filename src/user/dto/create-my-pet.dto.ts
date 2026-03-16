import { OmitType } from '@nestjs/mapped-types';
import { CreatePetDto } from 'src/pet/dto/create-pet.dto';

/** Same as CreatePetDto but without customer_id — inferred from the JWT. */
export class CreateMyPetDto extends OmitType(CreatePetDto, [
  'customer_id',
] as const) {}
