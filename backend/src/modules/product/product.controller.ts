import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';

type AuthReq = {
  user?: {
    sub?: string | null;
    companyId?: string | null;
  };
};

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  private companyId(req: AuthReq) {
    return String(req.user?.companyId ?? '');
  }

  private userId(req: AuthReq) {
    return String(req.user?.sub ?? '');
  }

  @Get()
  async findAll(@Req() req: AuthReq, @Query() query: ProductQueryDto) {
    return { code: 0, message: 'ok', data: await this.productService.findAll(query, this.companyId(req)) };
  }

  @Post()
  @RequirePermissions('master.edit')
  async create(@Req() req: AuthReq, @Body() dto: CreateProductDto) {
    return { code: 0, message: 'ok', data: await this.productService.create(dto, this.companyId(req), this.userId(req)) };
  }

  @Get(':id')
  async findOne(@Req() req: AuthReq, @Param('id') id: string) {
    return { code: 0, message: 'ok', data: await this.productService.findOne(id, this.companyId(req)) };
  }

  @Patch(':id')
  @RequirePermissions('master.edit')
  async update(@Req() req: AuthReq, @Param('id') id: string, @Body() dto: UpdateProductDto) {
    return { code: 0, message: 'ok', data: await this.productService.update(id, dto, this.companyId(req), this.userId(req)) };
  }
}
