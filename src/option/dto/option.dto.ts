import { IsEnum } from 'class-validator';

export enum CategoryOption {
  FEATHER = 'feather category', // untuk jenis bulu hewan (contoh: "Sort Hair", "Long Hair")
  SIZE = 'size category', // untuk ukuran hewan (contoh: "Small", "Medium", "Large")
  BREED = 'breed category', // untuk keturunan hewan (contoh: "Pom", "Ras Mix")
  MEMBER = 'member category', // untuk kategori member hewan (contoh: "Regular", "VIP - Store", "VIP - Home", "Influencer")
  CUSTOMER = 'customer category', // untuk kategori customer (contoh: "Prioritas")
  PET_TYPE = 'pet type', // untuk jenis hewan (contoh: "Dog", "Cat", "Other")
}

export class GetOptionQueryDto {
  @IsEnum(CategoryOption)
  category: CategoryOption;
}
