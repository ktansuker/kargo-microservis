/* eslint-disable */
import { AppException } from './app.exception';

export class CargoApiAuthenticationException extends AppException {
  constructor(reason: string, cause?: unknown) {
    super(
      `Kargo API kimlik doğrulaması başarısız: ${reason}`,
      'CARGO_API_AUTH_ERROR',
      cause,
    );
  }
}