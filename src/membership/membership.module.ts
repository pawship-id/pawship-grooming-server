import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MembershipController } from './membership.controller';
import { MembershipService } from './membership.service';
import { Membership, MembershipSchema } from './entities/membership.entity';
import { Service, ServiceSchema } from 'src/service/entities/service.entity';
import { AuthModule } from 'src/auth/auth.module';
import { PetMembershipModule } from 'src/pet-membership/pet-membership.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Membership.name, schema: MembershipSchema },
      { name: Service.name, schema: ServiceSchema },
    ]),
    AuthModule,
    forwardRef(() => PetMembershipModule),
  ],
  controllers: [MembershipController],
  providers: [MembershipService],
  exports: [MembershipService],
})
export class MembershipModule {}
