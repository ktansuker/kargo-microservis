/* eslint-disable */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shipment } from '../shipment.entity'; // Kendi entity yoluna göre kontrol et

@Injectable()
export class ShipmentService {
  private readonly logger = new Logger(ShipmentService.name);

  constructor(
    @InjectRepository(Shipment)
    private readonly shipmentRepository: Repository<Shipment>,
  ) {}

  // Statü güncelleme işlemini tek bir merkeze topluyoruz
  async updateStatus(transactionId: string, status: string): Promise<void> {
    try {
      await this.shipmentRepository.update(
        { transactionId: transactionId },
        { status: status }
      );
      this.logger.log(`[DB] TransactionID: ${transactionId} statüsü '${status}' olarak güncellendi.`);
    } catch (error: any) {
      this.logger.error(`[DB] Statü güncellenirken hata oluştu: ${error.message}`);
    }
  }
}