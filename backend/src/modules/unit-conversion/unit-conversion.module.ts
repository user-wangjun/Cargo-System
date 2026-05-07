import { Module } from '@nestjs/common';
import { UnitConversionController } from './unit-conversion.controller';
import { UnitConversionService } from './unit-conversion.service';

@Module({
  controllers: [UnitConversionController],
  providers: [UnitConversionService]
})
export class UnitConversionModule {}
