import { Controller, Get, MessageEvent, Query, Sse, UseGuards } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthGuard } from 'src/auth/auth.guard';
import { FinancialReportDto } from './dto/financial-report.dto';
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
}
