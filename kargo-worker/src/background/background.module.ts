/* eslint-disable */
import { Module } from '@nestjs/common';
import { ShipmentConsumerService } from './shipment-consumer.service';
import { ConnectionModule } from '../connection/connection.module';
import { ShipmentModule } from '../modules/shipment/shipment.module';

@Module({
  imports: [ConnectionModule, ShipmentModule],
  providers: [ShipmentConsumerService],
})
export class BackgroundModule {}