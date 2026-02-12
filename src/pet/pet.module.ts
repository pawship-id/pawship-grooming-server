import { Module } from '@nestjs/common';
import { PetService } from './pet.service';
import { PetController } from './pet.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Option, OptionSchema } from 'src/option/entities/option.entity';
import { Pet, PetSchema } from './entities/pet.entity';
import { User, UserSchema } from 'src/user/user.model';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Pet.name, schema: PetSchema },
      { name: Option.name, schema: OptionSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [PetController],
  providers: [PetService],
})
export class PetModule {}
