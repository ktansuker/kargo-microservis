import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test } from '@nestjs/testing';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { ShipmentService } from './shipment.service';

function sampleDto(): CreateShipmentDto {
  return {
    sendShipping: {
      customerId: '0002024401',
      shippingNumber: '858590800123213',
      requestNumber: '64646464',
      senderCity: 'KOCAELI',
      senderAddress: 'Avansas Tavsanli Depo',
      recipientCity: 'CORUM',
      recipientAddress: 'Cepni Mahallesi No: 7',
      sendShippingItem: [
        {
          productCode: 'PAL',
          productName: 'ULKER ALBENI',
          quantity: '1',
        },
        {
          productCode: '000000000500134364',
          productName: 'ULKER ALBENI',
          quantity: '1',
        },
      ],
    },
  } as CreateShipmentDto;
}

describe('ShipmentService', () => {
  let service: ShipmentService;
  let cache: { get: jest.Mock; set: jest.Mock };

  beforeEach(async () => {
    cache = { get: jest.fn(), set: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ShipmentService,
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();
    service = moduleRef.get(ShipmentService);
  });

  it('başarılı sonuç döner ve shipment\'ı cache\'e yazar', async () => {
    const result = await service.create(sampleDto());

    expect(result.success).toBe(true);
    expect(result.message).toBe('Shipment created');
    expect(result.data.shippingNumber).toBe('858590800123213');
    expect(result.data.itemCount).toBe(2);
    expect(result.data.trackingNumber).toBeTruthy();

    expect(cache.set).toHaveBeenCalledTimes(1);
    const [key] = cache.set.mock.calls[0];
    expect(key).toBe('shipment:858590800123213');
  });
});
