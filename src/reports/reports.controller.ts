import { Controller, Get, MessageEvent, Query, Sse, UseGuards } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthGuard } from 'src/auth/auth.guard';
import { FinancialReportDto } from './dto/financial-report.dto';
import { OperationsReportDto } from './dto/operations-report.dto';
import { CapacityUtilisationReportDto } from './dto/capacity-utilisation-report.dto';
import { CustomerReportDto } from './dto/customer-report.dto';
import { MembershipRevenueReportDto } from './dto/membership-revenue-report.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('financial')
  async getFinancialReport(@Query() dto: FinancialReportDto) {
    const result = await this.reportsService.getFinancialReport(dto);
    return {
      message: 'Financial report fetched successfully',
      ...result,
    };
  }

  @Sse('financial/stream')
  streamFinancialReport(@Query() dto: FinancialReportDto): Observable<MessageEvent> {
    return this.reportsService.streamFinancialReport(dto);
  }

  @Sse('financial/live')
  streamLiveBookings(): Observable<MessageEvent> {
    return this.reportsService.streamLiveBookings();
  }

  // ─── Operations: Booking & Ops Detail ────────────────────────────────────────

  @Get('operations')
  async getOperationsReport(@Query() dto: OperationsReportDto) {
    const result = await this.reportsService.getOperationsReport(dto);
    return {
      message: 'Operations report fetched successfully',
      ...result,
    };
  }

  @Sse('operations/stream')
  streamOperationsReport(@Query() dto: OperationsReportDto): Observable<MessageEvent> {
    return this.reportsService.streamOperationsReport(dto);
  }

  // ─── Capacity Utilisation ─────────────────────────────────────────────────────

  @Get('capacity-utilisation')
  async getCapacityUtilisationReport(@Query() dto: CapacityUtilisationReportDto) {
    const result = await this.reportsService.getCapacityUtilisationReport(dto);
    return {
      message: 'Capacity utilisation report fetched successfully',
      ...result,
    };
  }

  @Sse('capacity-utilisation/stream')
  streamCapacityUtilisationReport(
    @Query() dto: CapacityUtilisationReportDto,
  ): Observable<MessageEvent> {
    return this.reportsService.streamCapacityUtilisationReport(dto);
  }

  // ─── Customer Reports ─────────────────────────────────────────────────────────

  @Get('customer/master-data')
  async getCustomerMasterData(@Query() dto: CustomerReportDto) {
    const result = await this.reportsService.getCustomerMasterData(dto);
    return { message: 'Customer master data fetched successfully', ...result };
  }

  @Get('customer/retention')
  async getCustomerRetentionReport(@Query() dto: CustomerReportDto) {
    const result = await this.reportsService.getCustomerRetentionReport(dto);
    return { message: 'Customer retention report fetched successfully', ...result };
  }

  @Get('customer/new-conversion')
  async getNewCustomerConversionReport(@Query() dto: CustomerReportDto) {
    const result = await this.reportsService.getNewCustomerConversionReport(dto);
    return { message: 'New customer conversion report fetched successfully', ...result };
  }

  @Get('customer/vip-top-customers')
  async getVipCustomerReport() {
    const result = await this.reportsService.getVipCustomerReport();
    return { message: 'VIP customer report fetched successfully', ...result };
  }

  // ─── Membership Reports ───────────────────────────────────────────────────────

  @Get('membership/detail')
  async getMembershipDetailReport() {
    const result = await this.reportsService.getMembershipDetailReport();
    return { message: 'Membership detail report fetched successfully', ...result };
  }

  @Get('membership/expiry')
  async getMembershipExpiryReport() {
    const result = await this.reportsService.getMembershipExpiryReport();
    return { message: 'Membership expiry report fetched successfully', ...result };
  }

  @Get('membership/revenue')
  async getMembershipRevenueReport(@Query() dto: MembershipRevenueReportDto) {
    const result = await this.reportsService.getMembershipRevenueReport(dto);
    return { message: 'Membership revenue report fetched successfully', ...result };
  }
}
