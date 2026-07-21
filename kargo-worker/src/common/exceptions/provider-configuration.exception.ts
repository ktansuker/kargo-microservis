/* eslint-disable */
import { AppException } from './app.exception';

export class ProviderConfigurationException extends AppException {
  constructor(public readonly missingVariable: string) {
    super(
      `FATAL: '${missingVariable}' çevresel değişkeni bulunamadı!`,
      'PROVIDER_CONFIGURATION_ERROR',
    );
  }
}