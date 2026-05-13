import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from 'src/auth/auth.guard';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { OperationalQueryDto } from './dto/operational-query.dto';
import { ActivityFeedService } from './services/activity-feed.service';
import { BookingsMetricsService } from './services/bookings-metrics.service';
import { CapacityService } from './services/capacity.service';
import { GroomerPerformanceService } from './services/groomer-performance.service';
import { GrowthService } from './services/growth.service';
import { MembershipHealthService } from './services/membership-health.service';
import { NeedsActionService } from './services/needs-action.service';
import { RevenueService } from './services/revenue.service';

@Controller('admin/dashboard')
@UseGuards(AuthGuard)
export class DashboardController {
  constructor(
    private readonly needsActionService: NeedsActionService,
    private readonly revenueService: RevenueService,
    private readonly bookingsMetricsService: BookingsMetricsService,
    private readonly capacityService: CapacityService,
    private readonly groomerPerformanceService: GroomerPerformanceService,
    private readonly activityFeedService: ActivityFeedService,
    private readonly membershipHealthService: MembershipHealthService,
    private readonly growthService: GrowthService,
  ) {}

  @Get('needs-action')
  async getNeedsAction(@Req() req: Request) {
    this.assertAdmin(req);

    const data = await this.needsActionService.getNeedsAction();
    return {
      message: 'Fetch needs action successfully',
      ...data,
    };
  }

  @Get('revenue')
  async getRevenue(@Req() req: Request, @Query() query: DashboardQueryDto) {
    this.assertAdmin(req);
    const data = await this.revenueService.getRevenue({
      storeId: query.store_id,
      from: query.from,
      to: query.to,
    });
    return { message: 'Fetch revenue successfully', ...data };
  }

  @Get('bookings')
  async getBookings(@Req() req: Request, @Query() query: DashboardQueryDto) {
    this.assertAdmin(req);
    const data = await this.bookingsMetricsService.getBookings({
      storeId: query.store_id,
      from: query.from,
      to: query.to,
    });
    return { message: 'Fetch bookings metrics successfully', ...data };
  }

  @Get('capacity')
  async getCapacity(@Req() req: Request, @Query() query: OperationalQueryDto) {
    this.assertAdmin(req);
    const data = await this.capacityService.getCapacity({
      storeId: query.store_id,
    });
    return { message: 'Fetch capacity successfully', ...data };
  }

  @Get('groomers')
  async getGroomers(@Req() req: Request, @Query() query: OperationalQueryDto) {
    this.assertAdmin(req);
    const data = await this.groomerPerformanceService.getGroomerPerformance({
      storeId: query.store_id,
    });
    return { message: 'Fetch groomer performance successfully', ...data };
  }

  @Get('activity')
  async getActivity(@Req() req: Request, @Query() query: OperationalQueryDto) {
    this.assertAdmin(req);
    const data = await this.activityFeedService.getActivity({
      storeId: query.store_id,
      limit: query.limit,
    });
    return { message: 'Fetch activity feed successfully', ...data };
  }

  @Get('membership-health')
  async getMembershipHealth(
    @Req() req: Request,
    @Query() query: DashboardQueryDto,
  ) {
    this.assertAdmin(req);
    const data = await this.membershipHealthService.getMembershipHealth({
      from: query.from,
      to: query.to,
    });
    return { message: 'Fetch membership health successfully', ...data };
  }

  @Get('growth')
  async getGrowth(@Req() req: Request, @Query() query: DashboardQueryDto) {
    this.assertAdmin(req);
    const data = await this.growthService.getGrowth({
      from: query.from,
      to: query.to,
    });
    return { message: 'Fetch growth successfully', ...data };
  }

  private assertAdmin(req: Request) {
    const user = (req as any).user;
    if (user?.role !== 'admin' && user?.role !== 'ops') {
      throw new ForbiddenException('Admin access required');
    }
  }
}
