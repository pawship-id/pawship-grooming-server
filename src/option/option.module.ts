import { Module } from '@nestjs/common';
import { OptionService } from './option.service';
import { OptionController } from './option.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Option, OptionSchema } from './entities/option.entity';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Option.name, schema: OptionSchema }]),
    AuthModule,
  ],
  controllers: [OptionController],
  providers: [OptionService],
  exports: [OptionService],
})
export class OptionModule {}
