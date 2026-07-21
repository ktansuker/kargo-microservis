import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { randomUUID } from 'node:crypto';
import {
  TOKEN_CACHE_PREFIX,
  TOKEN_TTL_MS,
  VALID_PASSWORD,
  VALID_USERNAME,
} from './auth.constants';

export interface TokenPayload {
  username: string;
  issuedAt: number;
}

@Injectable()
export class AuthService {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  /**
   * Kimlik bilgilerini doğrular. Doğruysa yeni bir token üretip cache'e
   * TTL ile yazar ve token'ı döner. Yanlışsa null döner.
   */
  async login(
    username?: string,
    password?: string,
  ): Promise<string | null> {
    if (username !== VALID_USERNAME || password !== VALID_PASSWORD) {
      return null;
    }

    const token = randomUUID();
    const payload: TokenPayload = { username, issuedAt: Date.now() };
    await this.cache.set(
      `${TOKEN_CACHE_PREFIX}${token}`,
      payload,
      TOKEN_TTL_MS,
    );
    return token;
  }

  /**
   * Token'ı cache'te arar. Geçerliyse payload'ı, değilse (yoksa/süresi
   * dolmuşsa) null döner.
   */
  async validateToken(token?: string): Promise<TokenPayload | null> {
    if (!token) {
      return null;
    }
    const payload = await this.cache.get<TokenPayload>(
      `${TOKEN_CACHE_PREFIX}${token}`,
    );
    return payload ?? null;
  }
}
