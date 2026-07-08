/* eslint-disable */
import { Controller, Post, Body } from '@nestjs/common';
import { ShipmentService } from '../services/shipment.service';
import { CreateShipmentDto } from '../dtos/create-shipment.dto';

@Controller('shipment')
export class ShipmentController {
  constructor(private readonly shipmentService: ShipmentService) {}

  @Post('createShipment')
  async createShipment(@Body() data: CreateShipmentDto) { 
    // Artık data nesnesi "any" değil, DTO kurallarından geçmiş temiz bir veri!
    return await this.shipmentService.createAndPublish(data);
  }
}