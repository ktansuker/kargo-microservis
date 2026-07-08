/* eslint-disable */

import { AppException } from './app.exception';

export class InvalidMessagePayloadException extends AppException {
  constructor(cause?: unknown) {
    super(
      'Kuyruktan gelen mesaj geçerli bir JSON değil, parse edilemedi.',
      'INVALID_MESSAGE_PAYLOAD',
      cause,
    );
  }
}