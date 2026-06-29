/* eslint-disable */
import { Controller, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { CreateShipmentDto } from './common/dtos/create-shipment.dto';

@Controller('shipment')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('createShipment')
  async createShipment(@Body() data: CreateShipmentDto) { 
    // Artık data nesnesi "any" değil, DTO kurallarından geçmiş temiz bir veri!
    return await this.appService.createAndPublish(data);
  }
}