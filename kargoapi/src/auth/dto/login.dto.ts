import { IsOptional, IsString } from 'class-validator';

/**
 * Login gövdesi. Kimlik bilgileri gövde ile ya da
 * `Authorization: Basic base64(user:pass)` header'ı ile gönderilebildiği için
 * alanlar opsiyoneldir; asıl "boş mu" kontrolü controller'da yapılır.
 */
export class LoginDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;
}
