/* eslint-disable */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shipment } from '../entities/shipment.entity';
import { ShipmentService } from './shipment.service';

@Module({
  imports: [TypeOrmModule.forFeature([Shipment])],
  providers: [ShipmentService],
  exports: [ShipmentService],
})
export class ShipmentModule {}