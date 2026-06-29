/* eslint-disable */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import { ShipmentService } from './shipment/shipment.service'; 

@Injectable()
export class AppService implements OnModuleInit {
  private readonly logger = new Logger(AppService.name);
  private channel!: amqp.Channel;

  constructor(private readonly shipmentService: ShipmentService) {}

  async onModuleInit() {
    await this.connectRabbitMQ();
  }

  async connectRabbitMQ() {
    try {
      const connection = await amqp.connect('amqp://guest:guest@rabbitmq:5672'); 
      this.channel = await connection.createChannel();
      
      const providerCode = process.env.CARGO_PROVIDER;
      if (!providerCode) {
        throw new Error('FATAL: CARGO_PROVIDER çevresel değişkeni bulunamadı!');
      }

      this.logger.log(`RabbitMQ bağlantısı başarılı. Ben bir [${providerCode}] Worker'ıyım!`);
      
      await this.listenToProviderQueue(providerCode);
    } catch (error) {
      this.logger.error('RabbitMQ bağlantı hatası:', error);
      setTimeout(() => this.connectRabbitMQ(), 5000); 
    }
  }

  async listenToProviderQueue(providerCode: string) { 
    const mainQueue = `${providerCode}CreateShipment-v2`; 
    const retryQueue = `retry_${mainQueue}`;
    const dmqQueue = `dmq_${mainQueue}`;

    await this.channel.assertQueue(dmqQueue, { durable: true });
    await this.channel.assertQueue(retryQueue, {
      durable: true,
      deadLetterExchange: '',
      deadLetterRoutingKey: mainQueue, 
      messageTtl: 10000, 
    });

    await this.channel.assertQueue(mainQueue, {
      durable: true,
      deadLetterExchange: '',
      deadLetterRoutingKey: retryQueue, 
    });

    this.logger.log(`[WORKER] ${mainQueue} kuyruğu 5-Tekrarlı DMQ zekasıyla dinleniyor...`);

    this.channel.consume(mainQueue, async (msg) => {
      if (!msg) return;

      const payload = JSON.parse(msg.content.toString());
      const transactionId = payload.TransactionID;

      const deathHeader = msg.properties.headers?.['x-death'];
      const retryCount = deathHeader ? deathHeader[0].count : 0;

      if (retryCount >= 5) {
        this.logger.error(`[DMQ] ${payload.ConsignmentNo} 5 kez denendi! DMQ'ya taşınıyor.`);
        this.channel.sendToQueue(dmqQueue, msg.content, { persistent: true });
        await this.shipmentService.updateStatus(transactionId, 'HATALI_DMQ'); 
        this.channel.ack(msg); 
        return; 
      }

      try {
        this.logger.log(`[İŞLENİYOR] ${providerCode} Kargosu (Deneme: ${retryCount + 1})`);
        
        // YAPAY HATA KALDIRILDI! Sistem artık normal akışında çalışacak.
        
        // İşlem başarıyla bitti, veritabanını güncelle:
        await this.shipmentService.updateStatus(transactionId, 'BAŞARILI'); 
        
        this.logger.log(`[BAŞARILI] ${payload.ConsignmentNo} başarıyla ${providerCode} sistemine iletildi.`);
        
        // Mesajı kuyruktan tamamen sil
        this.channel.ack(msg); 

      } catch (error: any) {
        this.logger.warn(`[HATA] İşlem başarısız oldu. Retry kuyruğuna atılıyor. (Deneme: ${retryCount + 1})`);
        await this.shipmentService.updateStatus(transactionId, 'YENIDEN_DENENIYOR');
        this.channel.nack(msg, false, false);
      }
    });
  }
}