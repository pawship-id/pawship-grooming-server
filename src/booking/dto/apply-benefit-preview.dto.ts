import { IsMongoId, IsArray, IsNotEmpty, IsOptional } from 'class-validator';

export class ApplyBenefitPreviewDto {
  @IsMongoId({ message: 'pet_id is required and must be a valid MongoId' })
  pet_id: string;

  @IsArray({ message: 'selected_benefit_ids must be an array' })
  @IsNotEmpty({ message: 'selected_benefit_ids cannot be empty' })
  @IsMongoId({ each: true, message: 'Each benefit id must be a valid MongoId' })
  selected_benefit_ids: string[];

  @IsOptional()
  @IsMongoId({ message: 'store_id must be a valid MongoId' })
  store_id?: string;

  @IsOptional()
  @IsMongoId({ message: 'service_id must be a valid MongoId' })
  service_id?: string;

  @IsOptional()
  @IsArray({ message: 'add_on_ids must be an array' })
  @IsMongoId({ each: true, message: 'Each add_on_id must be a valid MongoId' })
  add_on_ids?: string[];
}
