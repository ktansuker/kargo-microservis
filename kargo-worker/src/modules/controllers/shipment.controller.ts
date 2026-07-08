/* eslint-disable */
import { Body, Controller, Get, Post } from '@nestjs/common';
import { ShipmentService } from '../shipment/shipment.service';
import * as amqp from 'amqplib';

@Controller('shipment')
export class AppController {
  
  constructor(private readonly shipmentService: ShipmentService) {}

  @Get()
  healthCheck(): string {
    return 'Kargo Worker (Job) başarıyla çalışıyor ve kuyruğu dinliyor!';
  }

  @Post()
  async createShipment(@Body() body: any) {
    console.log('Bruno dan gelen verinin ID si:', body.TransactionID);

    // Gelen veriyi veritabanına yazıyoruz
    await this.shipmentService.create(body);

    // 2. Veriyi RabbitMQ kuyruğuna fırlat
    try {
      const conn = await amqp.connect('amqp://guest:guest@localhost:5672');
      const channel = await conn.createChannel();
      
      const queueName = `${body.CargoProviderCode}CreateShipment-v2`; // Örn: BorusanCreateShipment-v2
      const retryQueueName = `retry_${queueName}`; // Worker ile aynı retry adını oluşturduk
      
      // Kuyruk ayarlarını Worker ile BİREBİR aynı yaptık
      await channel.assertQueue(queueName, { 
        durable: true,
        deadLetterExchange: '',
        deadLetterRoutingKey: retryQueueName
      });
      
      channel.sendToQueue(queueName, Buffer.from(JSON.stringify(body)), { persistent: true });
      console.log(`[KUYRUK] Veri ${queueName} kuyruğuna fırlatıldı!`);
      
      setTimeout(() => conn.close(), 500);
    } catch (error) {
      console.error('RabbitMQ ya gönderirken hata oluştu:', error);
    }

    return { 
      success: true, 
      message: 'Kargo başarıyla alındı ve veritabanına işlendi!' 
    };
  }
}