import { IsMongoId, IsArray, IsNotEmpty, IsNumber } from 'class-validator';

export class ApplyBenefitPreviewDto {
  @IsMongoId({ message: 'pet_id is required and must be a valid MongoId' })
  pet_id: string;

  @IsArray({ message: 'selected_benefit_ids must be an array' })
  @IsNotEmpty({ message: 'selected_benefit_ids cannot be empty' })
  @IsMongoId({ each: true, message: 'Each benefit id must be a valid MongoId' })
  selected_benefit_ids: string[];

  @IsNumber({}, { message: 'subtotal_price is required and must be a number' })
  subtotal_price: number;
}
