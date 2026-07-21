/* eslint-disable */
import { AppException } from './app.exception';
export class ShipmentValidationException extends AppException {
  constructor(public readonly errors: string[]) {
    super(
      `Kargo isteği doğrulanamadı: ${errors.join(' | ')}`,
      'SHIPMENT_VALIDATION_ERROR',
      400,
    );
  }
}