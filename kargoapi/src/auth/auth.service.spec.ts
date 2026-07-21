import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test } from '@nestjs/testing';
import { VALID_PASSWORD, VALID_USERNAME } from './auth.constants';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let cache: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    cache = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  describe('login', () => {
    it('doğru kimlik bilgileriyle token üretir ve cache\'e yazar', async () => {
      const token = await service.login(VALID_USERNAME, VALID_PASSWORD);

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(cache.set).toHaveBeenCalledTimes(1);
      const [key, payload, ttl] = cache.set.mock.calls[0];
      expect(key).toBe(`token:${token}`);
      expect(payload).toMatchObject({ username: VALID_USERNAME });
      expect(ttl).toBeGreaterThan(0);
    });

    it('yanlış parola için null döner ve cache\'e yazmaz', async () => {
      const token = await service.login(VALID_USERNAME, 'yanlis');
      expect(token).toBeNull();
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('eksik kimlik bilgisi için null döner', async () => {
      expect(await service.login(undefined, undefined)).toBeNull();
    });
  });

  describe('validateToken', () => {
    it('cache\'te olan token için payload döner', async () => {
      const payload = { username: VALID_USERNAME, issuedAt: 123 };
      cache.get.mockResolvedValue(payload);

      const result = await service.validateToken('abc');
      expect(cache.get).toHaveBeenCalledWith('token:abc');
      expect(result).toEqual(payload);
    });

    it('cache\'te olmayan token için null döner', async () => {
      cache.get.mockResolvedValue(undefined);
      expect(await service.validateToken('yok')).toBeNull();
    });

    it('boş token için cache\'e sormadan null döner', async () => {
      expect(await service.validateToken(undefined)).toBeNull();
      expect(cache.get).not.toHaveBeenCalled();
    });
  });
});
