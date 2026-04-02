import { Module } from '@nestjs/common';
import { PurchaseReceiptController } from './purchase-receipt.controller';
import { PurchaseReceiptService } from './purchase-receipt.service';

@Module({ controllers: [PurchaseReceiptController], providers: [PurchaseReceiptService] })
export class PurchaseReceiptModule {}
