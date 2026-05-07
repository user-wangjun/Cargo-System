import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { writeAuditLog } from '../src/common/db/audit-log.util';
import { WarehouseService } from '../src/modules/warehouse/warehouse.service';

jest.mock('../src/common/db/audit-log.util', () => ({
  writeAuditLog: jest.fn().mockResolvedValue(undefined)
}));

describe('WarehouseService.remove', () => {
  function createService(queryMock: jest.Mock) {
    const dataSource = {
      query: queryMock
    } as unknown as DataSource;
    return new WarehouseService(dataSource);
  }

  it('blocks deleting a warehouse that is referenced by business data', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'warehouse-1',
          warehouseCode: 'WH-01',
          name: '主仓',
          createdAt: '2026-04-15T00:00:00.000Z'
        }
      ])
      .mockResolvedValueOnce([
        {
          deliveryOrderCount: 1,
          balanceCount: 0,
          ledgerCount: 0
        }
      ]);
    const service = createService(query);

    await expect(service.remove('warehouse-1', 'company-1', 'user-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(query).toHaveBeenCalledTimes(2);
    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  it('deletes an unreferenced warehouse and writes an audit log', async () => {
    const currentWarehouse = {
      id: 'warehouse-1',
      warehouseCode: 'WH-01',
      name: '主仓',
      createdAt: '2026-04-15T00:00:00.000Z'
    };
    const query = jest
      .fn()
      .mockResolvedValueOnce([currentWarehouse])
      .mockResolvedValueOnce([
        {
          deliveryOrderCount: 0,
          balanceCount: 0,
          ledgerCount: 0
        }
      ])
      .mockResolvedValueOnce([{ id: 'warehouse-1' }]);
    const service = createService(query);

    const result = await service.remove('warehouse-1', 'company-1', 'user-1');

    expect(result).toEqual({ id: 'warehouse-1' });
    expect(query).toHaveBeenCalledTimes(3);
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'DELETE',
        entityType: 'WAREHOUSE',
        entityId: 'warehouse-1',
        userId: 'user-1',
        companyId: 'company-1',
        detail: currentWarehouse
      })
    );
  });
});
