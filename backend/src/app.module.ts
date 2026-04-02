import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { CustomerModule } from './modules/customer/customer.module';
import { SupplierModule } from './modules/supplier/supplier.module';
import { ProductModule } from './modules/product/product.module';
import { SalesOrderModule } from './modules/sales-order/sales-order.module';
import { PurchaseReceiptModule } from './modules/purchase-receipt/purchase-receipt.module';
import { DeliveryOrderModule } from './modules/delivery-order/delivery-order.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { InvoiceModule } from './modules/invoice/invoice.module';
import { PaymentRequestModule } from './modules/payment-request/payment-request.module';
import { ReceiptModule } from './modules/receipt/receipt.module';
import { AuditModule } from './modules/audit/audit.module';
import { OrgModule } from './modules/org/org.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres' as const,
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT ?? 5432),
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        autoLoadEntities: true,
        synchronize: false,
        logging: false
      })
    }),
    HealthModule,
    AuthModule,
    CustomerModule,
    SupplierModule,
    ProductModule,
    SalesOrderModule,
    PurchaseReceiptModule,
    DeliveryOrderModule,
    InventoryModule,
    InvoiceModule,
    PaymentRequestModule,
    ReceiptModule,
    AuditModule,
    OrgModule
  ]
})
export class AppModule {}
