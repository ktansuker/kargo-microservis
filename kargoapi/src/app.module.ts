import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ShipmentModule } from './shipment/shipment.module';

@Module({
  imports: [
    // DB yok: token ve shipment kayıtları in-memory cache'te tutulur.
    CacheModule.register({
      isGlobal: true,
      ttl: 3600 * 1000, // varsayılan TTL (ms)
      max: 1000, // saklanacak maksimum kayıt sayısı
    }),
    AuthModule,
    ShipmentModule,
  ],
})
export class AppModule {}
