import { Controller, Get } from '@nestjs/common';
import { MembershipService } from './membership.service';

@Controller('memberships/public')
export class MembershipPublicController {
  constructor(private readonly membershipService: MembershipService) {}

  @Get()
  async findPublic() {
    const memberships = await this.membershipService.findPublic();
    return {
      message: 'public memberships retrieved successfully',
      data: memberships,
    };
  }
}
