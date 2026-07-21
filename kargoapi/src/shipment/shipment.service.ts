import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { randomUUID } from 'node:crypto';
import { CreateShipmentDto } from './dto/create-shipment.dto';

/** Oluşturulan shipment'lar cache'te 24 saat tutulur. */
const SHIPMENT_TTL_MS = 24 * 60 * 60 * 1000;
const SHIPMENT_CACHE_PREFIX = 'shipment:';

@Injectable()
export class ShipmentService {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  /**
   * Doğrulanmış shipment'ı "oluşturur": bir takip numarası üretir, kaydı
   * cache'e yazar ve başarılı özet döner. (DB yok — her şey cache'te.)
   */
  async create(dto: CreateShipmentDto) {
    const shipping = dto.sendShipping;
    const trackingNumber = randomUUID();

    const record = {
      ...shipping,
      trackingNumber,
      createdAt: new Date().toISOString(),
    };
    await this.cache.set(
      `${SHIPMENT_CACHE_PREFIX}${shipping.shippingNumber}`,
      record,
      SHIPMENT_TTL_MS,
    );

    return {
      success: true,
      message: 'Shipment created',
      data: {
        shippingNumber: shipping.shippingNumber,
        trackingNumber,
        itemCount: shipping.sendShippingItem.length,
      },
    };
  }

  /** Daha önce oluşturulmuş bir shipment'ı cache'ten getirir (opsiyonel yardımcı). */
  async findOne(shippingNumber: string) {
    return this.cache.get(`${SHIPMENT_CACHE_PREFIX}${shippingNumber}`);
  }
}
