/* eslint-disable */
import { Injectable, Logger, OnModuleInit, OnModuleDestroy, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shipment } from './shipment.entity';
import * as amqp from 'amqplib';
import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';

// Yeni eklediğimiz importlar!
import { CreateShipmentDto } from './common/dtos/create-shipment.dto';
import { ShipmentStatus } from './common/enums/shipment-status.enum';

@Injectable()
export class AppService implements OnModuleInit, OnModuleDestroy {
  private connection: any;
  private channel: any;
  private readonly logger = new Logger(AppService.name);

  constructor(
    @InjectRepository(Shipment)
    private shipmentRepository: Repository<Shipment>,
  ) {}

  async onModuleInit() {
    try {
      this.connection = await amqp.connect('amqp://guest:guest@rabbitmq:5672');
      this.channel = await this.connection.createChannel();
      this.logger.log('RabbitMQ bağlantısı başarılı (API)');
    } catch (error) {
      this.logger.error('RabbitMQ bağlantı hatası:', error);
    }
  }

  // Parametreyi any'den DTO modelimize çeviriyoruz:
  async createAndPublish(data: CreateShipmentDto) { 
    if (!this.channel) {
      this.logger.error('RabbitMQ kanalı henüz hazır değil, bağlantı bekleniyor...');
      throw new Error('Servis henüz hazır değil, lütfen birkaç saniye bekleyin.');
    }

    try {
      // 1. MANUEL DTO KONTROLÜ (Gelen DTO verisini sınıf kurallarından geçiriyoruz)
      const dtoInstance = plainToInstance(CreateShipmentDto, data);
      const errors = validateSync(dtoInstance);

      if (errors.length > 0) {
        // Hangi alanların eksik/hatalı olduğunu bulup string'e çeviriyoruz
        const errorMessages = errors.map(err => Object.values(err.constraints || {}).join(', ')).join(' | ');
        
        // Bu hatayı bilerek fırlatıyoruz ki aşağıdaki CATCH bloğuna düşsün ve DB'ye yazılsın!
        throw new Error(`DTO Hatası: ${errorMessages}`);
      }

      // 2. Normal İşlem: Kargoyu BEKLIYOR olarak oluştur ve kaydet
      const shipment = this.shipmentRepository.create({
        cargoProviderCode: data.CargoProviderCode,
        transactionId: data.TransactionID,
        consignmentNo: data.ConsignmentNo || 'Bilinmiyor',
        status: ShipmentStatus.PENDING,
      });

      await this.shipmentRepository.save(shipment);
      this.logger.log(`[DB KAYIT] Veritabanına eklendi. TransactionID: ${data.TransactionID}`);

      // 3. Kuyruğa Gönder
      const queueName = `${data.CargoProviderCode}CreateShipment-v2`;
      const retryQueueName = `retry_${queueName}`;

      await this.channel.assertQueue(queueName, {
        durable: true,
        deadLetterExchange: '',
        deadLetterRoutingKey: retryQueueName,
      });

      this.channel.sendToQueue(queueName, Buffer.from(JSON.stringify(data)), { persistent: true });

      return { statusCode: 200, message: 'Kargo isteği kuyruğa eklendi' };

    } catch (error: any) {
      // 4. HATA YÖNETİMİ: DTO'dan seken tüm hatalar buraya düşer ve veritabanına işlenir
      this.logger.error('API İşlem Hatası:', error.message);

      const failedShipment = this.shipmentRepository.create({
        cargoProviderCode: data?.CargoProviderCode || 'Bilinmiyor',
        transactionId: data?.TransactionID || 'Hata-TRX',
        consignmentNo: data?.ConsignmentNo || 'Yok',
        status: 'HATALI' as any,
        errorMessage: error.message || 'Bilinmeyen Veri Hatası',
      });

      await this.shipmentRepository.save(failedShipment);

      throw new BadRequestException('Kargo isteği hatalı, veritabanına loglandı.');
    }
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }
}