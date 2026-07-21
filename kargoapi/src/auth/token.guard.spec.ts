import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { TokenGuard } from './token.guard';

function makeContext(headers: Record<string, string>): ExecutionContext {
  const request: any = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('TokenGuard', () => {
  let guard: TokenGuard;
  let authService: { validateToken: jest.Mock };

  beforeEach(() => {
    authService = { validateToken: jest.fn() };
    guard = new TokenGuard(authService as unknown as AuthService);
  });

  it('Authorization header yoksa 401 fırlatır', async () => {
    await expect(guard.canActivate(makeContext({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('Basic dışı şema için 401 fırlatır', async () => {
    await expect(
      guard.canActivate(makeContext({ authorization: 'Bearer abc' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('geçersiz token için 401 fırlatır', async () => {
    authService.validateToken.mockResolvedValue(null);
    await expect(
      guard.canActivate(makeContext({ authorization: 'Basic gecersiz' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authService.validateToken).toHaveBeenCalledWith('gecersiz');
  });

  it('geçerli token için true döner ve request.user set eder', async () => {
    const payload = { username: 'PO_ARVATO_DEV', issuedAt: 1 };
    authService.validateToken.mockResolvedValue(payload);
    const ctx = makeContext({ authorization: 'Basic valid-token' });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    const request = ctx.switchToHttp().getRequest();
    expect(request.user).toEqual(payload);
  });
});
