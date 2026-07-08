/* eslint-disable */

import { AppException } from './app.exception';

export class ShipmentMappingException extends AppException {
  constructor(public readonly missingFields: string[]) {
    super(
      `sendShipping gövdesi oluşturulamadı; eksik alanlar: ${missingFields.join(', ')}`,
      'SHIPMENT_MAPPING_ERROR',
    );
  }
}