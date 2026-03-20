import { HttpException, HttpStatus } from '@nestjs/common';

export class AppError extends HttpException {
  public readonly errorCode: string;

  constructor(message: string, status: HttpStatus, errorCode: string) {
    super({ statusCode: status, message, errorCode }, status);
    this.errorCode = errorCode;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} with id ${id} not found` : `${resource} not found`,
      HttpStatus.NOT_FOUND,
      'NOT_FOUND',
    );
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, HttpStatus.FORBIDDEN, 'FORBIDDEN');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED');
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, HttpStatus.UNPROCESSABLE_ENTITY, 'VALIDATION_ERROR');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, HttpStatus.CONFLICT, 'CONFLICT');
  }
}

export class SlotNoLongerAvailableError extends AppError {
  constructor() {
    super(
      'The requested time slot is no longer available',
      HttpStatus.CONFLICT,
      'SLOT_NO_LONGER_AVAILABLE',
    );
  }
}

export class SlotTemporarilyHeldError extends AppError {
  constructor() {
    super(
      'The requested time slot is temporarily held by another user',
      HttpStatus.CONFLICT,
      'SLOT_TEMPORARILY_HELD',
    );
  }
}

export class PaymentFailedError extends AppError {
  constructor(message = 'Payment processing failed') {
    super(message, HttpStatus.PAYMENT_REQUIRED, 'PAYMENT_FAILED');
  }
}

export class InvalidAppointmentTransitionError extends AppError {
  constructor(currentStatus: string, targetStatus: string) {
    super(
      `Cannot transition appointment from ${currentStatus} to ${targetStatus}`,
      HttpStatus.UNPROCESSABLE_ENTITY,
      'INVALID_APPOINTMENT_TRANSITION',
    );
  }
}
