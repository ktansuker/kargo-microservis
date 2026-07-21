import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { TokenGuard } from '../auth/token.guard';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { ShipmentService } from './shipment.service';

@Controller()
export class ShipmentController {
  constructor(private readonly shipmentService: ShipmentService) {}

  /**
   * POST /createShipment
   * `Authorization: Basic <token>` (TokenGuard) ve çekirdek alan doğrulaması
   * (CreateShipmentDto) geçerse başarılı sonuç döner.
   */
  @Post('createShipment')
  @UseGuards(TokenGuard)
  @HttpCode(200)
  async create(@Body() dto: CreateShipmentDto) {
    return this.shipmentService.create(dto);
  }
}
