/* eslint-disable */
import { Test, TestingModule } from '@nestjs/testing';
import { ShipmentController } from './shipment.controller';
import { ShipmentService } from '../services/shipment.service';

describe('ShipmentController', () => {
  let shipmentController: ShipmentController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ShipmentController],
      // Test ortamında hata almamak için servisin sahte (mock) bir versiyonunu sağlıyoruz
      providers: [
        {
          provide: ShipmentService,
          useValue: {
            createAndPublish: jest.fn(), 
          },
        },
      ],
    }).compile();

    shipmentController = app.get<ShipmentController>(ShipmentController);
  });

  // getHello() metodunu sildik, yerine sadece controller'ın varlığını test ediyoruz
  it('should be defined', () => {
    expect(shipmentController).toBeDefined();
  });
});