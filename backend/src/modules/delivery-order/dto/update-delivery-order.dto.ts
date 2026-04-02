import { PartialType } from '@nestjs/swagger';
import { CreateDeliveryOrderDto } from './create-delivery-order.dto';

export class UpdateDeliveryOrderDto extends PartialType(CreateDeliveryOrderDto) {}
