/* eslint-disable */
export class CargoProviderException extends Error {
  constructor(public providerCode: string, public message: string, public statusCode: number = 500) {
    super(`[${providerCode}] Hatası: ${message}`);
    this.name = 'CargoProviderException';
  }
}