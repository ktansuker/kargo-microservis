/* eslint-disable */
import { Controller, Post, Get, Query, Param, Body } from '@nestjs/common';
import { ShipmentService } from '../services/shipment.service';
import { CreateShipmentDto } from '../dtos/create-shipment.dto';

@Controller('shipment')
export class ShipmentController {
  constructor(private readonly shipmentService: ShipmentService) {}

  @Post('createShipment')
  async createShipment(@Body() data: CreateShipmentDto) {
    return await this.shipmentService.createAndPublish(data);
  }

  /**
   * GET /shipment/list
   * GET /shipment/list?status=BASARILI
   * Frontend dashboard'un beslendiği liste endpoint'i.
   */
  @Get('list')
  async list(@Query('status') status?: string) {
    return await this.shipmentService.findAll(status);
  }

  /**
   * GET /shipment/:id
   * Detay paneli için tekil kayıt.
   */
  @Get(':id')
  async getOne(@Param('id') id: string) {
    return await this.shipmentService.findOne(id);
  }
}