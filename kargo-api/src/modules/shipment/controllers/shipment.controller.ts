/* eslint-disable */
import { Controller, Post, Get, Query, Param, Body, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ShipmentService } from '../services/shipment.service';
import { CreateShipmentDto } from '../dtos/create-shipment.dto';

@Controller('shipment')
export class ShipmentController {
  constructor(private readonly shipmentService: ShipmentService) { }

  @Post('createShipment')
  async createShipment(@Body() data: CreateShipmentDto) {
    return await this.shipmentService.createAndPublish(data);
  }

  /**
   * GET /shipment/list
   * GET /shipment/list?page=1&limit=20&status=BASARILI
   * Frontend dashboard'un beslendiği liste endpoint'i.
   */
  @Get('list')
  async list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('provider') provider?: string,
    @Query('search') search?: string,
  ) {
    limit = limit > 100 ? 100 : limit;

    return await this.shipmentService.findAll(
      {
        page,
        limit,
        route: 'http://74.162.65.83:3000/shipment/list'
      },
      status,
      provider,
      search,
    );
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