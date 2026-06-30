/* eslint-disable */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import { ShipmentService } from './shipment/shipment.service'; 
import axios from 'axios';

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
        
        // TypeScript'in "Ulaşılamaz Kod" hatasını engellemek için ufak bir hile:
        const hataSimulasyonuAktif = false;
        if (hataSimulasyonuAktif) {
          throw new Error(`${providerCode} kargo servisine şu an ulaşılamıyor (Simülasyon Hatası!)`);
        }

        // --- BORUSAN ENTEGRASYON BAŞLANGICI ---
        const payload = JSON.parse(msg.content.toString());
        const transactionId = payload.TransactionID;

        // Tarih formatını "DD/MM/YYYY HH:mm:ss" şeklinde ayarlıyoruz
        const now = new Date();
        const requestDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

        // Paket içeriklerini Borusan'ın beklediği Array yapısına çeviriyoruz
        const sendShippingItem = payload.Packages.flatMap((pkg: any) => 
          pkg.Items.map((item: any) => {
            const productInfo = payload.Products.find((p: any) => p.ProductCode === item.ProductCode);
            return {
              productCode: item.ProductCode,
              productName: productInfo ? productInfo.ProductName : "Bilinmeyen Ürün",
              quantity: item.ProductCount.toString(),
              packageNumber: pkg.Barcode,
              unitDeci: pkg.Deci.toString(),
              itemCount: 1, 
              weight: pkg.Weight.toString(),
              piecesType: "PAL" 
            };
          })
        );

        // Borusan'ın beklediği nihai JSON yapısı
        const borusanRequest = {
          sendShipping: {
            InterfaceId: "1",
            IntegrationDescription: "1",
            customerId: "0002024401", 
            shippingType: "1", 
            shippingNumber: payload.ConsignmentNo, 
            requestNumber: payload.TransactionID, 
            requestDate: requestDate,
            senderCity: "KOCAELİ", 
            senderCounty: "GEBZE",
            senderAddress: "Avansas Tavşanlı Depo",
            recipientCode: "0070324101", 
            recipientTitle: payload.RecipientName, 
            recipientCity: payload.CityText, 
            recipientCounty: payload.TownText, 
            recipientAddress: payload.AddressText, 
            recipientPhoneNumber: payload.RecipientPhone, 
            sendShippingItem: sendShippingItem
          }
        };

        this.logger.log(`Borusan servisine istek atılıyor... (TRX: ${transactionId})`);
        
        // Axios ile Borusan sunucusuna gerçek isteği yolluyoruz
        const response = await axios.post(
          'https://wmsportal.borusanlojistik.com/AvansasLTLDev/Order', 
          borusanRequest, 
          {
            headers: {
              'Operation': 'SendShipping',
              'Content-Type': 'application/json',
              'Authorization': 'Basic UE9fQVJWQVRPX0RFVjpBcnZhdG8zMjEh'
            },
            timeout: 10000 
          }
        );
        // --- BORUSAN ENTEGRASYON BİTİŞİ ---
        
        // Artık TypeScript buraya itiraz edemez:
        await this.shipmentService.updateStatus(transactionId, 'BAŞARILI'); 
        this.logger.log(`[BAŞARILI] ${payload.ConsignmentNo} başarıyla ${providerCode} sistemine iletildi. (Sunucu Yanıtı: ${response.status})`);
        this.channel.ack(msg); 

      } catch (error: any) {
        this.logger.warn(`[HATA] İşlem başarısız oldu. Retry kuyruğuna atılıyor. (Deneme: ${retryCount + 1}) Detay: ${error.message}`);
        
        // 'transactionId' payload içinden geldiği için, catch bloğunda transactionId'yi güvene alalım
        const payload = msg ? JSON.parse(msg.content.toString()) : {};
        const safeTransactionId = payload.TransactionID || 'Bilinmiyor';

        await this.shipmentService.updateStatus(safeTransactionId, 'YENIDEN_DENENIYOR');
        this.channel.nack(msg, false, false);
      }
    });
  }
}