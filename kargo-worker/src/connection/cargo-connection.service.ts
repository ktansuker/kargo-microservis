/* eslint-disable */
import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError, AxiosResponse } from 'axios';
import { LoginResponse } from './interfaces/login-response.interface';
import { CargoApiAuthenticationException } from '../common/exceptions/cargo-api-authentication.exception';
import { CargoApiRequestException } from '../common/exceptions/cargo-api-request.exception';

@Injectable()
export class CargoConnectionService {
  private readonly logger = new Logger(CargoConnectionService.name);

  private headers: Record<string, string> = {};

  private readonly baseUrl =
    process.env.CARGO_API_BASE_URL ?? 'http://localhost:8000';
  private readonly username = process.env.CARGO_API_USERNAME;
  private readonly password = process.env.CARGO_API_PASSWORD;

  /**
   * @param endpoint 
   * @param body 
   * @throws {CargoApiRequestException} 
   */
  async post<T = unknown>(endpoint: string, body: unknown): Promise<AxiosResponse<T>> {
    await this.ensureAuthenticated();

    const targetUrl = endpoint.startsWith('http')
      ? endpoint
      : `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    try {
      return await this.sendPost<T>(targetUrl, body);
    } catch (error) {
      const axiosError = error as AxiosError;

      if (axiosError.response?.status === 401) {
        this.logger.warn('401 alındı, token yenilenip istek tekrar denenecek.');
        this.resetAuth();
        await this.ensureAuthenticated();

        try {
          return await this.sendPost<T>(targetUrl, body);
        } catch (retryError) {
          throw this.toRequestException(targetUrl, retryError);
        }
      }

      throw this.toRequestException(targetUrl, error);
    }
  }

  private async sendPost<T>(url: string, body: unknown): Promise<AxiosResponse<T>> {
    return axios.post<T>(url, body, {
      headers: {
        'Content-Type': 'application/json',
        ...this.headers,
      },
      timeout: 10000,
    });
  }

  private toRequestException(url: string, error: unknown): CargoApiRequestException {
    const axiosError = error as AxiosError;
    return new CargoApiRequestException(
      url,
      axiosError.response?.status,
      axiosError.response?.data,
      error,
    );
  }

  private async ensureAuthenticated(): Promise<void> {
    if (this.headers['Authorization']) {
      return;
    }
    await this.login();
  }

  /**
   * /auth/login çağırır, dönen token'ı `Authorization: Basic <token>`
   * olarak saklar.
   * @throws {CargoApiAuthenticationException}
   */
  private async login(): Promise<void> {
    if (!this.username || !this.password) {
      throw new CargoApiAuthenticationException(
        'CARGO_API_USERNAME / CARGO_API_PASSWORD tanımlı değil (.env kontrol et).',
      );
    }

    this.logger.log("Header'da token yok, login olunuyor...");

    try {
      const response = await axios.post<LoginResponse>(
        `${this.baseUrl}/auth/login`,
        { username: this.username, password: this.password },
      );

      this.logger.warn(`RAW LOGIN RESPONSE: ${JSON.stringify(response.data)}`);

  const { token, tokenType } = response.data;
  this.headers['Authorization'] = `${tokenType} ${token}`;
  this.logger.log(`Login başarılı, token header'a yazıldı (tokenType: ${tokenType}).`);
    } catch (error) {
      const axiosError = error as AxiosError;
      const reason = axiosError.response?.data
        ? JSON.stringify(axiosError.response.data)
        : axiosError.message || 'bilinmeyen hata';
      throw new CargoApiAuthenticationException(reason, error);
    }
  }

  private resetAuth(): void {
    this.headers = {};
  }
}