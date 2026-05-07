import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class UnitConversionService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findAll(companyId: string) {
    return this.dataSource.query(
      `
      select
        uc.product_id as "productId",
        p.product_code as "productCode",
        p.name as "productName",
        uc.from_unit_id as "fromUnit",
        fu.unit_code as "fromUnitCode",
        fu.name as "fromUnitName",
        uc.to_unit_id as "toUnit",
        tu.unit_code as "toUnitCode",
        tu.name as "toUnitName",
        uc.factor as ratio
      from unit_conversions uc
      left join products p on p.id = uc.product_id
      left join units fu on fu.id = uc.from_unit_id
      left join units tu on tu.id = uc.to_unit_id
      where uc.company_id = $1
      order by p.name asc nulls last, fu.unit_code asc nulls last, tu.unit_code asc nulls last
      `,
      [companyId]
    );
  }
}
