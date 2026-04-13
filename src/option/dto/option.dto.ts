import { IsEnum } from 'class-validator';

export enum CategoryOption {
  HAIR = 'hair category', // untuk jenis bulu hewan (contoh: "Short Hair", "Long Hair")
  SIZE = 'size category', // untuk ukuran hewan (contoh: "Small", "Medium", "Large")
  BREED = 'breed category', // untuk keturunan hewan (contoh: "Pom", "Ras Mix")
  CUSTOMER = 'customer category', // untuk kategori customer (contoh: "Prioritas")
  PET_TYPE = 'pet type', // untuk jenis hewan (contoh: "Dog", "Cat", "Other")
  SESSION_SKILL = 'session - skill', // untuk skill groomer dalam session (contoh: "Basic Grooming", "Advanced Styling")
}

export class GetOptionQueryDto {
  @IsEnum(CategoryOption)
  category: CategoryOption;
}
