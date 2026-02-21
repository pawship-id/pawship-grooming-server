import { Module } from '@nestjs/common';
import { MembershipService } from './membership.service';
import { MembershipController } from './membership.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Membership, MembershipSchema } from './entities/membership.entity';
import { Option, OptionSchema } from 'src/option/entities/option.entity';
import { Service, ServiceSchema } from 'src/service/entities/service.entity';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Membership.name, schema: MembershipSchema },
      { name: Option.name, schema: OptionSchema },
      { name: Service.name, schema: ServiceSchema },
    ]),
    AuthModule,
  ],
  controllers: [MembershipController],
  providers: [MembershipService],
})
export class MembershipModule {}
