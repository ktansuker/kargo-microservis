/* eslint-disable */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShipmentController } from './controllers/shipment.controller'; 
import { ShipmentService } from './services/shipment.service'; 
import { Shipment } from './entities/shipment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Shipment])], 
  controllers: [ShipmentController],
  providers: [ShipmentService],
})
export class ShipmentModule {}