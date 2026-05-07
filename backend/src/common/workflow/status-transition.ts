import { BadRequestException } from '@nestjs/common';

export class InvalidStatusTransitionException extends BadRequestException {
  constructor(entityName: string, action: string, currentStatus: string, allowedStatuses: readonly string[]) {
    super({
      code: 40901,
      message: `Cannot ${action} ${entityName} when status is ${currentStatus}. Allowed: ${allowedStatuses.join('/')}`,
      data: null
    });
  }
}

export function assertAllowedStatus(
  entityName: string,
  action: string,
  currentStatus: string,
  allowedStatuses: readonly string[]
) {
  if (!allowedStatuses.includes(currentStatus)) {
    throw new InvalidStatusTransitionException(entityName, action, currentStatus, allowedStatuses);
  }
}

