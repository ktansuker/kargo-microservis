/* eslint-disable */

import { AppException } from './app.exception';

export class CargoApiRequestException extends AppException {
  constructor(
    public readonly url: string,
    public readonly status: number | undefined,
    public readonly responseData: unknown,
    cause?: unknown,
  ) {
    super(
      `Kargo API isteği başarısız (${url})${status ? ` — HTTP ${status}` : ' — cevap alınamadı'}`,
      'CARGO_API_REQUEST_ERROR',
      cause,
    );
  }
}