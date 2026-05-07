import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { PaymentRequestService } from './payment-request.service';
import { CreatePaymentRequestDto } from './dto/create-payment-request.dto';
import { UpdatePaymentRequestDto } from './dto/update-payment-request.dto';

type AuthReq = {
  user?: {
    sub?: string | null;
    companyId?: string | null;
  };
};

@ApiTags('PaymentRequests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('payment-requests')
export class PaymentRequestController {
  constructor(private readonly paymentRequestService: PaymentRequestService) {}

  private companyId(req: AuthReq) {
    return String(req.user?.companyId ?? '');
  }

  private userId(req: AuthReq) {
    return String(req.user?.sub ?? '');
  }

  @Get()
  async findAll(@Req() req: AuthReq) {
    return { code: 0, message: 'ok', data: await this.paymentRequestService.findAll(this.companyId(req)) };
  }

  @Post()
  @RequirePermissions('finance.edit')
  async create(@Req() req: AuthReq, @Body() dto: CreatePaymentRequestDto) {
    return { code: 0, message: 'ok', data: await this.paymentRequestService.create(dto, this.companyId(req), this.userId(req)) };
  }

  @Get(':id')
  async findOne(@Req() req: AuthReq, @Param('id') id: string) {
    return { code: 0, message: 'ok', data: await this.paymentRequestService.findOne(id, this.companyId(req)) };
  }

  @Patch(':id')
  @RequirePermissions('finance.edit')
  async update(@Req() req: AuthReq, @Param('id') id: string, @Body() dto: UpdatePaymentRequestDto) {
    return { code: 0, message: 'ok', data: await this.paymentRequestService.update(id, dto, this.companyId(req), this.userId(req)) };
  }

  @Post(':id/submit')
  @RequirePermissions('finance.edit')
  async submit(@Req() req: AuthReq, @Param('id') id: string) {
    return { code: 0, message: 'ok', data: await this.paymentRequestService.submit(id, this.companyId(req), this.userId(req)) };
  }

  @Post(':id/approve')
  @RequirePermissions('finance.approve')
  async approve(@Req() req: AuthReq, @Param('id') id: string) {
    return { code: 0, message: 'ok', data: await this.paymentRequestService.approve(id, this.companyId(req), this.userId(req)) };
  }

  @Post(':id/reject')
  @RequirePermissions('finance.approve')
  async reject(@Req() req: AuthReq, @Param('id') id: string) {
    return { code: 0, message: 'ok', data: await this.paymentRequestService.reject(id, this.companyId(req), this.userId(req)) };
  }

  @Post(':id/close')
  @RequirePermissions('finance.approve')
  async close(@Req() req: AuthReq, @Param('id') id: string) {
    return { code: 0, message: 'ok', data: await this.paymentRequestService.close(id, this.companyId(req), this.userId(req)) };
  }
}
