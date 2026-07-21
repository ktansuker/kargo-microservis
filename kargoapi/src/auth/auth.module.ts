import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenGuard } from './token.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, TokenGuard],
  // TokenGuard ve AuthService, shipment modülünde de kullanılabilsin.
  exports: [AuthService, TokenGuard],
})
export class AuthModule {}
