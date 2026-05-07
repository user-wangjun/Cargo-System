import { PartialType } from '@nestjs/swagger';
import { CreatePurchaseReceiptDto } from './create-purchase-receipt.dto';

export class UpdatePurchaseReceiptDto extends PartialType(CreatePurchaseReceiptDto) {}
