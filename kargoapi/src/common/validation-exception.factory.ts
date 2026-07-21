import { BadRequestException, ValidationError } from '@nestjs/common';

/**
 * class-validator hatalarını `{ success, error, message, details }` formatına
 * çeviren global ValidationPipe exceptionFactory'si.
 */
export function validationExceptionFactory(errors: ValidationError[]) {
  return new BadRequestException({
    success: false,
    error: 'VALIDATION_ERROR',
    message: 'İstek gövdesindeki bazı alanlar hatalı veya eksik.',
    details: flattenValidationErrors(errors),
  });
}

function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): string[] {
  const messages: string[] = [];

  for (const error of errors) {
    const path = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    if (error.constraints) {
      for (const constraint of Object.values(error.constraints)) {
        messages.push(`${path}: ${constraint}`);
      }
    }

    if (error.children?.length) {
      messages.push(...flattenValidationErrors(error.children, path));
    }
  }

  return messages;
}
