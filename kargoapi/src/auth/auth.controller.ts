import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { TOKEN_TTL_SECONDS } from './auth.constants';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/login
   * Kimlik bilgileri gövde ({ username, password }) veya
   * `Authorization: Basic base64(user:pass)` header'ı ile alınır.
   * Başarılı ise createShipment'ta kullanılacak token'ı döner.
   */
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Headers('authorization') authHeader?: string,
  ) {
    let { username, password } = dto;

    // Gövdede kimlik yoksa Basic header'dan çözmeyi dene.
    if ((!username || !password) && authHeader?.startsWith('Basic ')) {
      const decoded = Buffer.from(authHeader.slice(6).trim(), 'base64').toString(
        'utf8',
      );
      const sep = decoded.indexOf(':');
      if (sep !== -1) {
        username = decoded.slice(0, sep);
        password = decoded.slice(sep + 1);
      }
    }

    const token = await this.authService.login(username, password);
    if (!token) {
      throw new UnauthorizedException({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Kullanıcı adı veya parola hatalı.',
      });
    }

    return {
      success: true,
      token,
      tokenType: 'Basic',
      expiresIn: TOKEN_TTL_SECONDS,
    };
  }
}
