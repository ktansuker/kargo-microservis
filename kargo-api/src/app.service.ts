/* eslint-disable */
import { Injectable, Logger, OnModuleInit, OnModuleDestroy, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shipment } from './shipment.entity';
import * as amqp from 'amqplib';

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

  async createAndPublish(data: CreateShipmentDto) {
    if (!this.channel) {
      this.logger.error('RabbitMQ kanalı henüz hazır değil, bağlantı bekleniyor...');
      throw new Error('Servis henüz hazır değil, lütfen birkaç saniye bekleyin.');
    }

    try {
      // 1. Normal İşlem: Kargoyu BEKLIYOR olarak oluştur ve kaydet
      const shipment = this.shipmentRepository.create({
        cargoProviderCode: data.CargoProviderCode,
        transactionId: data.TransactionID,
        consignmentNo: data.ConsignmentNo || 'Bilinmiyor',
        status: ShipmentStatus.PENDING, 
      });

      await this.shipmentRepository.save(shipment);
      this.logger.log(`[DB KAYIT] Veritabanına eklendi. TransactionID: ${data.TransactionID}`);

      // 2. Kuyruğa Gönder
      const queueName = `${data.CargoProviderCode}CreateShipment-v2`;
      const retryQueueName = `retry_${queueName}`; // <--- İşçiyle aynı kuralı koyuyoruz!

      // API, İşçinin koyduğu kuralların BİREBİR AYNISINI RabbitMQ'ya iletiyor ki çatışma çıkmasın
      await this.channel.assertQueue(queueName, {
        durable: true,
        deadLetterExchange: '',
        deadLetterRoutingKey: retryQueueName, 
      });

      this.channel.sendToQueue(queueName, Buffer.from(JSON.stringify(data)), { persistent: true });
      
      return { statusCode: 200, message: 'Kargo isteği kuyruğa eklendi' };
      
    } catch (error: any) {
      // 3. HATA YÖNETİMİ: İstek patlarsa veritabanına HATALI olarak yaz
      this.logger.error('API İşlem Hatası:', error);
      
      const failedShipment = this.shipmentRepository.create({
        cargoProviderCode: data?.CargoProviderCode || 'Bilinmiyor',
        transactionId: data?.TransactionID || 'Hata-TRX',
        consignmentNo: data?.ConsignmentNo || 'Yok',
        status: 'HATALI' as any, // Enum içinde ERROR varsa onu da yazabilirsin
        errorMessage: error.message || 'Veri eksik veya hatalı',
      });
      
      await this.shipmentRepository.save(failedShipment);

      // Bruno'ya hata mesajını dön
      throw new BadRequestException('İşlem başarısız oldu, hata veritabanına yazıldı.');
    }
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }
}