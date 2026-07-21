import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ShipmentController } from './shipment.controller';
import { ShipmentService } from './shipment.service';

@Module({
  // TokenGuard'ı çözebilmek için AuthModule içe aktarılır.
  imports: [AuthModule],
  controllers: [ShipmentController],
  providers: [ShipmentService],
})
export class ShipmentModule {}
