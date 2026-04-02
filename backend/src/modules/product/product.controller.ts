import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  private companyId(req: { user?: { companyId?: string | null } }) {
    return String(req.user?.companyId ?? '');
  }

  @Get()
  async findAll(@Req() req: { user?: { companyId?: string | null } }) {
    return { code: 0, message: 'ok', data: await this.productService.findAll(this.companyId(req)) };
  }

  @Post()
  @RequirePermissions('master.edit')
  async create(@Req() req: { user?: { companyId?: string | null } }, @Body() dto: CreateProductDto) {
    return { code: 0, message: 'ok', data: await this.productService.create(dto, this.companyId(req)) };
  }

  @Get(':id')
  async findOne(@Req() req: { user?: { companyId?: string | null } }, @Param('id') id: string) {
    return { code: 0, message: 'ok', data: await this.productService.findOne(id, this.companyId(req)) };
  }

  @Patch(':id')
  @RequirePermissions('master.edit')
  async update(@Req() req: { user?: { companyId?: string | null } }, @Param('id') id: string, @Body() dto: UpdateProductDto) {
    return { code: 0, message: 'ok', data: await this.productService.update(id, dto, this.companyId(req)) };
  }
}
