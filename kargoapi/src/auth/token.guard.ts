import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';

/**
 * createShipment endpoint'ini korur.
 * `Authorization: Basic <token>` header'ını bekler; token'ı cache üzerinden
 * doğrular. Header yok / şema yanlış / token geçersiz ise 401 döner.
 */
@Injectable()
export class TokenGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      throw new UnauthorizedException({
        success: false,
        error: 'UNAUTHORIZED',
        message: "'Authorization: Basic <token>' header'ı gerekli.",
      });
    }

    const token = authHeader.slice(6).trim();
    const payload = await this.authService.validateToken(token);

    if (!payload) {
      throw new UnauthorizedException({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Geçersiz veya süresi dolmuş token.',
      });
    }

    request.user = payload;
    return true;
  }
}
